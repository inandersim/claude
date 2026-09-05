import {
  findMatchCandidates,
  isAcceptedPlan,
  isIncomingRequest,
  isOutgoingRequest,
  otherPartyId,
} from '../matching';
import type { User, ZMatch } from '../types';

const baseUser = (overrides: Partial<User>): User => ({
  id: 'x',
  username: 'x',
  displayName: 'X',
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
  ...overrides,
});

const me = baseUser({ id: 'me', favoriteTypes: ['hiking', 'climbing'] });
const near = baseUser({
  id: 'near',
  coords: { latitude: 41.01, longitude: 29.01 },
  favoriteTypes: ['hiking', 'diving'],
});
const far = baseUser({ id: 'far', coords: { latitude: 36.2, longitude: 29.6 } });
const unverified = baseUser({
  id: 'unverified',
  isVerified: false,
  coords: { latitude: 41.001, longitude: 29.001 },
});
const climber = baseUser({
  id: 'climber',
  coords: { latitude: 41.02, longitude: 29.02 },
  favoriteTypes: ['climbing'],
});

const match = (overrides: Partial<ZMatch>): ZMatch => ({
  id: 'm',
  requesterId: 'me',
  receiverId: 'near',
  status: 'pending',
  message: '',
  plannedDate: null,
  locationName: null,
  adventureType: 'hiking',
  createdAt: '2025-01-01T00:00:00.000Z',
  respondedAt: null,
  ...overrides,
});

describe('findMatchCandidates', () => {
  const origin = me.coords;
  const users = [me, near, far, unverified, climber];

  it('kendini, doğrulanmamışları ve yarıçap dışındakileri eler', () => {
    const result = findMatchCandidates({ me, origin, users, matches: [], radiusKm: 50 });
    expect(result.map((c) => c.user.id)).toEqual(['near', 'climber']);
  });

  it('mesafeye göre artan sıralar', () => {
    const result = findMatchCandidates({ me, origin, users, radiusKm: 1000, matches: [] });
    const distances = result.map((c) => c.distanceKm);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('ortak ilgi alanlarını hesaplar', () => {
    const [first] = findMatchCandidates({ me, origin, users, radiusKm: 50, matches: [] });
    expect(first?.user.id).toBe('near');
    expect(first?.sharedTypes).toEqual(['hiking']);
  });

  it('bekleyen istek varsa adayı korur ama işaretler', () => {
    const pending = match({ status: 'pending' });
    const result = findMatchCandidates({ me, origin, users, radiusKm: 50, matches: [pending] });
    const near1 = result.find((c) => c.user.id === 'near');
    expect(near1?.existingMatch?.id).toBe('m');
  });

  it('kabul edilmiş veya reddedilmiş eşleşmesi olanları listelemez', () => {
    const accepted = match({ status: 'accepted' });
    const result = findMatchCandidates({ me, origin, users, radiusKm: 50, matches: [accepted] });
    expect(result.map((c) => c.user.id)).not.toContain('near');
  });

  it('macera türü filtresi uygular', () => {
    const result = findMatchCandidates({
      me,
      origin,
      users,
      radiusKm: 50,
      matches: [],
      adventureType: 'climbing',
    });
    expect(result.map((c) => c.user.id)).toEqual(['climber']);
  });

  it('verifiedOnly=false ile doğrulanmamışları da içerir', () => {
    const result = findMatchCandidates({
      me,
      origin,
      users,
      radiusKm: 50,
      matches: [],
      verifiedOnly: false,
    });
    expect(result.map((c) => c.user.id)).toContain('unverified');
  });
});

describe('eşleşme yardımcıları', () => {
  it('gelen / giden / plan ayrımını yapar', () => {
    const incoming = match({ requesterId: 'near', receiverId: 'me' });
    const outgoing = match({ requesterId: 'me', receiverId: 'near' });
    const plan = match({ status: 'accepted' });
    expect(isIncomingRequest(incoming, 'me')).toBe(true);
    expect(isOutgoingRequest(incoming, 'me')).toBe(false);
    expect(isOutgoingRequest(outgoing, 'me')).toBe(true);
    expect(isAcceptedPlan(plan, 'me')).toBe(true);
    expect(isAcceptedPlan(plan, 'stranger')).toBe(false);
  });

  it('karşı tarafı döner', () => {
    expect(otherPartyId(match({}), 'me')).toBe('near');
    expect(otherPartyId(match({}), 'near')).toBe('me');
  });
});
