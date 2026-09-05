import { generateId } from '@/core/utils/format';
import type { MapsRepository } from '@/data/repositories';
import type { ID, MapPack, RouteProfile, SavedRoute, TrailGraph } from '@/domain';
import { planRoute } from '@/domain/routing';

import type { MockContext } from '../context';

/** İndirme simülasyonu adım sayısı ve adımlar arası bekleme */
const DOWNLOAD_STEPS = 6;

/** Sürüm dizesini (YYYY.MM) bir ay ileri alır — güncelleme simülasyonu */
function bumpVersion(version: string): string {
  const [y, m] = version.split('.').map((v) => parseInt(v, 10));
  if (!y || !m) return version;
  const next = m >= 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  return `${next.y}.${String(next.m).padStart(2, '0')}`;
}

/** maps modülü mock repository fabrikası. */
export function createMapsRepository(ctx: MockContext): MapsRepository {
  const stepMs = ctx.latencyMs > 0 ? 550 : 1;
  const timers = new Map<ID, ReturnType<typeof setTimeout>>();

  const findPack = (packs: MapPack[], id: ID): MapPack => {
    const pack = packs.find((p) => p.id === id);
    if (!pack) throw new Error('Harita paketi bulunamadı');
    return pack;
  };

  const findGraph = (graphs: TrailGraph[], regionId: ID): TrailGraph => {
    const graph = graphs.find((g) => g.regionId === regionId);
    if (!graph) throw new Error('Bölge için patika grafı bulunamadı');
    return graph;
  };

  /** İlerlemeyi setTimeout adımlarıyla artırır; her adımda markDirty. */
  const scheduleStep = (packId: ID, step: number, nowIso: () => string) => {
    const timer = setTimeout(async () => {
      const t = await ctx.db.load();
      const pack = t.mapPacks.find((p) => p.id === packId);
      if (!pack || pack.status !== 'downloading') return;
      if (step >= DOWNLOAD_STEPS) {
        pack.status = 'downloaded';
        pack.progress = 1;
        pack.localPath = `file:///maps/${pack.id}.pmtiles`;
        pack.updatedAt = nowIso();
        timers.delete(packId);
      } else {
        pack.progress = Math.round((step / DOWNLOAD_STEPS) * 100) / 100;
        scheduleStep(packId, step + 1, nowIso);
      }
      ctx.db.markDirty();
    }, stepMs);
    timers.set(packId, timer);
  };

  return {
    async packs() {
      await ctx.wait();
      const t = await ctx.db.load();
      return t.mapPacks;
    },

    async download(packId) {
      await ctx.wait();
      const t = await ctx.db.load();
      const pack = findPack(t.mapPacks, packId);
      if (pack.status === 'downloading') return pack;
      if (pack.status === 'update_available') pack.version = bumpVersion(pack.version);
      pack.status = 'downloading';
      pack.progress = 0;
      pack.localPath = null;
      ctx.db.markDirty();
      scheduleStep(packId, 1, () => new Date().toISOString());
      return pack;
    },

    async remove(packId) {
      await ctx.wait();
      const t = await ctx.db.load();
      const pack = findPack(t.mapPacks, packId);
      const timer = timers.get(packId);
      if (timer) {
        clearTimeout(timer);
        timers.delete(packId);
      }
      pack.status = 'available';
      pack.progress = 0;
      pack.localPath = null;
      ctx.db.markDirty();
      return pack;
    },

    async graph(regionId) {
      await ctx.wait();
      const t = await ctx.db.load();
      return findGraph(t.trailGraphs, regionId);
    },

    async regions() {
      await ctx.wait();
      const t = await ctx.db.load();
      return t.mapRegions;
    },

    async plan(regionId, fromNodeId, toNodeId, profile: RouteProfile) {
      await ctx.wait();
      const t = await ctx.db.load();
      const graph = findGraph(t.trailGraphs, regionId);
      const planned = planRoute(graph, fromNodeId, toNodeId, profile);
      if (!planned) throw new Error('Bu profil için iki nokta arasında rota bulunamadı');
      return planned;
    },

    async savedRoutes(meId) {
      await ctx.wait();
      const t = await ctx.db.load();
      return t.savedRoutes
        .filter((r) => r.userId === meId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async saveRoute(meId, input) {
      await ctx.wait();
      const t = await ctx.db.load();
      ctx.requireUser(t.users, meId);
      const name = input.name.trim();
      if (!name) throw new Error('Rota adı boş olamaz');
      if (input.planned.nodeIds.length < 2)
        throw new Error('Kaydedilecek rota en az iki nokta içermeli');
      const route: SavedRoute = {
        id: generateId('sr'),
        userId: meId,
        regionId: input.regionId,
        name,
        routeProfile: input.routeProfile,
        planned: input.planned,
        createdAt: new Date().toISOString(),
      };
      t.savedRoutes.unshift(route);
      ctx.db.markDirty();
      return route;
    },

    async deleteRoute(meId, routeId) {
      await ctx.wait();
      const t = await ctx.db.load();
      const index = t.savedRoutes.findIndex((r) => r.id === routeId && r.userId === meId);
      if (index === -1) throw new Error('Kayıtlı rota bulunamadı');
      t.savedRoutes.splice(index, 1);
      ctx.db.markDirty();
    },
  };
}
