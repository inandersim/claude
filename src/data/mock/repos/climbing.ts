import { generateId } from '@/core/utils/format';
import type { ClimbingRepository } from '@/data/repositories';
import {
  canConfirm,
  cragVerificationOf,
  distanceKm,
  filterCrags,
  gradeIndex,
  verificationOf,
  type Ascent,
  type AscentWithUser,
  type ClimbingRoute,
  type Crag,
  type CragSector,
  type CragWithDistance,
  type GeoPoint,
  type ID,
} from '@/domain';

import type { MockContext } from '../context';

/** climbing modülü mock repository fabrikası. */
export function createClimbingRepository(ctx: MockContext): ClimbingRepository {
  const { db, wait, requireUser } = ctx;

  const withDistance = (crag: Crag, origin: GeoPoint | null): CragWithDistance => ({
    ...crag,
    distanceKm: origin ? distanceKm(origin, crag.coords) : null,
  });

  const requireCrag = (crags: Crag[], id: ID): Crag => {
    const crag = crags.find((c) => c.id === id);
    if (!crag) throw new Error(`Kaya bulunamadı: ${id}`);
    return crag;
  };

  const requireSector = (sectors: CragSector[], id: ID): CragSector => {
    const sector = sectors.find((s) => s.id === id);
    if (!sector) throw new Error(`Sektör bulunamadı: ${id}`);
    return sector;
  };

  const requireRoute = (routes: ClimbingRoute[], id: ID): ClimbingRoute => {
    const route = routes.find((r) => r.id === id);
    if (!route) throw new Error(`Rota bulunamadı: ${id}`);
    return route;
  };

  /** Çıkışlar tarihe göre yeniden eskiye sıralanır. */
  const byDateDesc = (a: Ascent, b: Ascent) => b.date.localeCompare(a.date);

  return {
    async crags(filter) {
      await wait();
      const t = await db.load();
      return filterCrags(t.crags, filter, filter.origin ?? null);
    },

    async crag(id, origin) {
      await wait();
      const t = await db.load();
      const crag = t.crags.find((c) => c.id === id);
      return crag ? withDistance(crag, origin) : null;
    },

    async sectors(cragId) {
      await wait();
      const t = await db.load();
      return t.sectors.filter((s) => s.cragId === cragId);
    },

    async routes(cragId, sectorId = null) {
      await wait();
      const t = await db.load();
      return t.climbingRoutes
        .filter((r) => r.cragId === cragId && (!sectorId || r.sectorId === sectorId))
        .sort((a, b) => gradeIndex(a.grade, a.gradeSystem) - gradeIndex(b.grade, b.gradeSystem));
    },

    async route(id) {
      await wait();
      const t = await db.load();
      const route = t.climbingRoutes.find((r) => r.id === id);
      if (!route) return null;
      return {
        ...route,
        crag: requireCrag(t.crags, route.cragId),
        sector: requireSector(t.sectors, route.sectorId),
      };
    },

    async ascents(routeId) {
      await wait();
      const t = await db.load();
      return t.ascents
        .filter((a) => a.routeId === routeId)
        .sort(byDateDesc)
        .map<AscentWithUser>((a) => ({ ...a, user: requireUser(t.users, a.userId) }));
    },

    async myAscents(meId) {
      await wait();
      const t = await db.load();
      const user = requireUser(t.users, meId);
      return t.ascents
        .filter((a) => a.userId === meId)
        .sort(byDateDesc)
        .map((a) => {
          const route = requireRoute(t.climbingRoutes, a.routeId);
          return { ...a, user, route, crag: requireCrag(t.crags, route.cragId) };
        });
    },

    async logAscent(meId, input) {
      await wait();
      const t = await db.load();
      const user = requireUser(t.users, meId);
      const route = requireRoute(t.climbingRoutes, input.routeId);
      const ascent: Ascent = {
        id: generateId('a'),
        routeId: route.id,
        userId: meId,
        style: input.style,
        date: new Date().toISOString(),
        note: input.note.trim(),
        feltGrade: input.feltGrade?.trim() || null,
      };
      t.ascents.unshift(ascent);
      route.ascentCount += 1;
      db.markDirty();
      return { ...ascent, user };
    },

    async submitRoute(meId, input) {
      await wait();
      const t = await db.load();
      requireUser(t.users, meId);
      const crag = requireCrag(t.crags, input.cragId);
      const sector = requireSector(t.sectors, input.sectorId);
      if (sector.cragId !== crag.id) throw new Error('Sektör bu kayaya ait değil.');
      const name = input.name.trim();
      if (!name) throw new Error('Rota adı zorunlu.');
      if (gradeIndex(input.grade, input.gradeSystem) < 0) throw new Error('Geçersiz derece.');
      const route: ClimbingRoute = {
        id: generateId('r'),
        cragId: crag.id,
        sectorId: sector.id,
        name,
        type: input.type,
        grade: input.grade.trim(),
        gradeSystem: input.gradeSystem,
        lengthM: input.lengthM,
        pitches: Math.max(1, Math.round(input.pitches)),
        bolts: null,
        stars: 0,
        firstAscent: null,
        description: input.description.trim(),
        verification: verificationOf(0, false, false),
        confirmations: 0,
        ascentCount: 0,
        submittedBy: meId,
        createdAt: new Date().toISOString(),
      };
      t.climbingRoutes.push(route);
      sector.routeCount += 1;
      crag.routeCount += 1;
      if (!crag.climbTypes.includes(route.type)) crag.climbTypes.push(route.type);
      crag.updatedAt = route.createdAt;
      crag.verification = cragVerificationOf(t.climbingRoutes.filter((r) => r.cragId === crag.id));
      db.markDirty();
      return route;
    },

    async confirmRoute(meId, routeId) {
      await wait();
      const t = await db.load();
      requireUser(t.users, meId);
      const route = requireRoute(t.climbingRoutes, routeId);
      if (!canConfirm(route, meId, t.routeConfirmations)) {
        throw new Error('Bu rotayı onaylayamazsın.');
      }
      t.routeConfirmations.push({ userId: meId, routeId });
      route.confirmations += 1;
      route.verification = verificationOf(route.confirmations, false, false);
      const crag = requireCrag(t.crags, route.cragId);
      crag.verification = cragVerificationOf(t.climbingRoutes.filter((r) => r.cragId === crag.id));
      crag.updatedAt = new Date().toISOString();
      db.markDirty();
      return route;
    },
  };
}
