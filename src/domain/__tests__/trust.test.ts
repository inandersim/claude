import { computeTrustScore, trustTier } from '../trust';

describe('computeTrustScore', () => {
  it('boş profil için 0 döner', () => {
    expect(
      computeTrustScore({
        isVerified: false,
        totalPosts: 0,
        verifiedPosts: 0,
        acceptedMatches: 0,
        followersCount: 0,
      }),
    ).toBe(0);
  });

  it('doğrulanmış hesaba sabit bonus verir', () => {
    expect(
      computeTrustScore({
        isVerified: true,
        totalPosts: 0,
        verifiedPosts: 0,
        acceptedMatches: 0,
        followersCount: 0,
      }),
    ).toBe(25);
  });

  it('tüm bileşenler dolu olduğunda 100 ile sınırlar', () => {
    expect(
      computeTrustScore({
        isVerified: true,
        totalPosts: 10,
        verifiedPosts: 10,
        acceptedMatches: 20,
        followersCount: 100_000,
      }),
    ).toBe(100);
  });

  it('doğrulanmış gönderi oranına göre puan verir', () => {
    const half = computeTrustScore({
      isVerified: false,
      totalPosts: 10,
      verifiedPosts: 5,
      acceptedMatches: 0,
      followersCount: 0,
    });
    const full = computeTrustScore({
      isVerified: false,
      totalPosts: 10,
      verifiedPosts: 10,
      acceptedMatches: 0,
      followersCount: 0,
    });
    expect(half).toBe(15);
    expect(full).toBe(30);
  });

  it('kabul edilen eşleşmeleri 25 ile sınırlar', () => {
    const score = computeTrustScore({
      isVerified: false,
      totalPosts: 0,
      verifiedPosts: 0,
      acceptedMatches: 50,
      followersCount: 0,
    });
    expect(score).toBe(25);
  });
});

describe('trustTier', () => {
  it.each([
    [0, 'low'],
    [39, 'low'],
    [40, 'medium'],
    [64, 'medium'],
    [65, 'high'],
    [84, 'high'],
    [85, 'elite'],
    [100, 'elite'],
  ])('%i → %s', (score, tier) => {
    expect(trustTier(score)).toBe(tier);
  });
});
