import { distanceKm } from './geo';
import type { GeoPoint, Instructor, InstructorFilter, User } from './types';

interface RankInput {
  instructors: Instructor[];
  users: User[];
  origin: GeoPoint | null;
  filter?: InstructorFilter;
}

/**
 * Eğitmenleri filtreler ve sıralar.
 * - Tür filtresi: uzmanlık listesinde bulunmalı.
 * - Metin: ad, başlık, sertifika veya lokasyon.
 * - Sıralama: rating (varsayılan; eşitlikte yorum sayısı), distance, price.
 */
export function rankInstructors({ instructors, users, origin, filter = {} }: RankInput) {
  const q = filter.query?.trim().toLocaleLowerCase('tr-TR') ?? '';
  const byUser = new Map(users.map((u) => [u.id, u]));

  const rows = instructors
    .map((i) => ({
      instructor: i,
      user: byUser.get(i.userId),
      distanceKm: origin ? distanceKm(origin, i.coords) : null,
    }))
    .filter((r): r is { instructor: Instructor; user: User; distanceKm: number | null } =>
      Boolean(r.user),
    )
    .filter((r) => !filter.adventureType || r.instructor.specialties.includes(filter.adventureType))
    .filter(
      (r) =>
        !q ||
        r.user.displayName.toLocaleLowerCase('tr-TR').includes(q) ||
        r.instructor.headline.toLocaleLowerCase('tr-TR').includes(q) ||
        r.instructor.locationName.toLocaleLowerCase('tr-TR').includes(q) ||
        r.instructor.certifications.some((c) => c.toLocaleLowerCase('tr-TR').includes(q)),
    );

  const sortBy = filter.sortBy ?? 'rating';
  return rows.sort((a, b) => {
    if (sortBy === 'distance' && a.distanceKm !== null && b.distanceKm !== null)
      return a.distanceKm - b.distanceKm;
    if (sortBy === 'price')
      return a.instructor.pricePerSessionTry - b.instructor.pricePerSessionTry;
    if (b.instructor.rating !== a.instructor.rating)
      return b.instructor.rating - a.instructor.rating;
    return b.instructor.reviewCount - a.instructor.reviewCount;
  });
}

/** Yeni yorum eklendiğinde ortalama puanı günceller. */
export function nextRating(currentRating: number, reviewCount: number, newRating: number): number {
  const total = currentRating * reviewCount + newRating;
  return Math.round((total / (reviewCount + 1)) * 10) / 10;
}
