import { generateId } from '@/core/utils/format';
import type { TrackRepository } from '@/data/repositories';
import type {
  CommunityTrail,
  CommunityTrailWithDetails,
  GeoPoint,
  ID,
  Track,
  TrackPoi,
  TrackPoiWithDistance,
  TrackWithUser,
  User,
} from '@/domain';
import { distanceKm } from '@/domain/geo';
import {
  buildNavigation,
  clusterTracks,
  detectAdventureType,
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
} from '@/domain/tracks';

import type { MockContext } from '../context';
import type { Tables } from '../database';

/** Yayınlanan parçaların kümelenmesi için ızgara hücresi (m) */
const CLUSTER_CELL_M = 30;
/** Yakın rota listesi için varsayılan yarıçap (km) */
const DEFAULT_TRAIL_RADIUS_KM = 150;

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/** tracks modülü mock repository fabrikası. */
export function createTrackRepository(ctx: MockContext): TrackRepository {
  const findTrack = (t: Tables, id: ID): Track => {
    const track = t.tracks.find((x) => x.id === id);
    if (!track) throw new Error('Parça bulunamadı');
    return track;
  };

  const findTrail = (t: Tables, id: ID): CommunityTrail => {
    const trail = t.communityTrails.find((x) => x.id === id);
    if (!trail) throw new Error('Topluluk rotası bulunamadı');
    return trail;
  };

  const trailOf = (t: Tables, track: Track): CommunityTrail | null =>
    track.communityTrailId
      ? (t.communityTrails.find((x) => x.id === track.communityTrailId) ?? null)
      : null;

  const withUser = (t: Tables, track: Track, origin: GeoPoint | null): TrackWithUser => {
    const user = ctx.requireUser(t.users, track.userId);
    const start = track.points[0];
    return {
      ...track,
      status: statusFor(track, trailOf(t, track)),
      user,
      distanceFromMeKm: origin && start ? round(distanceKm(origin, start), 1) : null,
      poiCount: t.trackPois.filter((p) => p.trackId === track.id).length,
    };
  };

  const trailPois = (t: Tables, trail: CommunityTrail): TrackPoi[] => {
    const trackIds = new Set(
      t.tracks.filter((x) => x.communityTrailId === trail.id).map((x) => x.id),
    );
    const direct = t.trackPois.filter(
      (p) => p.communityTrailId === trail.id || (p.trackId && trackIds.has(p.trackId)),
    );
    const seen = new Set(direct.map((p) => p.id));
    // Rota koridorundaki bağımsız POI'ler (medya kaynaklı vb.)
    const corridor = poisAlong(
      trail.points,
      t.trackPois.filter((p) => !seen.has(p.id)),
    );
    return [...direct, ...corridor];
  };

  /** POI listesini mesafe ve "benim onayım" bilgisiyle zenginleştirir. */
  const decoratePois = (
    t: Tables,
    pois: TrackPoi[],
    meId: ID | null,
    origin: GeoPoint | null,
  ): TrackPoi[] => {
    if (!meId) return pois;
    const decorated: TrackPoiWithDistance[] = pois.map((p) => withDistance(t, p, meId, origin));
    return decorated;
  };

  const withDetails = (
    t: Tables,
    trail: CommunityTrail,
    origin: GeoPoint | null,
    meId: ID | null = null,
  ): CommunityTrailWithDetails => {
    const contributorIds = new Set(
      t.tracks.filter((x) => x.communityTrailId === trail.id).map((x) => x.userId),
    );
    const contributors: User[] = [];
    for (const id of contributorIds) {
      const user = t.users.find((u) => u.id === id);
      if (user) contributors.push(user);
    }
    const start = trail.points[0];
    return {
      ...trail,
      // Detay ekranında POI mesafesi gösterilmez; yalnızca "benim onayım" bilgisi taşınır
      pois: decoratePois(t, trailPois(t, trail), meId, null),
      distanceFromMeKm: origin && start ? round(distanceKm(origin, start), 1) : null,
      contributors,
    };
  };

  const withDistance = (
    t: Tables,
    poi: TrackPoi,
    meId: ID,
    origin: GeoPoint | null,
  ): TrackPoiWithDistance => ({
    ...poi,
    distanceKm: origin ? round(distanceKm(origin, poi.coords)) : null,
    confirmedByMe: t.poiConfirmations.some((c) => c.userId === meId && c.poiId === poi.id),
  });

  /**
   * Yayınlanan parçalardan topluluk rotalarını yeniden türetir. Mevcut rota id'leri ve
   * doğrulama sayıları korunur; parçası kalmayan rotalar kaldırılır.
   */
  const rebuild = (t: Tables): CommunityTrail[] => {
    const now = new Date().toISOString();
    const published = t.tracks.filter((x) => x.status !== 'draft' && x.isPublic);
    const clusters = clusterTracks(published, { cellM: CLUSTER_CELL_M, now });
    const next: CommunityTrail[] = [];
    const usedIds = new Set<ID>();

    for (const cluster of clusters) {
      const members = t.tracks.filter((x) => cluster.trackIds.includes(x.id));
      const existing = t.communityTrails.find(
        (ct) => !usedIds.has(ct.id) && members.some((m) => m.communityTrailId === ct.id),
      );
      const id = existing?.id ?? generateId('ct');
      usedIds.add(id);
      next.push({
        ...cluster.trail,
        id,
        name: existing?.name ?? cluster.trail.name,
        verifiedCount: existing?.verifiedCount ?? 0,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      for (const m of members) m.communityTrailId = id;
    }

    const nextIds = new Set(next.map((ct) => ct.id));
    for (const track of t.tracks) {
      if (track.communityTrailId && !nextIds.has(track.communityTrailId))
        track.communityTrailId = null;
    }
    for (const poi of t.trackPois) {
      if (poi.communityTrailId && !nextIds.has(poi.communityTrailId)) poi.communityTrailId = null;
      const owner = poi.trackId ? t.tracks.find((x) => x.id === poi.trackId) : null;
      if (owner) poi.communityTrailId = owner.communityTrailId;
    }
    t.trailVerifications = t.trailVerifications.filter((v) => nextIds.has(v.trailId));
    t.communityTrails = next;
    ctx.db.markDirty();
    return next;
  };

  const save: TrackRepository['save'] = async (meId, input) => {
    await ctx.wait();
    const t = await ctx.db.load();
    ctx.requireUser(t.users, meId);
    const name = input.name.trim();
    if (!name) throw new Error('Parça adı boş olamaz');
    if (input.points.length < 2) throw new Error('Parça en az iki nokta içermeli');
    const rawStats = trackStats(input.points);
    const masked = input.isPublic ? maskStart(input.points) : input.points;
    const points = simplifyTrack(masked);
    const stats = trackStats(points);
    const now = new Date().toISOString();
    const firstT = input.points.find((p) => p.t !== null)?.t ?? null;
    const track: Track = {
      id: generateId('trk'),
      userId: meId,
      name,
      adventureType: input.adventureType,
      source: input.source,
      status: 'draft',
      points,
      distanceKm: stats.distanceKm,
      ascentM: stats.ascentM,
      descentM: stats.descentM,
      durationMin: rawStats.durationMin,
      maxElevationM: stats.maxElevationM,
      startedAt: firstT !== null ? new Date(firstT).toISOString() : now,
      regionName: input.regionName.trim() || '—',
      countryCode: 'TR',
      isPublic: input.isPublic,
      likesCount: 0,
      communityTrailId: null,
      createdAt: now,
    };
    t.tracks.unshift(track);
    for (const p of input.pois) {
      t.trackPois.push({
        ...p,
        id: generateId('poi'),
        trackId: track.id,
        communityTrailId: null,
        userId: meId,
        confirmations: 0,
        createdAt: now,
      });
    }
    ctx.db.markDirty();
    return withUser(t, track, null);
  };

  return {
    save,

    async list(meId, filter) {
      await ctx.wait();
      const t = await ctx.db.load();
      const origin = filter.origin ?? null;
      return filterTracks(t.tracks, filter, meId)
        .map((track) => withUser(t, track, origin))
        .sort((a, b) => {
          if (origin && a.distanceFromMeKm !== null && b.distanceFromMeKm !== null)
            return a.distanceFromMeKm - b.distanceFromMeKm;
          return b.createdAt.localeCompare(a.createdAt);
        });
    },

    async getById(meId, id) {
      await ctx.wait();
      const t = await ctx.db.load();
      const track = t.tracks.find((x) => x.id === id);
      if (!track) return null;
      if (!track.isPublic && track.userId !== meId) return null;
      const me = t.users.find((u) => u.id === meId);
      return {
        ...withUser(t, track, me?.coords ?? null),
        pois: decoratePois(
          t,
          t.trackPois.filter((p) => p.trackId === id),
          meId,
          null,
        ),
      };
    },

    async importGpx(meId, gpxXml, source, name) {
      const parsed = parseGpxTrack(gpxXml);
      if (parsed.points.length < 2) throw new Error('GPX en az iki iz noktası içermeli');
      const stats = trackStats(parsed.points);
      const trackName =
        name?.trim() || parsed.name || `GPX ${new Date().toLocaleDateString('tr-TR')}`;
      return save(meId, {
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
      await ctx.wait();
      const t = await ctx.db.load();
      const track = findTrack(t, trackId);
      if (track.userId !== meId) throw new Error('Yalnızca kendi parçanı yayınlayabilirsin');
      if (track.status === 'draft') {
        if (!track.isPublic) {
          track.points = simplifyTrack(maskStart(track.points));
          const stats = trackStats(track.points);
          track.distanceKm = stats.distanceKm;
          track.ascentM = stats.ascentM;
          track.descentM = stats.descentM;
        }
        track.status = 'published';
        track.isPublic = true;
      }
      rebuild(t);
      ctx.db.markDirty();
      return withUser(t, track, null);
    },

    async remove(meId, trackId) {
      await ctx.wait();
      const t = await ctx.db.load();
      const index = t.tracks.findIndex((x) => x.id === trackId);
      if (index === -1) throw new Error('Parça bulunamadı');
      if (t.tracks[index]!.userId !== meId) throw new Error('Yalnızca kendi parçanı silebilirsin');
      const hadTrail = Boolean(t.tracks[index]!.communityTrailId);
      t.tracks.splice(index, 1);
      const removedPoiIds = new Set(
        t.trackPois.filter((p) => p.trackId === trackId).map((p) => p.id),
      );
      t.trackPois = t.trackPois.filter((p) => !removedPoiIds.has(p.id));
      t.poiConfirmations = t.poiConfirmations.filter((c) => !removedPoiIds.has(c.poiId));
      if (hadTrail) rebuild(t);
      ctx.db.markDirty();
    },

    async communityTrails(meId, origin, radiusKm) {
      await ctx.wait();
      const t = await ctx.db.load();
      const radius = radiusKm ?? DEFAULT_TRAIL_RADIUS_KM;
      return t.communityTrails
        .map((trail) => withDetails(t, trail, origin))
        .filter(
          (trail) => !origin || trail.distanceFromMeKm === null || trail.distanceFromMeKm <= radius,
        )
        .sort((a, b) => {
          if (origin && a.distanceFromMeKm !== null && b.distanceFromMeKm !== null)
            return a.distanceFromMeKm - b.distanceFromMeKm;
          return b.popularity - a.popularity;
        });
    },

    async communityTrail(meId, id) {
      await ctx.wait();
      const t = await ctx.db.load();
      const trail = t.communityTrails.find((x) => x.id === id);
      if (!trail) return null;
      const me = t.users.find((u) => u.id === meId);
      return withDetails(t, trail, me?.coords ?? null, meId);
    },

    async verifyTrail(meId, id) {
      await ctx.wait();
      const t = await ctx.db.load();
      const me = ctx.requireUser(t.users, meId);
      const trail = findTrail(t, id);
      const already = t.trailVerifications.some((v) => v.userId === meId && v.trailId === id);
      if (already) throw new Error('Bu rotayı zaten doğruladın');
      t.trailVerifications.push({ userId: meId, trailId: id });
      trail.verifiedCount += 1;
      trail.popularity += 1;
      trail.updatedAt = new Date().toISOString();
      ctx.db.markDirty();
      const contributors = new Set(
        t.tracks.filter((x) => x.communityTrailId === id && x.userId !== meId).map((x) => x.userId),
      );
      for (const userId of contributors) {
        await ctx.pushNotification({
          type: 'hazard_confirmed',
          senderId: meId,
          receiverId: userId,
          message: `${me.displayName}, "${trail.name}" rotasını yürüyüp doğruladı.`,
          postId: null,
          matchId: null,
          targetId: id,
        });
      }
      return withDetails(t, trail, me.coords);
    },

    async rebuildCommunityTrails() {
      await ctx.wait();
      const t = await ctx.db.load();
      return rebuild(t);
    },

    async poisNear(meId, origin, radiusKm, kind) {
      await ctx.wait();
      const t = await ctx.db.load();
      const confirmed = new Set(
        t.poiConfirmations.filter((c) => c.userId === meId).map((c) => c.poiId),
      );
      return nearbyPois(t.trackPois, origin, radiusKm, kind ?? null, confirmed);
    },

    async addPoi(meId, input) {
      await ctx.wait();
      const t = await ctx.db.load();
      ctx.requireUser(t.users, meId);
      const name = input.name.trim();
      if (!name) throw new Error('Nokta adı boş olamaz');
      const poi: TrackPoi = {
        ...input,
        name,
        note: input.note.trim(),
        id: generateId('poi'),
        userId: meId,
        confirmations: 0,
        createdAt: new Date().toISOString(),
      };
      if (poi.trackId) {
        const owner = t.tracks.find((x) => x.id === poi.trackId);
        if (owner) poi.communityTrailId = owner.communityTrailId;
      }
      t.trackPois.push(poi);
      ctx.db.markDirty();
      return poi;
    },

    async confirmPoi(meId, poiId) {
      await ctx.wait();
      const t = await ctx.db.load();
      const me = ctx.requireUser(t.users, meId);
      const poi = t.trackPois.find((p) => p.id === poiId);
      if (!poi) throw new Error('Nokta bulunamadı');
      const already = t.poiConfirmations.some((c) => c.userId === meId && c.poiId === poiId);
      if (already) throw new Error('Bu noktayı zaten onayladın');
      t.poiConfirmations.push({ userId: meId, poiId });
      poi.confirmations += 1;
      ctx.db.markDirty();
      if (poi.userId !== meId) {
        await ctx.pushNotification({
          type: 'hazard_confirmed',
          senderId: meId,
          receiverId: poi.userId,
          message: `${me.displayName}, "${poi.name}" noktanı onayladı.`,
          postId: null,
          matchId: null,
          targetId: poiId,
        });
      }
      return withDistance(t, poi, meId, me.coords);
    },

    async suggestedPoisFromMedia(meId, origin) {
      await ctx.wait();
      const t = await ctx.db.load();
      const suggestions = poisFromMedia(t.stories, t.streams, t.posts, t.trackPois, {
        preferUserId: meId,
        limit: 12,
      });
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
      await ctx.wait();
      const t = await ctx.db.load();
      if (kind === 'community') {
        const trail = findTrail(t, id);
        return buildNavigation(trail.points, trailPois(t, trail));
      }
      const track = findTrack(t, id);
      const own = t.trackPois.filter((p) => p.trackId === id);
      const seen = new Set(own.map((p) => p.id));
      const corridor = poisAlong(
        track.points,
        t.trackPois.filter((p) => !seen.has(p.id)),
      );
      return buildNavigation(track.points, [...own, ...corridor]);
    },

    async toGraph(id) {
      await ctx.wait();
      const t = await ctx.db.load();
      const trail = t.communityTrails.find((x) => x.id === id) ?? t.tracks.find((x) => x.id === id);
      if (!trail) throw new Error('Rota bulunamadı');
      return trackToGraph(trail);
    },
  };
}
