import {
  canManage,
  canRsvp,
  clubBadgeFor,
  clubXpForEvent,
  eventCapacityLeft,
  filterClubs,
  isStudentEmail,
  membershipOf,
  rankClubs,
  rsvpBlocker,
  seasonLabel,
  universityFromEmail,
  upcomingEvents,
} from '../clubs';
import type { Club, ClubEvent, ClubMember } from '../types';

const club = (o: Partial<Club>): Club => ({
  id: 'c',
  name: 'Kulüp',
  university: 'Üni',
  city: 'İstanbul',
  countryCode: 'TR',
  description: '',
  logoUrl: null,
  coverUrl: null,
  adventureTypes: ['hiking'],
  memberCount: 10,
  foundedYear: 2000,
  isVerified: true,
  seasonXp: 100,
  contactEmail: null,
  instagram: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  ...o,
});

const NOW = new Date('2026-09-05T12:00:00.000Z').getTime();

const event = (o: Partial<ClubEvent>): ClubEvent => ({
  id: 'e',
  clubId: 'c',
  title: 'Etkinlik',
  kind: 'trip',
  adventureType: 'hiking',
  description: '',
  locationName: '',
  coords: null,
  startsAt: new Date(NOW + 86_400_000).toISOString(),
  endsAt: new Date(NOW + 2 * 86_400_000).toISOString(),
  capacity: 10,
  attendeeCount: 5,
  openToAll: true,
  priceTry: 0,
  ...o,
});

describe('filterClubs', () => {
  const clubs = [
    club({
      id: 'metu',
      name: 'ODTÜ Dağcılık',
      university: 'ODTÜ',
      city: 'Ankara',
      adventureTypes: ['climbing'],
    }),
    club({ id: 'itu', name: 'İTÜ Dağcılık Kulübü', university: 'İTÜ', city: 'İstanbul' }),
    club({ id: 'eth', name: 'AACZ', university: 'ETH Zürich', city: 'Zürich', countryCode: 'CH' }),
  ];

  it('metin araması ad, üniversite ve şehirde, Türkçe karakterden bağımsız', () => {
    expect(filterClubs(clubs, { query: 'odtu' }).map((c) => c.id)).toEqual(['metu']);
    expect(filterClubs(clubs, { query: 'İSTANBUL' }).map((c) => c.id)).toEqual(['itu']);
    expect(filterClubs(clubs, { query: 'zurich' }).map((c) => c.id)).toEqual(['eth']);
  });

  it('şehir, tür ve ülke filtreleri', () => {
    expect(filterClubs(clubs, { city: 'Ankara' }).map((c) => c.id)).toEqual(['metu']);
    expect(filterClubs(clubs, { adventureType: 'climbing' }).map((c) => c.id)).toEqual(['metu']);
    expect(filterClubs(clubs, { countryCode: 'CH' }).map((c) => c.id)).toEqual(['eth']);
    expect(filterClubs(clubs, {})).toHaveLength(3);
  });
});

describe('rankClubs & clubBadgeFor', () => {
  it('seasonXp azalan, eşitlikte memberCount', () => {
    const ranked = rankClubs([
      club({ id: 'a', seasonXp: 100, memberCount: 5 }),
      club({ id: 'b', seasonXp: 300, memberCount: 1 }),
      club({ id: 'c', seasonXp: 100, memberCount: 50 }),
    ]);
    expect(ranked.map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('madalyalar yalnızca ilk üçe', () => {
    expect(clubBadgeFor(1)).toBe('gold');
    expect(clubBadgeFor(2)).toBe('silver');
    expect(clubBadgeFor(3)).toBe('bronze');
    expect(clubBadgeFor(4)).toBeNull();
  });
});

describe('membershipOf & canManage', () => {
  const members: ClubMember[] = [
    { clubId: 'c', userId: 'u1', role: 'president', joinedAt: '2025-01-01T00:00:00.000Z' },
    { clubId: 'c', userId: 'u2', role: 'member', joinedAt: '' },
  ];

  it('joinedAt boş → requested; dolu → member; yok → none', () => {
    expect(membershipOf(members, 'c', 'u1')).toEqual({ status: 'member', role: 'president' });
    expect(membershipOf(members, 'c', 'u2')).toEqual({ status: 'requested', role: null });
    expect(membershipOf(members, 'c', 'u3')).toEqual({ status: 'none', role: null });
    expect(membershipOf(members, 'other', 'u1').status).toBe('none');
  });

  it('officer ve president yönetebilir', () => {
    expect(canManage('president')).toBe(true);
    expect(canManage('officer')).toBe(true);
    expect(canManage('member')).toBe(false);
    expect(canManage(null)).toBe(false);
  });
});

describe('etkinlikler', () => {
  it('upcomingEvents bitmemişleri başlangıca göre sıralar', () => {
    const list = [
      event({
        id: 'late',
        startsAt: new Date(NOW + 5 * 86_400_000).toISOString(),
        endsAt: new Date(NOW + 6 * 86_400_000).toISOString(),
      }),
      event({
        id: 'past',
        startsAt: new Date(NOW - 5 * 86_400_000).toISOString(),
        endsAt: new Date(NOW - 4 * 86_400_000).toISOString(),
      }),
      event({ id: 'soon' }),
    ];
    expect(upcomingEvents(list, NOW).map((e) => e.id)).toEqual(['soon', 'late']);
  });

  it('eventCapacityLeft', () => {
    expect(eventCapacityLeft(event({ capacity: 10, attendeeCount: 7 }))).toBe(3);
    expect(eventCapacityLeft(event({ capacity: 10, attendeeCount: 12 }))).toBe(0);
    expect(eventCapacityLeft(event({ capacity: null }))).toBeNull();
  });

  it('canRsvp: kapasite, üye olmayan, geçmiş', () => {
    expect(canRsvp(event({}), 'none', NOW)).toBe(true);
    expect(rsvpBlocker(event({ capacity: 5, attendeeCount: 5 }), 'member', NOW)).toBe('full');
    expect(rsvpBlocker(event({ openToAll: false }), 'none', NOW)).toBe('members_only');
    expect(rsvpBlocker(event({ openToAll: false }), 'requested', NOW)).toBe('members_only');
    expect(canRsvp(event({ openToAll: false }), 'member', NOW)).toBe(true);
    expect(
      rsvpBlocker(
        event({
          startsAt: new Date(NOW - 3 * 86_400_000).toISOString(),
          endsAt: new Date(NOW - 2 * 86_400_000).toISOString(),
        }),
        'member',
        NOW,
      ),
    ).toBe('past');
    // RSVP vermiş kullanıcı dolu etkinlikte iptal edebilir
    expect(canRsvp(event({ capacity: 5, attendeeCount: 5 }), 'member', NOW, true)).toBe(true);
  });

  it('clubXpForEvent katılımcı × tür puanı', () => {
    expect(clubXpForEvent(event({ kind: 'trip', attendeeCount: 10 }))).toBe(400);
    expect(clubXpForEvent(event({ kind: 'social', attendeeCount: 3 }))).toBe(30);
    expect(clubXpForEvent(event({ kind: 'competition', attendeeCount: 0 }))).toBe(0);
  });
});

describe('öğrenci doğrulama', () => {
  it('isStudentEmail kalıpları', () => {
    expect(isStudentEmail('deniz@metu.edu.tr')).toBe(true);
    expect(isStudentEmail('deniz@ceng.metu.edu.tr')).toBe(true);
    expect(isStudentEmail('a@sabanciuniv.edu')).toBe(true);
    expect(isStudentEmail('a@ed.ac.uk')).toBe(true);
    expect(isStudentEmail('a@u-tokyo.ac.jp')).toBe(true);
    expect(isStudentEmail('a@uni-heidelberg.de')).toBe(true);
    expect(isStudentEmail('a@student.ethz.ch')).toBe(true);
    expect(isStudentEmail('a@gmail.com')).toBe(false);
    expect(isStudentEmail('a@edu.com')).toBe(false);
    expect(isStudentEmail('gecersiz')).toBe(false);
    expect(isStudentEmail('a@')).toBe(false);
  });

  it('universityFromEmail sözlük, alt alan adı ve fallback', () => {
    expect(universityFromEmail('deniz@metu.edu.tr')).toBe('ODTÜ');
    expect(universityFromEmail('deniz@ceng.metu.edu.tr')).toBe('ODTÜ');
    expect(universityFromEmail('a@boun.edu.tr')).toBe('Boğaziçi Üniversitesi');
    expect(universityFromEmail('a@sabanciuniv.edu')).toBe('Sabancı Üniversitesi');
    expect(universityFromEmail('a@ED.AC.UK')).toBe('University of Edinburgh');
    expect(universityFromEmail('a@ogr.koc.edu.tr')).toBe('Koc Üniversitesi');
    expect(universityFromEmail('a@uni-bonn.de')).toBe('Bonn University');
    expect(universityFromEmail('a@gmail.com')).toBeNull();
  });
});

describe('seasonLabel', () => {
  it('güz / bahar / yaz ve Ocak önceki yılın güzü', () => {
    expect(seasonLabel(new Date('2026-09-05T00:00:00Z'))).toBe('2026 Güz');
    expect(seasonLabel(new Date('2027-01-10T00:00:00Z'))).toBe('2026 Güz');
    expect(seasonLabel(new Date('2026-03-10T00:00:00Z'))).toBe('2026 Bahar');
    expect(seasonLabel(new Date('2026-07-10T00:00:00Z'), 'en')).toBe('Summer 2026');
  });
});
