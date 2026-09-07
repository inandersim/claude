import { getRemoteAiClient, type RemoteAiClient } from '@/data/ai/remoteAi';
import { getRemoteVisionClient, type RemoteVisionClient } from '@/data/ai/remoteVision';
import { getFirstAidGuides } from '@/data/content/firstAid';
import {
  VISION_HISTORY_LIMIT,
  advanceSosStage,
  answerLocally,
  buildSosPayload,
  buildTripPlan,
  classifyIntent,
  distanceKm,
  computeAlerts,
  eawsRegionFor,
  encodeSatMessage,
  isSosActive,
  localVisionAdvice,
  mockAvalanche,
  mockForecast,
  nearestCenters,
  planRoute,
  prioritize,
  queuePolicy,
  sosTimelineNote,
  summarizeThreadTitle,
  type AiMessage,
  type AiThread,
  type GeoPoint,
  type ID,
  type LinkStatus,
  type LinkType,
  type LocalKnowledge,
  type MapPack,
  type SatMessage,
  type SosSession,
  type SosStage,
  type TrailGraph,
  type VisionAdvice,
  type VisionHistoryItem,
  type WeatherForecast,
} from '@/domain';

import { CACHE_TTL, coordKey, getCached } from '../../external/cache';
import { fetchEawsBulletin } from '../../external/eaws';
import { fetchOpenMeteoElevation, fetchOpenMeteoForecast } from '../../external/openMeteo';
import type {
  AiRepository,
  MapsRepository,
  SatelliteRepository,
  VisionRepository,
  WeatherRepository,
} from '../../repositories';
import { notifyMany, requireUser, type RemoteContext } from '../context';
import {
  fromGeoPoint,
  num,
  toAiMessage,
  toAiThread,
  toCrag,
  toBusiness,
  toEmergencyCenter,
  toGeoPoint,
  toHazard,
  toLibraryPlace,
  toMapPack,
  toSatDevice,
  toSatMessage,
  toSavedRoute,
  toAvalancheBulletin,
  toSosSession,
  toTrailEdge,
  toTrailNode,
  toVisionHistoryItem,
  requireGeoPoint,
} from '../mappers';
import { maybeRow, oneRow, rows, type Row } from '../postgrest';

/* ================================================================== */
/* Yapay zekâ                                                         */
/* ================================================================== */

export interface AiRepositoryOptions {
  /** Test ve yapılandırma için: null → her zaman yerel cevap. */
  remote?: RemoteAiClient | null;
}

export function createAiRepository(
  ctx: RemoteContext,
  options: AiRepositoryOptions = {},
): AiRepository {
  const { db } = ctx;
  const remote = options.remote === undefined ? getRemoteAiClient() : options.remote;

  const buildKnowledge = async (locale: string): Promise<LocalKnowledge> => {
    const [places, hazards, centers, crags, businesses] = await Promise.all([
      rows(db.from('places').select('*'), 'kütüphane okunamadı'),
      rows(db.from('hazards').select('*'), 'tehlikeler okunamadı'),
      rows(db.from('emergency_centers').select('*'), 'acil merkezler okunamadı'),
      rows(db.from('crags').select('*'), 'kayalar okunamadı'),
      rows(db.from('businesses').select('*'), 'işletmeler okunamadı'),
    ]);
    return {
      places: places.map(toLibraryPlace),
      hazards: hazards.map(toHazard),
      emergencyCenters: centers.map(toEmergencyCenter),
      firstAidSlugs: getFirstAidGuides(locale).map((g) => g.slug),
      crags: crags.map(toCrag),
      businesses: businesses.map(toBusiness),
    };
  };

  const threadMessages = async (threadId: ID): Promise<AiMessage[]> => {
    const data = await rows(
      db
        .from('ai_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true }),
      'mesajlar okunamadı',
    );
    return data.map(toAiMessage);
  };

  return {
    async threads(meId) {
      const data = await rows(
        db
          .from('ai_threads')
          .select('*')
          .eq('user_id', meId)
          .order('updated_at', { ascending: false }),
        'sohbetler okunamadı',
      );
      return data.map(toAiThread);
    },

    async thread(meId, threadId) {
      const row = await maybeRow(
        db.from('ai_threads').select('*').eq('id', threadId).eq('user_id', meId),
        'sohbet okunamadı',
      );
      if (!row) return null;
      const thread = toAiThread(row);
      return { ...thread, messages: await threadMessages(thread.id) };
    },

    async send(meId, threadId, content, aiCtx) {
      const text = content.trim();
      if (!text) throw new Error('Boş mesaj gönderilemez.');
      await requireUser(db, meId);
      const now = new Date();

      let thread: AiThread | null = null;
      if (threadId) {
        const row = await maybeRow(
          db.from('ai_threads').select('*').eq('id', threadId).eq('user_id', meId),
          'sohbet okunamadı',
        );
        if (!row) throw new Error('Sohbet bulunamadı.');
        thread = toAiThread(row);
      } else {
        const created = await oneRow(
          db
            .from('ai_threads')
            .insert({ user_id: meId, title: summarizeThreadTitle(text) })
            .select('*'),
          'sohbet oluşturulamadı',
        );
        thread = toAiThread(created);
      }

      const userIntent = classifyIntent(text, aiCtx.locale);
      await rows(
        db.from('ai_messages').insert({
          thread_id: thread.id,
          role: 'user',
          content: text,
          intent: userIntent,
          actions: [],
          created_at: now.toISOString(),
        }),
        'mesaj yazılamadı',
      );

      let answer: {
        content: string;
        intent: AiMessage['intent'];
        actions: AiMessage['actions'];
      } | null = null;
      if (remote) {
        try {
          const history = (await threadMessages(thread.id)).map((m) => ({
            role: m.role,
            content: m.content,
          }));
          const result = await remote.chat(history, aiCtx);
          if (result.content) {
            answer = {
              content: result.content,
              intent: result.intent ?? userIntent,
              actions: result.actions,
            };
          }
        } catch {
          answer = null; // ağ hatası → yerel cevaba düş
        }
      }
      if (!answer) answer = answerLocally(text, aiCtx, await buildKnowledge(aiCtx.locale));

      // `touch_ai_thread` tetikleyicisi updated_at alanını günceller.
      const created = await oneRow(
        db
          .from('ai_messages')
          .insert({
            thread_id: thread.id,
            role: 'assistant',
            content: answer.content,
            intent: answer.intent,
            actions: answer.actions,
            // Kullanıcı mesajından sonra sıralansın diye 1 ms ileri
            created_at: new Date(now.getTime() + 1).toISOString(),
          })
          .select('*'),
        'yanıt yazılamadı',
      );
      return toAiMessage(created);
    },

    async planTrip(meId, prompt, aiCtx) {
      await requireUser(db, meId);
      if (remote) {
        try {
          return await remote.planTrip(prompt, aiCtx);
        } catch {
          // yerel plana düş
        }
      }
      const places = await rows(db.from('places').select('*'), 'kütüphane okunamadı');
      return buildTripPlan(prompt, aiCtx, places.map(toLibraryPlace), new Date());
    },

    async deleteThread(meId, threadId) {
      const deleted = await rows(
        db.from('ai_threads').delete().eq('id', threadId).eq('user_id', meId).select('id'),
        'sohbet silinemedi',
      );
      if (!deleted.length) throw new Error('Sohbet bulunamadı.');
    },
  };
}

/* ================================================================== */
/* Haritalar                                                          */
/* ================================================================== */

export function createMapsRepository(ctx: RemoteContext): MapsRepository {
  const { db } = ctx;

  const packSelect = '*, map_pack_downloads!pack_id(*)';

  const findGraph = async (regionId: ID): Promise<TrailGraph> => {
    const [nodeRows, edgeRows] = await Promise.all([
      rows(db.from('trail_nodes').select('*').eq('region_id', regionId), 'düğümler okunamadı'),
      rows(db.from('trail_edges').select('*').eq('region_id', regionId), 'kenarlar okunamadı'),
    ]);
    if (!nodeRows.length) throw new Error('Bölge için patika grafı bulunamadı');
    return {
      regionId,
      nodes: nodeRows.map(toTrailNode),
      edges: edgeRows.map(toTrailEdge),
    };
  };

  /** İndirme durumu kullanıcıya özeldir; oturum yoksa `available` görünür. */
  const packsFor = async (meId: ID | null): Promise<MapPack[]> => {
    const data = await rows(db.from('map_packs').select(packSelect), 'harita paketleri okunamadı');
    return data.map((row) => {
      const downloads = Array.isArray(row.map_pack_downloads)
        ? (row.map_pack_downloads as Row[])
        : [];
      const mine = meId ? downloads.find((d) => String(d.user_id) === meId) : undefined;
      return toMapPack({ ...row, map_pack_downloads: mine ? [mine] : [] });
    });
  };

  return {
    async packs() {
      return await packsFor(ctx.sessionUserId());
    },

    async download(packId) {
      const meId = ctx.sessionUserId();
      if (!meId) throw new Error('İndirme için oturum gerekli');
      const pack = await maybeRow(
        db.from('map_packs').select('*').eq('id', packId),
        'harita paketi okunamadı',
      );
      if (!pack) throw new Error('Harita paketi bulunamadı');
      // Gerçek indirme istemci tarafındadır; sunucu yalnızca durumu tutar.
      await rows(
        db.from('map_pack_downloads').upsert(
          {
            user_id: meId,
            pack_id: packId,
            status: 'downloading',
            progress: 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,pack_id' },
        ),
        'indirme kaydedilemedi',
      );
      const packs = await packsFor(meId);
      const result = packs.find((p) => p.id === packId);
      if (!result) throw new Error('Harita paketi bulunamadı');
      return result;
    },

    async remove(packId) {
      const meId = ctx.sessionUserId();
      if (!meId) throw new Error('İşlem için oturum gerekli');
      await rows(
        db.from('map_pack_downloads').delete().eq('user_id', meId).eq('pack_id', packId),
        'indirme kaldırılamadı',
      );
      const packs = await packsFor(meId);
      const result = packs.find((p) => p.id === packId);
      if (!result) throw new Error('Harita paketi bulunamadı');
      return result;
    },

    async graph(regionId) {
      return await findGraph(regionId);
    },

    async regions() {
      const data = await rows(db.from('map_regions').select('*'), 'bölgeler okunamadı');
      return data.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        countryCode: String(row.country_code),
        center: requireGeoPoint(row.center),
      }));
    },

    async plan(regionId, fromNodeId, toNodeId, profile) {
      const graph = await findGraph(regionId);
      const planned = planRoute(graph, fromNodeId, toNodeId, profile);
      if (!planned) throw new Error('Bu profil için iki nokta arasında rota bulunamadı');
      return planned;
    },

    async savedRoutes(meId) {
      const data = await rows(
        db
          .from('saved_routes')
          .select('*')
          .eq('user_id', meId)
          .order('created_at', { ascending: false }),
        'kayıtlı rotalar okunamadı',
      );
      return data.map(toSavedRoute);
    },

    async saveRoute(meId, input) {
      await requireUser(db, meId);
      const name = input.name.trim();
      if (!name) throw new Error('Rota adı boş olamaz');
      if (input.planned.nodeIds.length < 2) {
        throw new Error('Kaydedilecek rota en az iki nokta içermeli');
      }
      // `saved_routes_sync_path` tetikleyicisi geometriyi planned alanından üretir.
      const created = await oneRow(
        db
          .from('saved_routes')
          .insert({
            user_id: meId,
            region_id: input.regionId,
            name,
            route_profile: input.routeProfile,
            planned: input.planned,
            distance_km: input.planned.distanceKm,
            ascent_m: input.planned.ascentM,
          })
          .select('*'),
        'rota kaydedilemedi',
      );
      return toSavedRoute(created);
    },

    async deleteRoute(meId, routeId) {
      const deleted = await rows(
        db.from('saved_routes').delete().eq('id', routeId).eq('user_id', meId).select('id'),
        'rota silinemedi',
      );
      if (!deleted.length) throw new Error('Kayıtlı rota bulunamadı');
    },
  };
}

/* ================================================================== */
/* Uydu haberleşme                                                    */
/* ================================================================== */

/** Bağlantı türüne göre simüle edilen durum (cihaz radyosu istemcidedir). */
const LINK_PRESETS: Record<LinkType, Omit<LinkStatus, 'link'>> = {
  cellular: { signal: 72, satellitesInView: 0, estimatedLatencyS: 1 },
  wifi: { signal: 88, satellitesInView: 0, estimatedLatencyS: 1 },
  satellite: { signal: 46, satellitesInView: 3, estimatedLatencyS: 90 },
  none: { signal: 0, satellitesInView: 0, estimatedLatencyS: 0 },
};

export function createSatelliteRepository(ctx: RemoteContext): SatelliteRepository {
  const { db } = ctx;
  /** Bağlantı durumu cihaza özgüdür; sunucuda tutulmaz. */
  let currentLink: LinkStatus = { link: 'cellular', ...LINK_PRESETS.cellular };

  const myDevices = async (meId: ID) => {
    const data = await rows(
      db
        .from('sat_devices')
        .select('*')
        .eq('user_id', meId)
        .order('paired_at', { ascending: false }),
      'cihazlar okunamadı',
    );
    return data.map(toSatDevice);
  };

  /** Uydu bağlantısında en dolu pilli cihaz. */
  const pickDevice = async (meId: ID) => {
    if (currentLink.link !== 'satellite') return null;
    const devices = await myDevices(meId);
    return devices.sort((a, b) => (b.batteryPct ?? 0) - (a.batteryPct ?? 0))[0] ?? null;
  };

  /** Kuyruk kararını uygular ve satırı günceller. */
  const attempt = async (message: SatMessage, meId: ID): Promise<SatMessage> => {
    const decision = queuePolicy(message, currentLink.link, message.attempts);
    const patch: Row = { link: currentLink.link };
    let next: SatMessage = { ...message, link: currentLink.link };
    if (decision === 'send') {
      const device = await pickDevice(meId);
      next = {
        ...next,
        attempts: message.attempts + 1,
        status: 'sent',
        deviceId: device?.id ?? message.deviceId,
      };
      patch.attempts = next.attempts;
      patch.status = 'sent';
      if (device) {
        patch.device_id = device.id;
        await rows(
          db
            .from('sat_devices')
            .update({
              used_this_month: device.usedThisMonth + 1,
              last_seen_at: new Date().toISOString(),
            })
            .eq('id', device.id),
          'cihaz güncellenemedi',
        );
      }
    } else if (decision === 'fail') {
      next = { ...next, status: 'failed' };
      patch.status = 'failed';
    } else {
      next = { ...next, attempts: message.attempts + 1, status: 'queued' };
      patch.attempts = next.attempts;
      patch.status = 'queued';
    }
    await rows(db.from('sat_messages').update(patch).eq('id', message.id), 'mesaj güncellenemedi');
    return next;
  };

  const activeSession = async (meId: ID): Promise<SosSession | null> => {
    const data = await rows(
      db
        .from('sos_sessions')
        .select('*')
        .eq('user_id', meId)
        .order('started_at', { ascending: false }),
      'SOS oturumları okunamadı',
    );
    return data.map(toSosSession).find((s) => isSosActive(s.stage)) ?? null;
  };

  const pushStage = async (session: SosSession, stage: SosStage): Promise<SosSession> => {
    // `append_sos_timeline` tetikleyicisi zaman çizelgesini tutar; notu biz ekleriz.
    const at = new Date().toISOString();
    const timeline = [...session.timeline, { stage, at, note: sosTimelineNote(stage, 'tr') }];
    const updated = await oneRow(
      db
        .from('sos_sessions')
        .update({ stage, timeline, updated_at: at })
        .eq('id', session.id)
        .select('*'),
      'SOS aşaması güncellenemedi',
    );
    return toSosSession(updated);
  };

  const resolveSosEvent = async (session: SosSession): Promise<void> => {
    await rows(
      db
        .from('sos_events')
        .update({ resolved_at: new Date().toISOString() })
        .eq('id', session.id)
        .is('resolved_at', null),
      'SOS olayı kapatılamadı',
    );
    await rows(
      db.from('location_shares').delete().eq('user_id', session.userId).eq('mode', 'sos'),
      'SOS paylaşımı kaldırılamadı',
    );
  };

  return {
    async devices(meId) {
      return await myDevices(meId);
    },

    async pair(meId, input) {
      await requireUser(db, meId);
      const name = input.name.trim();
      if (!name) throw new Error('Cihaz adı gerekli');
      if (input.imei && !/^\d{15}$/.test(input.imei)) throw new Error('IMEI 15 haneli olmalı');
      const quota: Record<typeof input.type, number> = {
        inreach: 40,
        zoleo: 25,
        spot: 20,
        phone_satellite: 0,
        starlink_mini: 0,
      };
      const created = await oneRow(
        db
          .from('sat_devices')
          .insert({
            user_id: meId,
            type: input.type,
            name,
            imei: input.imei || null,
            battery_pct: input.type === 'starlink_mini' ? null : 100,
            monthly_quota: quota[input.type],
            used_this_month: 0,
          })
          .select('*'),
        'cihaz eşleştirilemedi',
      );
      return toSatDevice(created);
    },

    async unpair(meId, deviceId) {
      const deleted = await rows(
        db.from('sat_devices').delete().eq('id', deviceId).eq('user_id', meId).select('id'),
        'cihaz kaldırılamadı',
      );
      if (!deleted.length) throw new Error(`Cihaz bulunamadı: ${deviceId}`);
    },

    async linkStatus() {
      const jitter = currentLink.link === 'none' ? 0 : Math.round((Math.random() - 0.5) * 6);
      return { ...currentLink, signal: Math.max(1, Math.min(100, currentLink.signal + jitter)) };
    },

    async setLink(_meId, link) {
      currentLink = { link, ...LINK_PRESETS[link] };
      return currentLink;
    },

    async messages(meId) {
      const data = await rows(
        db
          .from('sat_messages')
          .select('*')
          .eq('user_id', meId)
          .order('created_at', { ascending: false }),
        'mesajlar okunamadı',
      );
      const mine = data.map(toSatMessage);
      const pending = prioritize(
        mine.filter((m) => m.status === 'queued' || m.status === 'sending'),
      );
      const rest = mine.filter((m) => m.status !== 'queued' && m.status !== 'sending');
      return [...pending, ...rest];
    },

    async send(meId, input) {
      const me = await requireUser(db, meId);
      const body = encodeSatMessage(input, new Date());
      const created = await oneRow(
        db
          .from('sat_messages')
          .insert({
            user_id: meId,
            device_id: null,
            kind: input.kind,
            body,
            coords: fromGeoPoint(input.coords),
            to_contacts: input.toContacts.length
              ? input.toContacts
              : me.emergencyContacts.map((c) => c.phone),
            status: 'queued',
            link: currentLink.link,
            attempts: 0,
          })
          .select('*'),
        'mesaj oluşturulamadı',
      );
      return await attempt(toSatMessage(created), meId);
    },

    async flush(meId) {
      const data = await rows(
        db
          .from('sat_messages')
          .select('*')
          .eq('user_id', meId)
          .in('status', ['queued', 'sending', 'failed']),
        'mesajlar okunamadı',
      );
      const pending = prioritize(data.map(toSatMessage));
      const attempted: SatMessage[] = [];
      for (const m of pending) {
        if (m.status === 'failed' && queuePolicy(m, currentLink.link, m.attempts) === 'fail') {
          continue; // kalıcı başarısız — yeniden denenmez
        }
        attempted.push(await attempt(m, meId));
      }
      return attempted;
    },

    async sos(meId) {
      return await activeSession(meId);
    },

    async startSos(meId, coords) {
      const me = await requireUser(db, meId);
      if (await activeSession(meId)) throw new Error('Zaten aktif bir SOS var');
      if (currentLink.link === 'none') throw new Error('Bağlantı yok — SOS gönderilemedi');

      const centerRows = await rows(
        db
          .from('emergency_centers')
          .select('*')
          .in('type', ['mountain_rescue', 'ambulance']),
        'acil merkezler okunamadı',
      );
      const nearest = nearestCenters(centerRows.map(toEmergencyCenter), coords, { limit: 1 })[0];
      const startedAt = new Date().toISOString();
      const created = await oneRow(
        db
          .from('sos_sessions')
          .insert({
            user_id: meId,
            stage: 'idle',
            coords: fromGeoPoint(coords),
            started_at: startedAt,
            timeline: [],
            rescue_center_id: nearest?.id ?? null,
            link: currentLink.link,
          })
          .select('*'),
        'SOS başlatılamadı',
      );
      let session = toSosSession(created);
      session = await pushStage(session, 'armed');
      session = await pushStage(session, 'sent');

      // Uydu üzerinden giden SOS yükü mesaj geçmişinde de görünür.
      const device = await pickDevice(meId);
      await rows(
        db.from('sat_messages').insert({
          user_id: meId,
          device_id: device?.id ?? null,
          kind: 'sos',
          body: buildSosPayload(me, coords, me.emergencyContacts),
          coords: fromGeoPoint(coords),
          to_contacts: me.emergencyContacts.map((c) => c.phone),
          status: 'sent',
          link: currentLink.link,
          attempts: 1,
        }),
        'SOS mesajı yazılamadı',
      );
      // Genel SOS olay kaydı + canlı SOS konum paylaşımı.
      await rows(
        db.from('sos_events').insert({
          id: session.id,
          user_id: meId,
          coords: fromGeoPoint(coords),
          created_at: startedAt,
          notified_contacts: me.emergencyContacts.length,
        }),
        'SOS olayı yazılamadı',
      );
      await rows(
        db.from('location_shares').upsert(
          {
            user_id: meId,
            coords: fromGeoPoint(coords),
            mode: 'sos',
            started_at: startedAt,
            expires_at: null,
            updated_at: startedAt,
          },
          { onConflict: 'user_id' },
        ),
        'SOS konumu paylaşılamadı',
      );
      await notifyMany(
        db,
        me.emergencyContacts.map((c) => c.userId).filter((id): id is ID => Boolean(id)),
        {
          type: 'sos_alert',
          senderId: meId,
          message: `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)} (uydu)`,
          postId: null,
          matchId: null,
          targetId: session.id,
        },
      );
      return session;
    },

    async advanceSos(meId) {
      const session = await activeSession(meId);
      if (!session) throw new Error('Aktif SOS yok');
      const next = await pushStage(session, advanceSosStage(session.stage));
      if (next.stage === 'resolved') await resolveSosEvent(next);
      return next;
    },

    async cancelSos(meId) {
      const session = await activeSession(meId);
      if (!session) return;
      const at = new Date().toISOString();
      const timeline = [
        ...session.timeline,
        { stage: 'resolved' as SosStage, at, note: 'Kullanıcı iptal etti (yanlış alarm)' },
      ];
      await rows(
        db
          .from('sos_sessions')
          .update({ stage: 'resolved', timeline, updated_at: at })
          .eq('id', session.id),
        'SOS iptal edilemedi',
      );
      await resolveSosEvent(session);
    },
  };
}

/* ================================================================== */
/* Görüntü analizi                                                    */
/* ================================================================== */

export interface VisionRepositoryOptions {
  /** Test ve yapılandırma için: null → her zaman yerel tavsiye. */
  remote?: RemoteVisionClient | null;
}

export function createVisionRepository(
  ctx: RemoteContext,
  options: VisionRepositoryOptions = {},
): VisionRepository {
  const { db } = ctx;
  const remote = options.remote === undefined ? getRemoteVisionClient() : options.remote;

  return {
    async analyze(meId, input) {
      await requireUser(db, meId);
      const now = new Date();

      let advice: VisionAdvice | null = null;
      if (remote && input.imageBase64) {
        try {
          advice = await remote.analyze(input, now);
        } catch {
          advice = null; // ağ / boyut / gateway hatası → yerel kontrol listesine düş
        }
      }
      if (!advice) {
        const [hazards, centers] = await Promise.all([
          rows(db.from('hazards').select('*'), 'tehlikeler okunamadı'),
          rows(db.from('emergency_centers').select('*'), 'acil merkezler okunamadı'),
        ]);
        advice = localVisionAdvice(
          input,
          {
            hazards: hazards.map(toHazard),
            emergencyCenters: centers.map(toEmergencyCenter),
            firstAidSlugs: getFirstAidGuides(input.locale).map((g) => g.slug),
            altitudeM: input.altitudeM,
          },
          now,
        );
      }

      const created = await oneRow(
        db
          .from('vision_history')
          .insert({
            user_id: meId,
            situation: advice.situation,
            question: input.question.trim(),
            thumbnail_uri: input.imageUri,
            observations: advice.observations,
            risk: advice.risk,
            advice: advice.advice,
            avoid: advice.avoid,
            actions: advice.actions,
            source: advice.source,
            confidence: advice.confidence,
            coords: fromGeoPoint(input.coords),
            altitude_m: input.altitudeM,
            locale: input.locale,
          })
          .select('*'),
        'analiz kaydedilemedi',
      );
      // Kullanıcı başına en fazla N kayıt; en eskiler düşer.
      const mine = await rows(
        db
          .from('vision_history')
          .select('id')
          .eq('user_id', meId)
          .order('created_at', { ascending: false }),
        'geçmiş okunamadı',
      );
      const drop = mine.slice(VISION_HISTORY_LIMIT).map((row) => String(row.id));
      if (drop.length) {
        await rows(db.from('vision_history').delete().in('id', drop), 'eski kayıtlar silinemedi');
      }
      const item: VisionHistoryItem = toVisionHistoryItem(created);
      return item;
    },

    async history(meId) {
      const data = await rows(
        db
          .from('vision_history')
          .select('*')
          .eq('user_id', meId)
          .order('created_at', { ascending: false }),
        'geçmiş okunamadı',
      );
      return data.map(toVisionHistoryItem);
    },

    async clearHistory(meId) {
      await rows(db.from('vision_history').delete().eq('user_id', meId), 'geçmiş silinemedi');
    },
  };
}

/* ================================================================== */
/* Hava & çığ                                                         */
/* ================================================================== */

/** Bilinen noktalardan yükseklik devralmak için en fazla uzaklık (km). */
const NEAREST_ELEVATION_MAX_KM = 3;

/** Mock tahmin tohumu — aynı konum aynı yedek veriyi versin. */
const MOCK_SEED = 'zirve-weather';

export function createWeatherRepository(ctx: RemoteContext): WeatherRepository {
  const { db } = ctx;

  /**
   * Kütüphane ve patika düğümlerinden en yakın bilinen irtifa.
   * `maxKm` içinde yoksa null.
   */
  const nearestKnownElevation = async (
    point: GeoPoint,
    maxKm = NEAREST_ELEVATION_MAX_KM,
  ): Promise<number | null> => {
    const [places, nodes] = await Promise.all([
      rows(db.from('places').select('lat, lng, elevation_m'), 'kütüphane okunamadı'),
      rows(db.from('trail_nodes').select('coords, elevation_m'), 'düğümler okunamadı'),
    ]);
    let best: { d: number; elev: number } | null = null;
    const consider = (lat: number, lng: number, elev: number | null) => {
      if (elev == null) return;
      const d = distanceKm(point, { latitude: lat, longitude: lng });
      if (d <= maxKm && (!best || d < best.d)) best = { d, elev };
    };
    for (const row of places) {
      consider(num(row.lat), num(row.lng), row.elevation_m == null ? null : num(row.elevation_m));
    }
    for (const row of nodes) {
      const coords = toGeoPoint(row.coords);
      if (coords) {
        consider(
          coords.latitude,
          coords.longitude,
          row.elevation_m == null ? null : num(row.elevation_m),
        );
      }
    }
    return best ? (best as { d: number; elev: number }).elev : null;
  };

  const forecast: WeatherRepository['forecast'] = async (coords, elevationM = null) => {
    const now = Date.now();
    const key = `weather:${coordKey(coords.latitude, coords.longitude)}:${elevationM ?? 'auto'}`;
    let result: WeatherForecast;
    try {
      const cached = await getCached(
        key,
        CACHE_TTL.weather,
        () => fetchOpenMeteoForecast(coords, { elevation: elevationM, now }),
        now,
      );
      result = cached.value;
    } catch {
      // Ağ yoksa deterministik yerel tahmine düş (mock sağlayıcı ile aynı davranış).
      const elev = elevationM ?? (await nearestKnownElevation(coords, 15));
      result = mockForecast(coords, MOCK_SEED, now, elev);
    }
    result.alerts = computeAlerts(result);
    return result;
  };

  return {
    forecast,

    async elevation(points) {
      if (points.length === 0) return [];
      const key = `elevation:${points.map((p) => coordKey(p.latitude, p.longitude, 4)).join(';')}`;
      try {
        const cached = await getCached(key, CACHE_TTL.elevation, () =>
          fetchOpenMeteoElevation(points),
        );
        return cached.value;
      } catch {
        return await Promise.all(points.map((p) => nearestKnownElevation(p)));
      }
    },

    async avalanche(coords) {
      const region = eawsRegionFor(coords);
      if (!region) return null;
      // Önce veritabanındaki güncel bülten; yoksa EAWS kaynağı.
      const row = await maybeRow(
        db
          .from('avalanche_bulletins')
          .select('*')
          .eq('region_code', region.code)
          .gte('valid_to', new Date().toISOString())
          .order('valid_from', { ascending: false }),
        'çığ bülteni okunamadı',
        { limit: 1 },
      );
      if (row) return toAvalancheBulletin(row);
      if (region.official && region.caamlUrl) {
        try {
          const cached = await getCached(
            `avalanche:${region.code}`,
            CACHE_TTL.avalanche,
            () => fetchEawsBulletin(region.code),
            Date.now(),
          );
          return cached.value;
        } catch {
          // resmî kaynak okunamadı → yerel tahminden üretilen bülten
        }
      }
      // Mock sağlayıcı ile aynı: tahminden türetilmiş bülten.
      return mockAvalanche(coords, Date.now(), await forecast(coords));
    },
  };
}
