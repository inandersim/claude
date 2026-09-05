/**
 * Güven skoru hesaplaması.
 * Skor 0–100 arasındadır ve dört bileşenden oluşur:
 *  - doğrulanmış hesap (sabit bonus)
 *  - doğrulanmış veri içeren gönderi oranı
 *  - tamamlanan (kabul edilmiş) eşleşme sayısı
 *  - topluluk etkileşimi (takipçi)
 */
export interface TrustInputs {
  isVerified: boolean;
  totalPosts: number;
  verifiedPosts: number;
  acceptedMatches: number;
  followersCount: number;
}

export function computeTrustScore(input: TrustInputs): number {
  const verifiedBonus = input.isVerified ? 25 : 0;

  const verifiedRatio = input.totalPosts === 0 ? 0 : input.verifiedPosts / input.totalPosts;
  const postScore = Math.round(verifiedRatio * 30);

  const matchScore = Math.min(25, input.acceptedMatches * 5);

  const communityScore = Math.min(20, Math.round(Math.log10(input.followersCount + 1) * 8));

  return clamp(verifiedBonus + postScore + matchScore + communityScore, 0, 100);
}

export type TrustTier = 'low' | 'medium' | 'high' | 'elite';

export function trustTier(score: number): TrustTier {
  if (score >= 85) return 'elite';
  if (score >= 65) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
