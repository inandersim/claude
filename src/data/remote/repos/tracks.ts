import {
  buildNavigation,
  clusterTracks,
  detectAdventureType,
  distanceKm,
  filterTracks,
  maskStart,
  nearbyPois,
  parseGpxTrack,
  poisAlong,
  poisFromMedia,
  simplifyTrack,
  statusFor,
  trackStats,
  trackToGraph,
  type CommunityTrail,
  type CommunityTrailWithDetails,
  type GeoPoint,
  type ID,
  type Track,
  type TrackPoi,
  type TrackPoiWithDistance,
  type TrackWithUser,
  type User,
  uuidV4,
} from '@/domain';

import type { TrackRepository } from '../../repositories';
import {
  fetchUsers,
  kuyrukluYaz,
  notifyMany,
  pickUser,
  requireUser,
  type RemoteContext,
} from '../context';
import {
  fromGeoPoint,
  toCommunityTrail,
  toLiveStream,
  toPost,
  toGeoPoint,
  toStory,
  toTrack,
  toTrackPoi,
} from '../mappers';
import { maybeRow, oneRow, rows, type Row } from '../postgrest';

/** Yayınlanan parçaların kümelenmesi için ızgara hücresi (m) */
const CLUSTER_CELL_M = 30;
/** Yakın rota listesi için varsayılan yarıçap (km) */
const DEFAULT_TRAIL_RADIUS_KM = 150;

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/** tracks modülü uzak repository fabrikası. */
export function createTrackRepository(ctx: RemoteContext): TrackRepository {
  const { db } = ctx;

  const findTrack = async (id: ID): Promise<Track> => {
    const row = await maybeRow(db.from('tracks').select('*').eq('id', id), 'parça okunamadı');
    if (!row) throw new Error('Parça bulunamadı');
    return toTrack(row);
  };

  const findTrail = async (id: ID): Promise<CommunityTrail> => {
    const row = await maybeRow(
      db.from('community_trails').select('*').eq('id', id),
      'topluluk rotası okunamadı',
    );
    if (!row) throw new Error('Topluluk rotası bulunamadı');
    return toCommunityTrail(row);
  };

  const allTracks = async (): Promise<Track[]> => {
    const data = await rows(db.from('tracks').select('*'), 'parçalar okunamadı');
    return data.map(toTrack);
  };

  const allPois = async (): Promise<TrackPoi[]> => {
    const data = await rows(db.from('track_pois').select('*'), 'noktalar okunamadı');
    return data.map(toTrackPoi);
  };

  const confirmedPoiIds = async (meId: ID): Promise<Set<ID>> => {
    const data = await rows(
      db.from('poi_confirmations').select('poi_id').eq('user_id', meId),
      'onaylar okunamadı',
    );
    return new Set(data.map((row) => String(row.poi_id)));
  };

  const withUserMany = async (
    tracks: Track[],
    origin: GeoPoint | null,
  ): Promise<TrackWithUser[]> => {
    if (!tracks.length) return [];
    const users = await fetchUsers(db, tracks.map((t) => t.userId));
    const trailIds = tracks.map((t) => t.communityTrailId).filter((id): id is ID => Boolean(id));
    const trailRows = trailIds.length
      ? await rows(
          db.from('community_trails').select('*').in('id', trailIds),
          'topluluk rotaları okunamadı',
        )
      : [];
    const trails = new Map(trailRows.map((row) => [String(row.id), toCommunityTrail(row)]));
    const poiRows = await rows(
      db.from('track_pois').select('track_id').in('track_id', tracks.map((t) => t.id)),
      'noktalar okunamadı',
    );
    return tracks.map((track) => {
      const start = track.points[0];
      return {
        ...track,
        status: statusFor(track, track.communityTrailId ? (trails.get(track.communityTrailId) ?? null) : null),
        user: pickUser(users, track.userId),
        distanceFromMeKm: origin && start ? round(distanceKm(origin, start), 1) : null,
        poiCount: poiRows.filter((row) => String(row.track_id) === track.id).length,
      };
    });
  };

  const decoratePois = async (
    pois: TrackPoi[],
    meId: ID | null,
    origin: GeoPoint | null,
  ): Promise<TrackPoi[]> => {
    if (!meId) return pois;
    const confirmed = await confirmedPoiIds(meId);
    return pois.map<TrackPoiWithDistance>((p) => ({
      ...p,
      distanceKm: origin ? round(distanceKm(origin, p.coords)) : null,
      confirmedByMe: confirmed.has(p.id),
    }));
  };

  const trailPois = async (trail: CommunityTrail): Promise<TrackPoi[]> => {
    const trackRows = await rows(
      db.from('tracks').select('id').eq('community_trail_id', trail.id),
      'parçalar okunamadı',
    );
    const trackIds = new Set(trackRows.map((row) => String(row.id)));
    const pois = await allPois();
    const direct = pois.filter(
      (p) => p.communityTrailId === trail.id || (p.trackId && trackIds.has(p.trackId)),
    );
    const seen = new Set(direct.map((p) => p.id));
    // Rota koridorundaki bağımsız POI'ler (medya kaynaklı vb.)
    const corridor = poisAlong(
      trail.points,
      pois.filter((p) => !seen.has(p.id)),
    );
    return [...direct, ...corridor];
  };

  const withDetails = async (
    trail: CommunityTrail,
    origin: GeoPoint | null,
    meId: ID | null = null,
  ): Promise<CommunityTrailWithDetails> => {
    const trackRows = await rows(
      db.from('tracks').select('user_id').eq('community_trail_id', trail.id),
      'parçalar okunamadı',
    );
    const contributorIds = Array.from(new Set(trackRows.map((row) => String(row.user_id))));
    const users = await fetchUsers(db, contributorIds);
    const contributors = contributorIds
      .map((id) => users.get(id))
      .filter((u): u is User => Boolean(u));
    const start = trail.points[0];
    return {
      ...trail,
      // Detay ekranında POI mesafesi gösterilmez; yalnızca "benim onayım" taşınır.
      pois: await decoratePois(await trailPois(trail), meId, null),
      distanceFromMeKm: origin && start ? round(distanceKm(origin, start), 1) : null,
      contributors,
    };
  };

  /**
   * Yayınlanan parçalardan topluluk rotalarını yeniden türetir. Mevcut rota
   * kimlikleri ve doğrulama sayıları korunur; parçası kalmayan rotalar silinir.
   */
  const rebuild = async (): Promise<CommunityTrail[]> => {
    const now = new Date().toISOString();
    const tracks = await allTracks();
    const existingRows = await rows(
      db.from('community_trails').select('*'),
      'topluluk rotaları okunamadı',
    );
    const existing = existingRows.map(toCommunityTrail);
    const published = tracks.filter((t) => t.status !== 'draft' && t.isPublic);
    const clusters = clusterTracks(published, { cellM: CLUSTER_CELL_M, now });
    const usedIds = new Set<ID>();
    const next: CommunityTrail[] = [];
    const memberships = new Map<ID, ID>();

    for (const cluster of clusters) {
      const members = tracks.filter((t) => cluster.trackIds.includes(t.id));
      const match = existing.find(
        (ct) => !usedIds.has(ct.id) && members.some((m) => m.communityTrailId === ct.id),
      );
      const id = match?.id ?? cluster.trail.id;
      usedIds.add(id);
      next.push({
        ...cluster.trail,
        id,
        name: match?.name ?? cluster.trail.name,
        verifiedCount: match?.verifiedCount ?? 0,
        createdAt: match?.createdAt ?? now,
        updatedAt: now,
      });
      for (const m of members) memberships.set(m.id, id);
    }

    const nextIds = new Set(next.map((ct) => ct.id));
    // Yazma: önce bağları çöz, sonra rotaları güncelle/ekle, sonra artıkları sil.
    await rows(
      db
        .from('tracks')
        .update({ community_trail_id: null })
        .not('community_trail_id', 'is', null),
      'parça bağları çözülemedi',
    );
    if (next.length) {
      await rows(
        db.from('community_trails').upsert(
          next.map((ct) => ({
            id: ct.id,
            name: ct.name,
            adventure_type: ct.adventureType,
            points: ct.points,
            distance_km: ct.distanceKm,
            ascent_m: ct.ascentM,
            descent_m: ct.descentM,
            track_count: ct.trackCount,
            verified_count: ct.verifiedCount,
            popularity: ct.popularity,
            region_name: ct.regionName,
            country_code: ct.countryCode,
            bbox: ct.bbox,
            updated_at: ct.updatedAt,
          })),
          { onConflict: 'id' },
        ),
        'topluluk rotaları yazılamadı',
      );
    }
    const stale = existing.filter((ct) => !nextIds.has(ct.id)).map((ct) => ct.id);
    if (stale.length) {
      await rows(
        db.from('community_trails').delete().in('id', stale),
        'eski rotalar silinemedi',
      );
    }
    for (const [trackId, trailId] of memberships) {
      await rows(
        db.from('tracks').update({ community_trail_id: trailId }).eq('id', trackId),
        'parça bağı yazılamadı',
      );
    }
    // POI'lerin rota bağı sahibi parçadan devralınır.
    const pois = await allPois();
    for (const poi of pois) {
      const owner = poi.trackId ? memberships.get(poi.trackId) ?? null : null;
      const nextTrail = owner ?? (poi.communityTrailId && nextIds.has(poi.communityTrailId) ? poi.communityTrailId : null);
      if (nextTrail !== poi.communityTrailId) {
        await rows(
          db.from('track_pois').update({ community_trail_id: nextTrail }).eq('id', poi.id),
          'nokta bağı güncellenemedi',
        );
      }
    }
    return next;
  };

  const save: TrackRepository['save'] = async (meId, input) => {
    await requireUser(db, meId);
    const name = input.name.trim();
    if (!name) throw new Error('Parça adı boş olamaz');
    if (input.points.length < 2) throw new Error('Parça en az iki nokta içermeli');
    const rawStats = trackStats(input.points);
    const masked = input.isPublic ? maskStart(input.points) : input.points;
    const points = simplifyTrack(masked);
    const stats = trackStats(points);
    const now = new Date().toISOString();
    const firstT = input.points.find((p) => p.t !== null)?.t ?? null;
    // `tracks_sync_path` tetikleyicisi geometriyi points alanından üretir.
    const created = await oneRow(
      db
        .from('tracks')
        .insert({
          user_id: meId,
          name,
          adventure_type: input.adventureType,
          source: input.source,
          status: 'draft',
          points,
          distance_km: stats.distanceKm,
          ascent_m: stats.ascentM,
          descent_m: stats.descentM,
          duration_min: rawStats.durationMin,
          max_elevation_m: stats.maxElevationM,
          min_elevation_m: stats.minElevationM,
          started_at: firstT !== null ? new Date(firstT).toISOString() : now,
          region_name: input.regionName.trim() || '—',
          country_code: 'TR',
          is_public: input.isPublic,
        })
        .select('*'),
      'parça kaydedilemedi',
    );
    const track = toTrack(created);
    if (input.pois.length) {
      await rows(
        db.from('track_pois').insert(
          input.pois.map((p) => ({
            track_id: track.id,
            community_trail_id: null,
            user_id: meId,
            kind: p.kind,
            coords: fromGeoPoint(p.coords),
            elevation_m: p.elevationM,
            name: p.name,
            note: p.note,
            photo_url: p.photoUrl,
            source: p.source,
            media_id: p.mediaId,
          })),
        ),
        'noktalar kaydedilemedi',
      );
    }
    const [result] = await withUserMany([track], null);
    if (!result) throw new Error('Parça bulunamadı');
    return result;
  };

  return {
    save,

    async list(meId, filter) {
      const origin = filter.origin ?? null;
      const tracks = filterTracks(await allTracks(), filter, meId);
      const enriched = await withUserMany(tracks, origin);
      return enriched.sort((a, b) => {
        if (origin && a.distanceFromMeKm !== null && b.distanceFromMeKm !== null) {
          return a.distanceFromMeKm - b.distanceFromMeKm;
        }
        return b.createdAt.localeCompare(a.createdAt);
      });
    },

    async getById(meId, id) {
      const row = await maybeRow(db.from('tracks').select('*').eq('id', id), 'parça okunamadı');
      if (!row) return null;
      const track = toTrack(row);
      if (!track.isPublic && track.userId !== meId) return null;
      const me = await maybeRow(
        db.from('profiles').select('coords').eq('id', meId),
        'profil okunamadı',
      );
      const origin = me ? (toGeoPoint(me.coords) ?? null) : null;
      const [enriched] = await withUserMany([track], origin);
      if (!enriched) return null;
      const poiRows = await rows(
        db.from('track_pois').select('*').eq('track_id', id),
        'noktalar okunamadı',
      );
      return { ...enriched, pois: await decoratePois(poiRows.map(toTrackPoi), meId, null) };
    },

    async importGpx(meId, gpxXml, source, name) {
      const parsed = parseGpxTrack(gpxXml);
      if (parsed.points.length < 2) throw new Error('GPX en az iki iz noktası içermeli');
      const stats = trackStats(parsed.points);
      const trackName =
        name?.trim() || parsed.name || `GPX ${new Date().toLocaleDateString('tr-TR')}`;
      return await save(meId, {
        name: trackName,
        adventureType: detectAdventureType(parsed.points, stats),
        points: parsed.points,
        source,
        isPublic: false,
        regionName: '',
        pois: parsed.waypoints.map((w) => ({
          kind: w.kind,
          coords: w.coords,
          elevationM: w.elevationM,
          name: w.name,
          note: w.description,
          photoUrl: null,
          source: 'track',
          mediaId: null,
        })),
      });
    },

    async publish(meId, trackId) {
      const track = await findTrack(trackId);
      if (track.userId !== meId) throw new Error('Yalnızca kendi parçanı yayınlayabilirsin');
      if (track.status === 'draft') {
        const patch: Record<string, unknown> = { status: 'published', is_public: true };
        if (!track.isPublic) {
          const points = simplifyTrack(maskStart(track.points));
          const stats = trackStats(points);
          patch.points = points;
          patch.distance_km = stats.distanceKm;
          patch.ascent_m = stats.ascentM;
          patch.descent_m = stats.descentM;
        }
        // `award_track_xp` tetikleyicisi yayınlanmada rota XP'si verir.
        await rows(db.from('tracks').update(patch).eq('id', trackId), 'parça yayınlanamadı');
      }
      await rebuild();
      const [result] = await withUserMany([await findTrack(trackId)], null);
      if (!result) throw new Error('Parça bulunamadı');
      return result;
    },

    async remove(meId, trackId) {
      const track = await findTrack(trackId);
      if (track.userId !== meId) throw new Error('Yalnızca kendi parçanı silebilirsin');
      const hadTrail = Boolean(track.communityTrailId);
      await rows(db.from('tracks').delete().eq('id', trackId), 'parça silinemedi');
      if (hadTrail) await rebuild();
    },

    async communityTrails(meId, origin, radiusKm) {
      const radius = radiusKm ?? DEFAULT_TRAIL_RADIUS_KM;
      const data = await rows(
        db.from('community_trails').select('*'),
        'topluluk rotaları okunamadı',
      );
      const out: CommunityTrailWithDetails[] = [];
      for (const row of data) out.push(await withDetails(toCommunityTrail(row), origin));
      return out
        .filter((t) => !origin || t.distanceFromMeKm === null || t.distanceFromMeKm <= radius)
        .sort((a, b) => {
          if (origin && a.distanceFromMeKm !== null && b.distanceFromMeKm !== null) {
            return a.distanceFromMeKm - b.distanceFromMeKm;
          }
          return b.popularity - a.popularity;
        });
    },

    async communityTrail(meId, id) {
      const row = await maybeRow(
        db.from('community_trails').select('*').eq('id', id),
        'topluluk rotası okunamadı',
      );
      if (!row) return null;
      const me = await maybeRow(
        db.from('profiles').select('coords').eq('id', meId),
        'profil okunamadı',
      );
      return await withDetails(toCommunityTrail(row), me ? toGeoPoint(me.coords) : null, meId);
    },

    async verifyTrail(meId, id) {
      const me = await requireUser(db, meId);
      const trail = await findTrail(id);
      const already = await maybeRow(
        db.from('trail_verifications').select('trail_id').eq('user_id', meId).eq('trail_id', id),
        'doğrulama okunamadı',
      );
      if (already) throw new Error('Bu rotayı zaten doğruladın');
      // `trail_verifications_count` tetikleyicisi verified_count değerini artırır.
      await rows(
        db.from('trail_verifications').insert({ user_id: meId, trail_id: id }),
        'rota doğrulanamadı',
      );
      await rows(
        db
          .from('community_trails')
          .update({ popularity: trail.popularity + 1, updated_at: new Date().toISOString() })
          .eq('id', id),
        'popülerlik güncellenemedi',
      );
      const contributorRows = await rows(
        db.from('tracks').select('user_id').eq('community_trail_id', id).neq('user_id', meId),
        'katkıda bulunanlar okunamadı',
      );
      await notifyMany(
        db,
        contributorRows.map((row) => String(row.user_id)),
        {
          type: 'hazard_confirmed',
          senderId: meId,
          message: `${me.displayName}, "${trail.name}" rotasını yürüyüp doğruladı.`,
          postId: null,
          matchId: null,
          targetId: id,
        },
      );
      return await withDetails(await findTrail(id), me.coords, meId);
    },

    async rebuildCommunityTrails() {
      return await rebuild();
    },

    async poisNear(meId, origin, radiusKm, kind) {
      return nearbyPois(await allPois(), origin, radiusKm, kind ?? null, await confirmedPoiIds(meId));
    },

    async addPoi(meId, input) {
      await requireUser(db, meId);
      const name = input.name.trim();
      if (!name) throw new Error('Nokta adı boş olamaz');
      let communityTrailId = input.communityTrailId;
      if (input.trackId) {
        const owner = await maybeRow(
          db.from('tracks').select('community_trail_id').eq('id', input.trackId),
          'parça okunamadı',
        );
        if (owner) {
          communityTrailId = owner.community_trail_id ? String(owner.community_trail_id) : null;
        }
      }
      // Kimlik **istemcide** üretilir. Sebebi: bu yazma ağ yokken kuyruğa
      // alınabiliyor ve kuyruğa alınan bir yazma sunucudan satır döndüremez.
      // İstemci kimliği verince ekrana dönen nesne ile sonradan yazılacak
      // satır aynı olur; `id` sütununun `gen_random_uuid()` varsayılanı da
      // verilen değeri ezmez.
      const id = uuidV4();
      const satir = {
        id,
        track_id: input.trackId,
        community_trail_id: communityTrailId,
        user_id: meId,
        kind: input.kind,
        coords: fromGeoPoint(input.coords),
        elevation_m: input.elevationM,
        name,
        note: input.note.trim(),
        photo_url: input.photoUrl,
        source: input.source,
        media_id: input.mediaId,
      };

      // Patikada çeşme işaretleyen kişi tam da sinyalin olmadığı yerdedir.
      // Ağ hatasında kayıt kuyruğa alınır; bağlantı gelince gönderilir.
      let yazilan: Row | null = null;
      await kuyrukluYaz(
        ctx,
        async () => {
          yazilan = await oneRow(
            db.from('track_pois').insert(satir).select('*'),
            'nokta eklenemedi',
          );
        },
        () => ({ kind: 'insert', target: 'track_pois', payload: satir }),
      );

      // Kuyruğa alındıysa sunucudan satır gelmez; istemci kimliğiyle aynı
      // nesne kurulur — kullanıcı noktasını haritada hemen görür ve bağlantı
      // gelince aynı kayıt sunucuya gider.
      return toTrackPoi(
        yazilan ?? { ...satir, confirmations: 0, created_at: new Date().toISOString() },
      );
    },

    async confirmPoi(meId, poiId) {
      const me = await requireUser(db, meId);
      const row = await maybeRow(db.from('track_pois').select('*').eq('id', poiId), 'nokta okunamadı');
      if (!row) throw new Error('Nokta bulunamadı');
      const poi = toTrackPoi(row);
      const already = await maybeRow(
        db.from('poi_confirmations').select('poi_id').eq('user_id', meId).eq('poi_id', poiId),
        'onay okunamadı',
      );
      if (already) throw new Error('Bu noktayı zaten onayladın');
      // `poi_confirmations_count` tetikleyicisi sayacı artırır.
      await rows(
        db.from('poi_confirmations').insert({ user_id: meId, poi_id: poiId }),
        'nokta onaylanamadı',
      );
      if (poi.userId !== meId) {
        await notifyMany(db, [poi.userId], {
          type: 'hazard_confirmed',
          senderId: meId,
          message: `${me.displayName}, "${poi.name}" noktanı onayladı.`,
          postId: null,
          matchId: null,
          targetId: poiId,
        });
      }
      const fresh = await oneRow(db.from('track_pois').select('*').eq('id', poiId), 'nokta okunamadı');
      return {
        ...toTrackPoi(fresh),
        distanceKm: round(distanceKm(me.coords, poi.coords)),
        confirmedByMe: true,
      };
    },

    async suggestedPoisFromMedia(meId, origin) {
      const [storyRows, streamRows, postRows, pois] = await Promise.all([
        rows(db.from('stories').select('*'), 'anlar okunamadı'),
        rows(db.from('live_streams').select('*'), 'yayınlar okunamadı'),
        rows(db.from('posts').select('*'), 'gönderiler okunamadı'),
        allPois(),
      ]);
      const suggestions = poisFromMedia(
        storyRows.map(toStory),
        streamRows.map(toLiveStream),
        postRows.map(toPost),
        pois,
        { preferUserId: meId, limit: 12 },
      );
      if (!origin) return suggestions;
      return suggestions
        .map((p) => ({ p, d: distanceKm(origin, p.coords) }))
        .sort((a, b) => {
          const pa = a.p.userId === meId ? 0 : 1;
          const pb = b.p.userId === meId ? 0 : 1;
          return pa - pb || a.d - b.d;
        })
        .map((x) => x.p);
    },

    async navigation(id, kind) {
      if (kind === 'community') {
        const trail = await findTrail(id);
        return buildNavigation(trail.points, await trailPois(trail));
      }
      const track = await findTrack(id);
      const own = (
        await rows(db.from('track_pois').select('*').eq('track_id', id), 'noktalar okunamadı')
      ).map(toTrackPoi);
      const seen = new Set(own.map((p) => p.id));
      const corridor = poisAlong(
        track.points,
        (await allPois()).filter((p) => !seen.has(p.id)),
      );
      return buildNavigation(track.points, [...own, ...corridor]);
    },

    async toGraph(id) {
      const trailRow = await maybeRow(
        db.from('community_trails').select('*').eq('id', id),
        'topluluk rotası okunamadı',
      );
      if (trailRow) return trackToGraph(toCommunityTrail(trailRow));
      const trackRow = await maybeRow(db.from('tracks').select('*').eq('id', id), 'parça okunamadı');
      if (!trackRow) throw new Error('Rota bulunamadı');
      return trackToGraph(toTrack(trackRow));
    },
  };
}
