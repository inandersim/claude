import { generateId } from '@/core/utils/format';
import type { KidsRepository } from '@/data/repositories';
import {
  earnedStickers,
  familyChecklistFor,
  filterKidPlaces,
  huntTasksFor,
  withKidPlaceDistance,
  type HuntProgress,
  type XpEvent,
} from '@/domain';

import type { MockContext } from '../context';
import { seedFamilyChecklist } from '../seed.kids';

/** Çıkartma kazanınca eğlence XP'si (fun modülü sıralamasına yansır). */
const STICKER_XP = 25;

/** kids modülü mock repository fabrikası. */
export function createKidsRepository(ctx: MockContext): KidsRepository {
  type Tables = Awaited<ReturnType<MockContext['db']['load']>>;

  const savedSet = (t: Tables, meId: string) =>
    new Set(t.kidPlaceSaves.filter((s) => s.userId === meId).map((s) => s.placeId));

  /** Çocuk için ilerleme kaydı; yoksa boş kayıt oluşturur (kalıcı). */
  const ensureProgress = (t: Tables, meId: string, childName: string): HuntProgress => {
    const existing = t.huntProgress.find((p) => p.userId === meId && p.childName === childName);
    if (existing) return existing;
    const fresh: HuntProgress = {
      userId: meId,
      childName,
      completedTaskIds: [],
      stickers: [],
      points: 0,
      updatedAt: new Date().toISOString(),
    };
    t.huntProgress.push(fresh);
    return fresh;
  };

  return {
    async places(meId, filter) {
      await ctx.wait();
      const t = await ctx.db.load();
      const saved = savedSet(t, meId);
      const all = t.kidPlaces.map((p) => withKidPlaceDistance(p, filter.origin, saved.has(p.id)));
      return filterKidPlaces(all, filter);
    },

    async place(meId, id, origin) {
      await ctx.wait();
      const t = await ctx.db.load();
      const p = t.kidPlaces.find((x) => x.id === id);
      if (!p) return null;
      return withKidPlaceDistance(p, origin, savedSet(t, meId).has(p.id));
    },

    async toggleSave(meId, placeId) {
      await ctx.wait();
      const t = await ctx.db.load();
      ctx.requireUser(t.users, meId);
      if (!t.kidPlaces.some((p) => p.id === placeId)) throw new Error('Yer bulunamadı');
      const idx = t.kidPlaceSaves.findIndex((s) => s.userId === meId && s.placeId === placeId);
      if (idx >= 0) {
        t.kidPlaceSaves.splice(idx, 1);
        ctx.db.markDirty();
        return false;
      }
      t.kidPlaceSaves.push({ userId: meId, placeId });
      ctx.db.markDirty();
      return true;
    },

    async children(meId) {
      await ctx.wait();
      const t = await ctx.db.load();
      return t.children
        .filter((c) => c.userId === meId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    async addChild(meId, name, ageBand, avatar) {
      await ctx.wait();
      const t = await ctx.db.load();
      ctx.requireUser(t.users, meId);
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Çocuk adı gerekli');
      if (
        t.children.some(
          (c) =>
            c.userId === meId &&
            c.name.toLocaleLowerCase('tr-TR') === trimmed.toLocaleLowerCase('tr-TR'),
        )
      ) {
        throw new Error('Bu adla bir profil zaten var');
      }
      const child = {
        id: generateId('child'),
        userId: meId,
        name: trimmed,
        ageBand,
        avatar: avatar || '🦊',
        createdAt: new Date().toISOString(),
      };
      t.children.push(child);
      ctx.db.markDirty();
      return child;
    },

    async removeChild(meId, childId) {
      await ctx.wait();
      const t = await ctx.db.load();
      const idx = t.children.findIndex((c) => c.id === childId && c.userId === meId);
      if (idx < 0) throw new Error('Profil bulunamadı');
      const [removed] = t.children.splice(idx, 1);
      // Doğa avı ilerlemesi de silinir
      t.huntProgress = t.huntProgress.filter(
        (p) => !(p.userId === meId && p.childName === removed!.name),
      );
      ctx.db.markDirty();
    },

    async huntTasks(ageBand) {
      await ctx.wait();
      const t = await ctx.db.load();
      return huntTasksFor(t.huntTasks, ageBand);
    },

    async huntProgress(meId, childName) {
      await ctx.wait();
      const t = await ctx.db.load();
      return (
        t.huntProgress.find((p) => p.userId === meId && p.childName === childName) ?? {
          userId: meId,
          childName,
          completedTaskIds: [],
          stickers: [],
          points: 0,
          updatedAt: new Date(0).toISOString(),
        }
      );
    },

    async completeTask(meId, childName, taskId) {
      await ctx.wait();
      const t = await ctx.db.load();
      ctx.requireUser(t.users, meId);
      const task = t.huntTasks.find((x) => x.id === taskId);
      if (!task) throw new Error('Görev bulunamadı');
      const progress = ensureProgress(t, meId, childName);
      if (progress.completedTaskIds.includes(taskId)) return progress;

      const now = new Date().toISOString();
      progress.completedTaskIds.push(taskId);
      progress.points += task.points;
      progress.updatedAt = now;

      // Eşik geçildiyse yeni çıkartmalar; her biri eğlence XP'si yazar
      const earned = earnedStickers(progress.points);
      const fresh = earned.filter((s) => !progress.stickers.includes(s));
      for (const sticker of fresh) {
        progress.stickers.push(sticker);
        const event: XpEvent = {
          id: generateId('xp'),
          userId: meId,
          source: 'quiz',
          amount: STICKER_XP,
          note: `Küçük Kâşif çıkartması: ${sticker} (${childName})`,
          createdAt: now,
        };
        t.xpEvents.unshift(event);
      }
      ctx.db.markDirty();
      return progress;
    },

    async resetHunt(meId, childName) {
      await ctx.wait();
      const t = await ctx.db.load();
      const progress = ensureProgress(t, meId, childName);
      progress.completedTaskIds = [];
      progress.stickers = [];
      progress.points = 0;
      progress.updatedAt = new Date().toISOString();
      ctx.db.markDirty();
      return progress;
    },

    async checklist(ageBand) {
      await ctx.wait();
      return familyChecklistFor(seedFamilyChecklist, ageBand);
    },
  };
}
