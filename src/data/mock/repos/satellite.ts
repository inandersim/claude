import { generateId } from '@/core/utils/format';
import type { SatelliteRepository } from '@/data/repositories';
import {
  advanceSosStage,
  buildSosPayload,
  encodeSatMessage,
  isSosActive,
  nearestCenters,
  prioritize,
  queuePolicy,
  sosTimelineNote,
  type LinkStatus,
  type LinkType,
  type SatMessage,
  type SosSession,
  type SosStage,
} from '@/domain';

import type { MockContext } from '../context';

/** Bağlantı türüne göre simüle edilen durum */
const LINK_PRESETS: Record<LinkType, Omit<LinkStatus, 'link'>> = {
  cellular: { signal: 72, satellitesInView: 0, estimatedLatencyS: 1 },
  wifi: { signal: 88, satellitesInView: 0, estimatedLatencyS: 1 },
  satellite: { signal: 46, satellitesInView: 3, estimatedLatencyS: 90 },
  none: { signal: 0, satellitesInView: 0, estimatedLatencyS: 0 },
};

/** Gönderildikten sonra "iletildi" durumuna geçiş süresi (ms) */
const DELIVERY_DELAY_MS = 1500;

/** satellite modülü mock repository fabrikası. */
export function createSatelliteRepository(ctx: MockContext): SatelliteRepository {
  /** Bellek içi bağlantı simülasyonu (kalıcı değil; uygulama açılışında hücresel) */
  let currentLink: LinkStatus = { link: 'cellular', ...LINK_PRESETS.cellular };

  /** Gönderilen mesajı kısa süre sonra iletildi olarak işaretler. */
  const scheduleDelivery = (messageId: string) => {
    const timer = setTimeout(async () => {
      const t = await ctx.db.load();
      const m = t.satMessages.find((x) => x.id === messageId);
      if (!m || m.status !== 'sent') return;
      m.status = 'delivered';
      m.deliveredAt = new Date().toISOString();
      ctx.db.markDirty();
    }, DELIVERY_DELAY_MS);
    // Node/Jest'te süreci açık tutmasın
    if (typeof timer === 'object' && timer && 'unref' in timer) timer.unref();
  };

  /** Kullanıcının o anki bağlantıda kullanacağı cihaz (uydu ise en dolu pil, değilse null) */
  const pickDevice = (t: Awaited<ReturnType<MockContext['db']['load']>>, meId: string) => {
    if (currentLink.link !== 'satellite') return null;
    const devices = t.satDevices.filter((d) => d.userId === meId);
    return devices.sort((a, b) => (b.batteryPct ?? 0) - (a.batteryPct ?? 0))[0] ?? null;
  };

  /** Kuyruk kararını uygular; mesaj nesnesini yerinde günceller. */
  const attempt = (
    t: Awaited<ReturnType<MockContext['db']['load']>>,
    m: SatMessage,
    meId: string,
  ) => {
    const decision = queuePolicy(m, currentLink.link, m.attempts);
    m.link = currentLink.link;
    if (decision === 'send') {
      m.attempts += 1;
      m.status = 'sent';
      const device = pickDevice(t, meId);
      if (device) {
        m.deviceId = device.id;
        device.usedThisMonth += 1;
        device.lastSeenAt = new Date().toISOString();
      }
      scheduleDelivery(m.id);
    } else if (decision === 'fail') {
      m.status = 'failed';
    } else {
      m.attempts += 1;
      m.status = 'queued';
    }
  };

  const activeSession = (sessions: SosSession[], meId: string) =>
    sessions.find((s) => s.userId === meId && isSosActive(s.stage)) ?? null;

  const pushStage = (session: SosSession, stage: SosStage) => {
    const at = new Date().toISOString();
    session.stage = stage;
    session.updatedAt = at;
    session.timeline.push({ stage, at, note: sosTimelineNote(stage, 'tr') });
  };

  const resolveSosEvent = (
    t: Awaited<ReturnType<MockContext['db']['load']>>,
    session: SosSession,
  ) => {
    const ev = t.sosEvents.find((e) => e.id === session.id);
    if (ev && !ev.resolvedAt) ev.resolvedAt = new Date().toISOString();
    // Uydu SOS'u ile başlatılan canlı SOS paylaşımını da kapat
    t.shares = t.shares.filter((s) => !(s.userId === session.userId && s.mode === 'sos'));
  };

  return {
    async devices(meId) {
      await ctx.wait();
      const t = await ctx.db.load();
      return t.satDevices
        .filter((d) => d.userId === meId)
        .sort((a, b) => b.pairedAt.localeCompare(a.pairedAt));
    },

    async pair(meId, input) {
      await ctx.wait();
      const t = await ctx.db.load();
      ctx.requireUser(t.users, meId);
      const name = input.name.trim();
      if (!name) throw new Error('Cihaz adı gerekli');
      if (input.imei && !/^\d{15}$/.test(input.imei)) throw new Error('IMEI 15 haneli olmalı');
      const now = new Date().toISOString();
      const quota: Record<typeof input.type, number> = {
        inreach: 40,
        zoleo: 25,
        spot: 20,
        phone_satellite: 0,
        starlink_mini: 0,
      };
      const device = {
        id: generateId('sd'),
        userId: meId,
        type: input.type,
        name,
        imei: input.imei || null,
        batteryPct: input.type === 'starlink_mini' ? null : 100,
        pairedAt: now,
        lastSeenAt: now,
        monthlyQuota: quota[input.type],
        usedThisMonth: 0,
      };
      t.satDevices.unshift(device);
      ctx.db.markDirty();
      return device;
    },

    async unpair(meId, deviceId) {
      await ctx.wait();
      const t = await ctx.db.load();
      const index = t.satDevices.findIndex((d) => d.id === deviceId && d.userId === meId);
      if (index < 0) throw new Error(`Cihaz bulunamadı: ${deviceId}`);
      t.satDevices.splice(index, 1);
      ctx.db.markDirty();
    },

    async linkStatus() {
      // Küçük sinyal dalgalanması — canlı hissi
      const jitter = currentLink.link === 'none' ? 0 : Math.round((Math.random() - 0.5) * 6);
      return { ...currentLink, signal: Math.max(1, Math.min(100, currentLink.signal + jitter)) };
    },

    async setLink(_meId, link) {
      currentLink = { link, ...LINK_PRESETS[link] };
      return currentLink;
    },

    async messages(meId) {
      await ctx.wait();
      const t = await ctx.db.load();
      const mine = t.satMessages.filter((m) => m.userId === meId);
      const pending = prioritize(
        mine.filter((m) => m.status === 'queued' || m.status === 'sending'),
      );
      const rest = mine
        .filter((m) => m.status !== 'queued' && m.status !== 'sending')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return [...pending, ...rest];
    },

    async send(meId, input) {
      await ctx.wait();
      const t = await ctx.db.load();
      const me = ctx.requireUser(t.users, meId);
      const body = encodeSatMessage(input, new Date());
      const message: SatMessage = {
        id: generateId('sm'),
        userId: meId,
        deviceId: null,
        kind: input.kind,
        body,
        coords: input.coords,
        toContacts: input.toContacts.length
          ? input.toContacts
          : me.emergencyContacts.map((c) => c.phone),
        status: 'queued',
        link: currentLink.link,
        createdAt: new Date().toISOString(),
        deliveredAt: null,
        attempts: 0,
      };
      attempt(t, message, meId);
      t.satMessages.unshift(message);
      ctx.db.markDirty();
      return message;
    },

    async flush(meId) {
      await ctx.wait();
      const t = await ctx.db.load();
      const pending = prioritize(
        t.satMessages.filter(
          (m) =>
            m.userId === meId &&
            (m.status === 'queued' || m.status === 'sending' || m.status === 'failed'),
        ),
      );
      const attempted: SatMessage[] = [];
      for (const m of pending) {
        if (m.status === 'failed' && queuePolicy(m, currentLink.link, m.attempts) === 'fail') {
          continue; // kalıcı başarısız — yeniden denenmez
        }
        attempt(t, m, meId);
        attempted.push(m);
      }
      if (attempted.length) ctx.db.markDirty();
      return attempted;
    },

    async sos(meId) {
      await ctx.wait();
      const t = await ctx.db.load();
      return activeSession(t.sosSessions, meId);
    },

    async startSos(meId, coords) {
      await ctx.wait();
      const t = await ctx.db.load();
      const me = ctx.requireUser(t.users, meId);
      if (activeSession(t.sosSessions, meId)) throw new Error('Zaten aktif bir SOS var');
      if (currentLink.link === 'none') throw new Error('Bağlantı yok — SOS gönderilemedi');

      const nearest = nearestCenters(t.emergencyCenters, coords, {
        limit: 1,
        types: ['mountain_rescue', 'ambulance'],
      })[0];
      const startedAt = new Date().toISOString();
      const session: SosSession = {
        id: generateId('sos'),
        userId: meId,
        stage: 'idle',
        coords,
        startedAt,
        updatedAt: startedAt,
        timeline: [],
        rescueCenterId: nearest?.id ?? null,
        link: currentLink.link,
      };
      pushStage(session, 'armed');
      pushStage(session, 'sent');
      t.sosSessions.unshift(session);

      // Uydu üzerinden giden SOS yükü mesaj geçmişinde de görünür
      const payload = buildSosPayload(me, coords, me.emergencyContacts);
      const message: SatMessage = {
        id: generateId('sm'),
        userId: meId,
        deviceId: pickDevice(t, meId)?.id ?? null,
        kind: 'sos',
        body: payload,
        coords,
        toContacts: me.emergencyContacts.map((c) => c.phone),
        status: 'sent',
        link: currentLink.link,
        createdAt: startedAt,
        deliveredAt: null,
        attempts: 1,
      };
      t.satMessages.unshift(message);
      scheduleDelivery(message.id);

      // Genel SOS olay kaydı + canlı SOS konum paylaşımı (ilk yardım ekranıyla uyumlu)
      t.sosEvents.unshift({
        id: session.id,
        userId: meId,
        coords,
        createdAt: startedAt,
        resolvedAt: null,
        notifiedContacts: me.emergencyContacts.length,
      });
      t.shares = t.shares.filter((s) => s.userId !== meId);
      t.shares.push({
        userId: meId,
        coords,
        mode: 'sos',
        startedAt,
        expiresAt: null,
        updatedAt: startedAt,
        batteryPct: null,
        altitudeM: null,
        speedKmh: null,
      });
      ctx.db.markDirty();

      for (const c of me.emergencyContacts) {
        if (!c.userId) continue;
        await ctx.pushNotification({
          type: 'sos_alert',
          senderId: meId,
          receiverId: c.userId,
          message: `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)} (uydu)`,
          postId: null,
          matchId: null,
          targetId: session.id,
        });
      }
      return session;
    },

    async advanceSos(meId) {
      await ctx.wait();
      const t = await ctx.db.load();
      const session = activeSession(t.sosSessions, meId);
      if (!session) throw new Error('Aktif SOS yok');
      pushStage(session, advanceSosStage(session.stage));
      if (session.stage === 'resolved') resolveSosEvent(t, session);
      ctx.db.markDirty();
      return session;
    },

    async cancelSos(meId) {
      await ctx.wait();
      const t = await ctx.db.load();
      const session = activeSession(t.sosSessions, meId);
      if (!session) return;
      const at = new Date().toISOString();
      session.stage = 'resolved';
      session.updatedAt = at;
      session.timeline.push({ stage: 'resolved', at, note: 'Kullanıcı iptal etti (yanlış alarm)' });
      resolveSosEvent(t, session);
      ctx.db.markDirty();
    },
  };
}
