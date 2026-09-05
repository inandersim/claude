import { activeShares, expiresAtFor, visibleShares } from '../presence';
import type { LocationShare, User } from '../types';

const user = (id: string): User => ({
  id,
  username: id,
  displayName: id,
  avatarUrl: null,
  coverUrl: null,
  bio: '',
  locationName: '',
  coords: { latitude: 41, longitude: 29 },
  isVerified: true,
  totalDistanceKm: 0,
  totalAdventures: 0,
  followersCount: 0,
  followingCount: 0,
  trustScore: 50,
  favoriteTypes: ['hiking'],
  joinedAt: '2025-01-01T00:00:00.000Z',
  plan: 'free',
  emergencyContacts: [],
});
const now = new Date('2026-09-05T12:00:00.000Z');
const share = (o: Partial<LocationShare>): LocationShare => ({
  userId: 'x',
  coords: { latitude: 41.01, longitude: 29.01 },
  mode: 'friends',
  startedAt: '2026-09-05T11:00:00.000Z',
  expiresAt: '2026-09-05T15:00:00.000Z',
  updatedAt: '2026-09-05T11:58:00.000Z',
  batteryPct: null,
  altitudeM: null,
  speedKmh: null,
  ...o,
});

describe('activeShares', () => {
  it('süresi dolanları eler, süresizleri tutar', () => {
    const list = [
      share({ userId: 'a' }),
      share({ userId: 'b', expiresAt: '2026-09-05T11:00:00.000Z' }),
      share({ userId: 'c', expiresAt: null }),
    ];
    expect(activeShares(list, now).map((s) => s.userId)).toEqual(['a', 'c']);
  });
});

describe('visibleShares', () => {
  const users = [user('me'), user('friend'), user('match'), user('stranger'), user('sos')];
  const shares = [
    share({ userId: 'friend', mode: 'friends' }),
    share({ userId: 'match', mode: 'matches', coords: { latitude: 41.1, longitude: 29.1 } }),
    share({ userId: 'stranger', mode: 'friends' }),
    share({
      userId: 'sos',
      mode: 'sos',
      coords: { latitude: 42, longitude: 30 },
      updatedAt: '2026-09-05T11:00:00.000Z',
    }),
    share({ userId: 'me', mode: 'friends' }),
  ];
  const result = visibleShares({
    meId: 'me',
    origin: { latitude: 41, longitude: 29 },
    shares,
    users,
    friendIds: new Set(['friend']),
    matchIds: new Set(['match']),
    now,
  });

  it('yalnızca yetkili grupları ve SOS’u gösterir; kendini hariç tutar', () => {
    expect(result.map((s) => s.userId)).toEqual(['sos', 'friend', 'match']);
  });
  it('SOS önce, sonra mesafe; 15 dk’dan eski güncellemeler stale', () => {
    expect(result[0]?.isStale).toBe(true);
    expect(result[1]?.isStale).toBe(false);
    expect(result[1]!.distanceKm!).toBeLessThan(result[2]!.distanceKm!);
  });
});

describe('expiresAtFor', () => {
  it('dakikayı ISO bitişe çevirir; null → süresiz', () => {
    expect(expiresAtFor(60, now)).toBe('2026-09-05T13:00:00.000Z');
    expect(expiresAtFor(null, now)).toBeNull();
  });
});
