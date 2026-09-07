import {
  dayKey,
  fromGeoLine,
  fromGeoPoint,
  iso,
  num,
  parseDateRange,
  parseEwkbPoint,
  strArray,
  toDateRange,
  toGeoPoint,
  toGroupMember,
  toPost,
  toUser,
} from '@/data/remote/mappers';

describe('uzak eşleyiciler', () => {
  it('PostGIS EWKB noktasını çözer', () => {
    // SRID=4326;POINT(28.9784 41.0082)
    const hex = '0101000020E61000000A68226C78FA3C40E2E995B20C814440';
    const point = parseEwkbPoint(hex);
    expect(point?.longitude).toBeCloseTo(28.9784, 6);
    expect(point?.latitude).toBeCloseTo(41.0082, 6);
  });

  it('GeoJSON, WKT ve nesne biçimlerini kabul eder', () => {
    expect(toGeoPoint({ type: 'Point', coordinates: [30, 40] })).toEqual({
      latitude: 40,
      longitude: 30,
    });
    expect(toGeoPoint('SRID=4326;POINT(30 40)')).toEqual({ latitude: 40, longitude: 30 });
    expect(toGeoPoint({ lat: 1, lng: 2 })).toEqual({ latitude: 1, longitude: 2 });
    expect(toGeoPoint(null)).toBeNull();
    expect(toGeoPoint('saçmalık')).toBeNull();
  });

  it('domain noktasını PostGIS metnine çevirir', () => {
    expect(fromGeoPoint({ latitude: 41, longitude: 29 })).toBe('SRID=4326;POINT(29 41)');
    expect(fromGeoPoint(null)).toBeNull();
    expect(
      fromGeoLine([
        { latitude: 41, longitude: 29 },
        { latitude: 42, longitude: 30 },
      ]),
    ).toBe('SRID=4326;LINESTRING(29 41,30 42)');
    expect(fromGeoLine([{ latitude: 41, longitude: 29 }])).toBeNull();
  });

  it('zaman damgalarını tek biçime indirger', () => {
    expect(iso('2026-09-06T10:00:00+00:00')).toBe('2026-09-06T10:00:00.000Z');
    expect(iso(new Date('2026-09-06T10:00:00Z'))).toBe('2026-09-06T10:00:00.000Z');
    expect(iso('2026-09-06')).toBe('2026-09-06T00:00:00.000Z');
    expect(dayKey('2026-09-06T10:00:00Z')).toBe('2026-09-06');
  });

  it('numeric sütunlarını sayıya çevirir (metin ya da sayı)', () => {
    expect(num('12.50')).toBe(12.5);
    expect(num(7)).toBe(7);
    expect(num(null, 3)).toBe(3);
    expect(num('abc', 1)).toBe(1);
  });

  it('Postgres dizi metnini ayrıştırır', () => {
    expect(strArray('{hiking,climbing}')).toEqual(['hiking', 'climbing']);
    expect(strArray(['a', 'b'])).toEqual(['a', 'b']);
    expect(strArray(null)).toEqual([]);
  });

  it('daterange biçimini çevirir', () => {
    expect(parseDateRange('[2031-05-01,2031-05-04)')).toEqual({
      from: '2031-05-01',
      to: '2031-05-04',
    });
    expect(toDateRange('2031-05-01T14:00:00Z', '2031-05-04T11:00:00Z')).toBe(
      '[2031-05-01,2031-05-04)',
    );
  });

  it('profil satırını User\'a çevirir (acil kişiler gömülü)', () => {
    const user = toUser({
      id: 'u1',
      username: 'deniz',
      display_name: 'Deniz',
      bio: '',
      location_name: 'İstanbul',
      coords: 'SRID=4326;POINT(29 41)',
      is_verified: true,
      total_distance_km: '120.5',
      favorite_types: '{hiking,climbing}',
      plan: 'pro',
      emergency_contacts: [
        { name: 'B', phone: '2', contact_user_id: null, position: 1 },
        { name: 'A', phone: '1', contact_user_id: 'u2', position: 0 },
      ],
    });
    expect(user.coords).toEqual({ latitude: 41, longitude: 29 });
    expect(user.totalDistanceKm).toBe(120.5);
    expect(user.favoriteTypes).toEqual(['hiking', 'climbing']);
    expect(user.emergencyContacts.map((c) => c.name)).toEqual(['A', 'B']);
    expect(user.plan).toBe('pro');
  });

  it("bazal nabzı okur; sütun boşsa null verir", () => {
    const withBaseline = toUser({ id: 'u1', username: 'deniz', baseline_resting_hr: 54 });
    expect(withBaseline.baselineRestingHr).toBe(54);
    // Sütun boşken 0 dönmemeli: 0 bpm geçerli bir bazal gibi görünür ve nabız
    // sapması hesabında sıfıra bölme üretir.
    expect(toUser({ id: 'u1', username: 'deniz' }).baselineRestingHr).toBeNull();
    expect(toUser({ id: 'u1', username: 'deniz', baseline_resting_hr: null }).baselineRestingHr).toBeNull();
  });

  it('gönderi satırını Post\'a çevirir', () => {
    const post = toPost({
      id: 'p1',
      author_id: 'u1',
      caption: 'merhaba',
      adventure_type: 'hiking',
      difficulty: 'easy',
      trail_condition: 'good',
      likes_count: 3,
      hashtags: ['zirtan'],
      coords: 'SRID=4326;POINT(29 41)',
      created_at: '2026-09-06T10:00:00Z',
    });
    expect(post.likesCount).toBe(3);
    expect(post.hashtags).toEqual(['zirtan']);
    expect(post.createdAt).toBe('2026-09-06T10:00:00.000Z');
  });

  it('bekleyen grup davetini mock ile aynı biçimde temsil eder', () => {
    const pending = toGroupMember({ group_id: 'g', user_id: 'u', role: 'member', joined_at: null });
    expect(pending.joinedAt).toBe('');
    const joined = toGroupMember({
      group_id: 'g',
      user_id: 'u',
      role: 'member',
      joined_at: '2026-09-06T10:00:00Z',
    });
    expect(joined.joinedAt).toBe('2026-09-06T10:00:00.000Z');
  });
});
