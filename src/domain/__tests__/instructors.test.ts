import { nextRating, rankInstructors } from '../instructors';
import type { Instructor, User } from '../types';

const user = (id: string, name: string): User => ({
  id,
  username: id,
  displayName: name,
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
  trustScore: 80,
  favoriteTypes: ['hiking'],
  joinedAt: '2025-01-01T00:00:00.000Z',
});

const instructor = (o: Partial<Instructor>): Instructor => ({
  id: 'i',
  userId: 'u',
  headline: '',
  bio: '',
  specialties: ['hiking'],
  certifications: [],
  rating: 4.5,
  reviewCount: 10,
  pricePerSessionTry: 1000,
  sessionDurationMin: 120,
  languages: ['Türkçe'],
  yearsExperience: 5,
  locationName: 'İstanbul',
  coords: { latitude: 41, longitude: 29 },
  availableDays: [6],
  studentsCount: 10,
  ...o,
});

const users = [user('u1', 'Can Yıldırım'), user('u2', 'Zeynep Aksoy'), user('u3', 'Elif Doğan')];
const list = [
  instructor({
    id: 'a',
    userId: 'u1',
    specialties: ['climbing'],
    rating: 4.9,
    reviewCount: 100,
    pricePerSessionTry: 1500,
    coords: { latitude: 36.9, longitude: 30.5 },
    certifications: ['TDF Antrenör'],
  }),
  instructor({
    id: 'b',
    userId: 'u2',
    specialties: ['diving'],
    rating: 5.0,
    reviewCount: 50,
    pricePerSessionTry: 2400,
    coords: { latitude: 36.2, longitude: 29.6 },
  }),
  instructor({
    id: 'c',
    userId: 'u3',
    specialties: ['hiking'],
    rating: 4.9,
    reviewCount: 140,
    pricePerSessionTry: 900,
    coords: { latitude: 41.04, longitude: 29.0 },
  }),
  instructor({ id: 'orphan', userId: 'missing' }),
];
const origin = { latitude: 41, longitude: 29 };

describe('rankInstructors', () => {
  it('kullanıcısı olmayan kayıtları atar; varsayılan puan sıralaması (eşitlikte yorum sayısı)', () => {
    expect(
      rankInstructors({ instructors: list, users, origin }).map((r) => r.instructor.id),
    ).toEqual(['b', 'c', 'a']);
  });
  it('mesafeye göre sıralar', () => {
    expect(
      rankInstructors({ instructors: list, users, origin, filter: { sortBy: 'distance' } }).map(
        (r) => r.instructor.id,
      ),
    ).toEqual(['c', 'a', 'b']);
  });
  it('fiyata göre sıralar', () => {
    expect(
      rankInstructors({ instructors: list, users, origin, filter: { sortBy: 'price' } }).map(
        (r) => r.instructor.id,
      ),
    ).toEqual(['c', 'a', 'b']);
  });
  it('tür filtresi ve metin araması uygular', () => {
    expect(
      rankInstructors({
        instructors: list,
        users,
        origin,
        filter: { adventureType: 'diving' },
      }).map((r) => r.instructor.id),
    ).toEqual(['b']);
    expect(
      rankInstructors({ instructors: list, users, origin, filter: { query: 'tdf' } }).map(
        (r) => r.instructor.id,
      ),
    ).toEqual(['a']);
    expect(
      rankInstructors({ instructors: list, users, origin, filter: { query: 'zeynep' } }).map(
        (r) => r.instructor.id,
      ),
    ).toEqual(['b']);
  });
});

describe('nextRating', () => {
  it('ağırlıklı ortalamayı bir ondalıkla döner', () => {
    expect(nextRating(4.5, 10, 5)).toBe(4.5);
    expect(nextRating(4.0, 1, 5)).toBe(4.5);
    expect(nextRating(5, 0, 3)).toBe(3);
  });
});
