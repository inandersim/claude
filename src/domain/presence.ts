import { distanceKm } from './geo';
import type { GeoPoint, LocationShare, LocationShareWithUser, User } from './types';

const STALE_AFTER_MS = 15 * 60_000;

/** Süresi dolmamış paylaşımları döner. */
export function activeShares(shares: LocationShare[], now = new Date()): LocationShare[] {
  const iso = now.toISOString();
  return shares.filter((s) => !s.expiresAt || s.expiresAt > iso);
}

/**
 * Görüntüleyen kullanıcıya görünür paylaşımlar:
 *  - friends: karşılıklı takip
 *  - matches: kabul edilmiş eşleşme
 *  - sos: acil kişiler (ve demo için herkes 50 km içinde)
 */
export function visibleShares(input: {
  meId: string;
  origin: GeoPoint | null;
  shares: LocationShare[];
  users: User[];
  friendIds: Set<string>;
  matchIds: Set<string>;
  now?: Date;
}): LocationShareWithUser[] {
  const now = input.now ?? new Date();
  const byId = new Map(input.users.map((u) => [u.id, u]));
  return activeShares(input.shares, now)
    .filter((s) => s.userId !== input.meId)
    .filter((s) => {
      if (s.mode === 'sos') return true;
      if (s.mode === 'friends') return input.friendIds.has(s.userId);
      return input.matchIds.has(s.userId);
    })
    .flatMap((s) => {
      const user = byId.get(s.userId);
      if (!user) return [];
      return [
        {
          ...s,
          user,
          distanceKm: input.origin ? distanceKm(input.origin, s.coords) : null,
          isStale: now.getTime() - new Date(s.updatedAt).getTime() > STALE_AFTER_MS,
        },
      ];
    })
    .sort((a, b) => {
      if (a.mode === 'sos' && b.mode !== 'sos') return -1;
      if (b.mode === 'sos' && a.mode !== 'sos') return 1;
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

export function expiresAtFor(durationMin: number | null, now = new Date()): string | null {
  return durationMin ? new Date(now.getTime() + durationMin * 60_000).toISOString() : null;
}
