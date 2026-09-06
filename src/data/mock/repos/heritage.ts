import { generateId } from '@/core/utils/format';
import type { HeritageRepository } from '@/data/repositories';
import {
  distanceKm,
  filterHeritageSites,
  HERITAGE_VISIT_XP,
  sortGuideStops,
  validateHeritageTourInput,
  type GeoPoint,
  type HeritageSite,
  type HeritageSiteWithDistance,
  type XpEvent,
} from '@/domain';

import type { MockContext } from '../context';

type Tables = Awaited<ReturnType<MockContext['db']['load']>>;

/** heritage modülü mock repository fabrikası. */
export function createHeritageRepository(ctx: MockContext): HeritageRepository {
  const savedSet = (t: Tables, meId: string): Set<string> =>
    new Set(t.heritageSaves.filter((s) => s.userId === meId).map((s) => s.siteId));
  const visitedSet = (t: Tables, meId: string): Set<string> =>
    new Set(t.heritageVisits.filter((v) => v.userId === meId).map((v) => v.siteId));

  const withMeta = (
    s: HeritageSite,
    origin: GeoPoint | null,
    saved: Set<string>,
    visited: Set<string>,
  ): HeritageSiteWithDistance => ({
    ...s,
    distanceKm: origin ? Math.round(distanceKm(origin, s.coords) * 10) / 10 : null,
    savedByMe: saved.has(s.id),
    visitedByMe: visited.has(s.id),
  });

  const requireSite = (t: Tables, id: string): HeritageSite => {
    const s = t.heritageSites.find((x) => x.id === id);
    if (!s) throw new Error('Tarihi alan bulunamadı.');
    return s;
  };

  const xpNote = (site: HeritageSite) => `Tarihi alan ziyareti: ${site.name}`;

  return {
    async list(meId, filter) {
      await ctx.wait();
      const t = await ctx.db.load();
      const saved = savedSet(t, meId);
      const visited = visitedSet(t, meId);
      const origin = filter.origin ?? null;
      return filterHeritageSites(t.heritageSites, filter).map((s) =>
        withMeta(s, origin, saved, visited),
      );
    },

    async getById(meId, id, origin) {
      await ctx.wait();
      const t = await ctx.db.load();
      const s = t.heritageSites.find((x) => x.id === id);
      if (!s) return null;
      return withMeta(s, origin, savedSet(t, meId), visitedSet(t, meId));
    },

    async audioGuide(siteId) {
      await ctx.wait();
      const t = await ctx.db.load();
      return sortGuideStops(t.audioGuides.filter((a) => a.siteId === siteId));
    },

    async toggleSave(meId, siteId) {
      await ctx.wait();
      const t = await ctx.db.load();
      ctx.requireUser(t.users, meId);
      requireSite(t, siteId);
      const idx = t.heritageSaves.findIndex((s) => s.userId === meId && s.siteId === siteId);
      if (idx >= 0) {
        t.heritageSaves.splice(idx, 1);
        ctx.db.markDirty();
        return false;
      }
      t.heritageSaves.push({ userId: meId, siteId });
      ctx.db.markDirty();
      return true;
    },

    async markVisited(meId, siteId) {
      await ctx.wait();
      const t = await ctx.db.load();
      ctx.requireUser(t.users, meId);
      const site = requireSite(t, siteId);
      const idx = t.heritageVisits.findIndex((v) => v.userId === meId && v.siteId === siteId);
      if (idx >= 0) {
        // Geri alma: ziyareti ve verilen XP olayını kaldır (puan çiftlemesini önler).
        t.heritageVisits.splice(idx, 1);
        const note = xpNote(site);
        const xpIdx = t.xpEvents.findIndex((e) => e.userId === meId && e.note === note);
        if (xpIdx >= 0) t.xpEvents.splice(xpIdx, 1);
        ctx.db.markDirty();
        return false;
      }
      const now = new Date().toISOString();
      t.heritageVisits.push({ userId: meId, siteId, at: now });
      const event: XpEvent = {
        id: generateId('xp'),
        userId: meId,
        source: 'route',
        amount: HERITAGE_VISIT_XP,
        note: xpNote(site),
        createdAt: now,
      };
      t.xpEvents.unshift(event);
      ctx.db.markDirty();
      return true;
    },

    async tours(meId) {
      await ctx.wait();
      const t = await ctx.db.load();
      return t.heritageTours
        .filter((x) => x.userId === meId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async createTour(meId, input) {
      await ctx.wait();
      const t = await ctx.db.load();
      ctx.requireUser(t.users, meId);
      const title = input.title.trim();
      const siteIds = input.siteIds.filter((id) => t.heritageSites.some((s) => s.id === id));
      const date = input.date?.trim() || null;
      const error = validateHeritageTourInput({ title, siteIds, date });
      if (error === 'nameRequired') throw new Error('Tura bir ad ver.');
      if (error === 'minSites') throw new Error('En az 2 alan seç.');
      if (error === 'invalidDate') throw new Error('Tarih YYYY-AA-GG biçiminde olmalı.');
      const tour = {
        id: generateId('htour'),
        userId: meId,
        title,
        siteIds,
        date,
        notes: input.notes.trim(),
        createdAt: new Date().toISOString(),
      };
      t.heritageTours.unshift(tour);
      ctx.db.markDirty();
      return tour;
    },

    async deleteTour(meId, tourId) {
      await ctx.wait();
      const t = await ctx.db.load();
      const idx = t.heritageTours.findIndex((x) => x.id === tourId && x.userId === meId);
      if (idx < 0) throw new Error('Tur bulunamadı.');
      t.heritageTours.splice(idx, 1);
      ctx.db.markDirty();
    },

    async nearby(origin, radiusKm) {
      await ctx.wait();
      const t = await ctx.db.load();
      const empty = new Set<string>();
      return t.heritageSites
        .map((s) => withMeta(s, origin, empty, empty))
        .filter((s) => (s.distanceKm ?? Infinity) <= radiusKm)
        .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    },
  };
}
