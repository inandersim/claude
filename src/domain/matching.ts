import type { AdventureType } from './enums';
import { distanceKm } from './geo';
import type { GeoPoint, MatchCandidate, User, ZMatch } from './types';

export interface FindCandidatesOptions {
  /** Oturum açmış kullanıcı */
  me: User;
  /** Aramanın merkezi (kullanıcının gerçek konumu veya varsayılan) */
  origin: GeoPoint;
  users: User[];
  matches: ZMatch[];
  radiusKm: number;
  /** Yalnızca doğrulanmış kullanıcılar gösterilsin mi */
  verifiedOnly?: boolean;
  adventureType?: AdventureType | null;
}

/**
 * ZMatch adaylarını üretir.
 * Kurallar:
 *  - Kullanıcının kendisi listelenmez.
 *  - Varsayılan olarak yalnızca doğrulanmış kullanıcılar gösterilir.
 *  - Reddedilmiş veya kabul edilmiş bir eşleşme varsa aday listeden çıkar.
 *  - Bekleyen istek varsa aday listede kalır ama "istek gönderildi" olarak işaretlenir.
 *  - Sonuç mesafeye göre artan, eşitlikte ortak ilgi sayısına göre azalan sıralanır.
 */
export function findMatchCandidates(options: FindCandidatesOptions): MatchCandidate[] {
  const { me, origin, users, matches, radiusKm, verifiedOnly = true, adventureType } = options;

  const candidates: MatchCandidate[] = [];

  for (const user of users) {
    if (user.id === me.id) continue;
    if (verifiedOnly && !user.isVerified) continue;

    const existing = matches.find(
      (m) =>
        (m.requesterId === me.id && m.receiverId === user.id) ||
        (m.requesterId === user.id && m.receiverId === me.id),
    );
    if (existing && existing.status !== 'pending') continue;

    const distance = distanceKm(origin, user.coords);
    if (distance > radiusKm) continue;

    const sharedTypes = user.favoriteTypes.filter((type) => me.favoriteTypes.includes(type));
    if (adventureType && !user.favoriteTypes.includes(adventureType)) continue;

    candidates.push({
      user,
      distanceKm: distance,
      sharedTypes,
      existingMatch: existing ?? null,
    });
  }

  return candidates.sort((a, b) => {
    if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    return b.sharedTypes.length - a.sharedTypes.length;
  });
}

export function isIncomingRequest(match: ZMatch, meId: string): boolean {
  return match.receiverId === meId && match.status === 'pending';
}

export function isOutgoingRequest(match: ZMatch, meId: string): boolean {
  return match.requesterId === meId && match.status === 'pending';
}

export function isAcceptedPlan(match: ZMatch, meId: string): boolean {
  return match.status === 'accepted' && (match.requesterId === meId || match.receiverId === meId);
}

/** Eşleşmedeki "diğer" kullanıcının kimliğini döner. */
export function otherPartyId(match: ZMatch, meId: string): string {
  return match.requesterId === meId ? match.receiverId : match.requesterId;
}
