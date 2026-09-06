import type { CountryRepository } from '@/data/repositories';
import {
  filterCountries,
  sortByRelevance,
  type CountryChecklist,
  type CountryGuide,
  type ID,
  type ISODate,
} from '@/domain';

import type { MockContext } from '../context';
import { CURRENT_USER_ID } from '../seed';

type Tables = Awaited<ReturnType<MockContext['db']['load']>>;

/** countries modülü mock repository fabrikası. */
export function createCountryRepository(ctx: MockContext): CountryRepository {
  const findGuide = (t: Tables, code: string): CountryGuide | null =>
    t.countryGuides.find((g) => g.countryCode === code.toUpperCase()) ?? null;

  const requireGuide = (t: Tables, code: string): CountryGuide => {
    const guide = findGuide(t, code);
    if (!guide) throw new Error(`Ülke rehberi bulunamadı: ${code}`);
    return guide;
  };

  const savedDestinationsOf = (t: Tables, meId: ID): { countryCode: string }[] => {
    const ids = new Set(
      t.savedDestinations.filter((s) => s.userId === meId).map((s) => s.destinationId),
    );
    return t.destinations.filter((d) => ids.has(d.id)).map((d) => ({ countryCode: d.countryCode }));
  };

  const findOrCreateChecklist = (t: Tables, meId: ID, code: string): CountryChecklist => {
    const countryCode = code.toUpperCase();
    const existing = t.countryChecklists.find(
      (c) => c.userId === meId && c.countryCode === countryCode,
    );
    if (existing) return existing;
    const created: CountryChecklist = {
      userId: meId,
      countryCode,
      done: [],
      tripDate: null,
      updatedAt: new Date().toISOString(),
    };
    t.countryChecklists.push(created);
    ctx.db.markDirty();
    return created;
  };

  return {
    async list(query) {
      await ctx.wait();
      const t = await ctx.db.load();
      const guides = filterCountries(t.countryGuides, query);
      // Kullanıcının kaydettiği destinasyonların ülkeleri önce, kalanlar alfabetik.
      return sortByRelevance(guides, null, savedDestinationsOf(t, CURRENT_USER_ID));
    },

    async getByCode(code) {
      await ctx.wait();
      const t = await ctx.db.load();
      return findGuide(t, code);
    },

    async checklist(meId, code) {
      await ctx.wait();
      const t = await ctx.db.load();
      ctx.requireUser(t.users, meId);
      requireGuide(t, code);
      return findOrCreateChecklist(t, meId, code);
    },

    async toggleDocument(meId, code, key) {
      await ctx.wait();
      const t = await ctx.db.load();
      ctx.requireUser(t.users, meId);
      const guide = requireGuide(t, code);
      if (!guide.documents.some((d) => d.key === key)) {
        throw new Error(`Belge anahtarı tanımsız: ${key}`);
      }
      const checklist = findOrCreateChecklist(t, meId, code);
      checklist.done = checklist.done.includes(key)
        ? checklist.done.filter((k) => k !== key)
        : [...checklist.done, key];
      checklist.updatedAt = new Date().toISOString();
      ctx.db.markDirty();
      return checklist;
    },

    async setTripDate(meId, code, date: ISODate | null) {
      await ctx.wait();
      const t = await ctx.db.load();
      ctx.requireUser(t.users, meId);
      requireGuide(t, code);
      if (date !== null && Number.isNaN(Date.parse(date))) {
        throw new Error('Geçersiz seyahat tarihi');
      }
      const checklist = findOrCreateChecklist(t, meId, code);
      checklist.tripDate = date;
      checklist.updatedAt = new Date().toISOString();
      ctx.db.markDirty();
      return checklist;
    },
  };
}
