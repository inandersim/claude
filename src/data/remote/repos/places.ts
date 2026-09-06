import {
  HERITAGE_VISIT_XP,
  distanceKm,
  earnedStickers,
  familyChecklistFor,
  filterCountries,
  filterDestinations,
  filterHeritageSites,
  filterKidPlaces,
  huntTasksFor,
  isOverdue,
  lakeLouiseScore,
  overdueMessage,
  sortByRelevance,
  sortGuideStops,
  sortStages,
  validateHeritageTourInput,
  validateReturnPlanInput,
  withKidPlaceDistance,
  type AmsSymptomScore,
  type Destination,
  type DestinationWithDistance,
  type GeoPoint,
  type HeritageSite,
  type HeritageSiteWithDistance,
  type HuntProgress,
  type ID,
  type ISODate,
  type ReturnPlan,
} from '@/domain';

import type {
  CountryRepository,
  DestinationRepository,
  HeritageRepository,
  KidsRepository,
} from '../../repositories';
import { notifyMany, requireUser, type RemoteContext } from '../context';
import {
  dayKey,
  toAmsCheck,
  toAudioGuideStop,
  toChildProfile,
  toCountryChecklist,
  toCountryGuide,
  toDestination,
  toDestinationStage,
  toFamilyChecklistItem,
  toHeritageSite,
  toHeritageTour,
  toHuntProgress,
  toHuntTask,
  toKidPlace,
  toReturnPlan,
} from '../mappers';
import { maybeRow, oneRow, rows } from '../postgrest';

/* ================================================================== */
/* Destinasyonlar                                                     */
/* ================================================================== */

export function createDestinationRepository(ctx: RemoteContext): DestinationRepository {
  const { db } = ctx;

  const savedIds = async (meId: ID): Promise<Set<ID>> => {
    const data = await rows(
      db.from('saved_destinations').select('destination_id').eq('user_id', meId),
      'kaydedilenler okunamadı',
    );
    return new Set(data.map((row) => String(row.destination_id)));
  };

  const withMeta = (
    d: Destination,
    origin: GeoPoint | null,
    saved: Set<ID>,
  ): DestinationWithDistance => ({
    ...d,
    distanceKm: origin ? Math.round(distanceKm(origin, d.coords)) : null,
    savedByMe: saved.has(d.id),
  });

  const findPlan = async (meId: ID, planId: ID): Promise<ReturnPlan> => {
    const row = await maybeRow(
      db.from('return_plans').select('*').eq('id', planId).eq('user_id', meId),
      'yol planı okunamadı',
    );
    if (!row) throw new Error('Yol planı bulunamadı.');
    return toReturnPlan(row);
  };

  return {
    async list(meId, filter) {
      const data = await rows(db.from('destinations').select('*'), 'destinasyonlar okunamadı');
      const saved = await savedIds(meId);
      const origin = filter.origin ?? null;
      return filterDestinations(data.map(toDestination), filter).map((d) =>
        withMeta(d, origin, saved),
      );
    },

    async getById(meId, id, origin) {
      const row = await maybeRow(
        db.from('destinations').select('*').eq('id', id),
        'destinasyon okunamadı',
      );
      if (!row) return null;
      return withMeta(toDestination(row), origin, await savedIds(meId));
    },

    async stages(destinationId) {
      const data = await rows(
        db.from('destination_stages').select('*').eq('destination_id', destinationId),
        'aşamalar okunamadı',
      );
      return sortStages(data.map(toDestinationStage));
    },

    async toggleSave(meId, destinationId) {
      await requireUser(db, meId);
      const exists = await maybeRow(
        db.from('destinations').select('id').eq('id', destinationId),
        'destinasyon okunamadı',
      );
      if (!exists) throw new Error('Destinasyon bulunamadı.');
      const existing = await maybeRow(
        db
          .from('saved_destinations')
          .select('destination_id')
          .eq('user_id', meId)
          .eq('destination_id', destinationId),
        'kayıt okunamadı',
      );
      if (existing) {
        await rows(
          db
            .from('saved_destinations')
            .delete()
            .eq('user_id', meId)
            .eq('destination_id', destinationId),
          'kayıt kaldırılamadı',
        );
        return { saved: false };
      }
      await rows(
        db.from('saved_destinations').insert({ user_id: meId, destination_id: destinationId }),
        'kaydedilemedi',
      );
      return { saved: true };
    },

    async saved(meId) {
      const ids = Array.from(await savedIds(meId));
      if (!ids.length) return [];
      const data = await rows(
        db.from('destinations').select('*').in('id', ids),
        'destinasyonlar okunamadı',
      );
      return data.map(toDestination);
    },

    async amsChecks(meId) {
      const data = await rows(
        db
          .from('ams_checks')
          .select('*')
          .eq('user_id', meId)
          .order('created_at', { ascending: false }),
        'AMS kayıtları okunamadı',
      );
      return data.map(toAmsCheck);
    },

    async logAms(meId, input) {
      await requireUser(db, meId);
      if (!Number.isFinite(input.elevationM) || input.elevationM < 0 || input.elevationM > 9000) {
        throw new Error('Geçerli bir irtifa gir (0–9000 m).');
      }
      const clamp = (v: number): AmsSymptomScore =>
        Math.max(0, Math.min(3, Math.round(v))) as AmsSymptomScore;
      const headache = clamp(input.headache);
      const gi = clamp(input.gi);
      const fatigue = clamp(input.fatigue);
      const dizziness = clamp(input.dizziness);
      // `compute_ams_score` tetikleyicisi score/severity alanlarını doldurur;
      // yine de domain hesabıyla aynı olduğunu doğrulamak için gönderiyoruz.
      const { score, severity } = lakeLouiseScore(headache, gi, fatigue, dizziness);
      const created = await oneRow(
        db
          .from('ams_checks')
          .insert({
            user_id: meId,
            destination_id: input.destinationId ?? null,
            elevation_m: Math.round(input.elevationM),
            headache,
            gi,
            fatigue,
            dizziness,
            score,
            severity,
            note: input.note.trim(),
          })
          .select('*'),
        'AMS kaydı yazılamadı',
      );
      return toAmsCheck(created);
    },

    async returnPlans(meId) {
      const data = await rows(
        db
          .from('return_plans')
          .select('*')
          .eq('user_id', meId)
          .order('created_at', { ascending: false }),
        'yol planları okunamadı',
      );
      return data.map(toReturnPlan);
    },

    async createReturnPlan(meId, input) {
      const me = await requireUser(db, meId);
      const errors = validateReturnPlanInput(input);
      if (errors.length > 0) {
        throw new Error(
          errors[0] === 'destinations.plan.errors.title'
            ? 'Plan başlığı gerekli.'
            : errors[0] === 'destinations.plan.errors.grace'
              ? 'Tolerans 0–1440 dk arasında olmalı.'
              : 'Dönüş saati başlangıçtan sonra olmalı.',
        );
      }
      if (input.destinationId) {
        const exists = await maybeRow(
          db.from('destinations').select('id').eq('id', input.destinationId),
          'destinasyon okunamadı',
        );
        if (!exists) throw new Error('Destinasyon bulunamadı.');
      }
      const created = await oneRow(
        db
          .from('return_plans')
          .insert({
            user_id: meId,
            title: input.title.trim(),
            destination_id: input.destinationId ?? null,
            adventure_type: input.adventureType,
            start_at: input.startAt,
            expected_return_at: input.expectedReturnAt,
            grace_min: Math.round(input.graceMin),
            route: input.route.trim(),
            companions: input.companions.trim(),
            contact_ids: me.emergencyContacts
              .map((c) => c.userId)
              .filter((id): id is ID => Boolean(id)),
            status: Date.parse(input.startAt) > Date.now() ? 'planned' : 'active',
          })
          .select('*'),
        'yol planı oluşturulamadı',
      );
      return toReturnPlan(created);
    },

    async markReturned(meId, planId) {
      const plan = await findPlan(meId, planId);
      if (plan.status === 'cancelled') throw new Error('İptal edilmiş plan kapatılamaz.');
      const updated = await oneRow(
        db
          .from('return_plans')
          .update({ status: 'returned', returned_at: new Date().toISOString() })
          .eq('id', planId)
          .select('*'),
        'plan kapatılamadı',
      );
      return toReturnPlan(updated);
    },

    async cancelReturnPlan(meId, planId) {
      const plan = await findPlan(meId, planId);
      if (plan.status === 'returned') throw new Error('Tamamlanmış plan iptal edilemez.');
      await rows(
        db.from('return_plans').update({ status: 'cancelled' }).eq('id', planId),
        'plan iptal edilemedi',
      );
    },

    async checkOverdue(meId, now) {
      const me = await requireUser(db, meId);
      const nowMs = Date.parse(now);
      const data = await rows(
        db.from('return_plans').select('*').eq('user_id', meId).in('status', ['active', 'planned']),
        'yol planları okunamadı',
      );
      const updated: ReturnPlan[] = [];
      for (const row of data) {
        const plan = toReturnPlan(row);
        if (!isOverdue(plan, nowMs)) continue;
        const next = await oneRow(
          db
            .from('return_plans')
            .update({ status: 'overdue', alert_sent_at: now })
            .eq('id', plan.id)
            .select('*'),
          'plan güncellenemedi',
        );
        const stored = toReturnPlan(next);
        updated.push(stored);
        await notifyMany(db, stored.contactIds, {
          type: 'trip_overdue',
          senderId: meId,
          message: overdueMessage(stored, me, 'tr'),
          postId: null,
          matchId: null,
          targetId: stored.id,
        });
      }
      return updated;
    },
  };
}

/* ================================================================== */
/* Ülke rehberi                                                       */
/* ================================================================== */

export function createCountryRepository(ctx: RemoteContext): CountryRepository {
  const { db } = ctx;

  const requireGuide = async (code: string) => {
    const row = await maybeRow(
      db.from('country_guides').select('*').eq('country_code', code.toUpperCase()),
      'ülke rehberi okunamadı',
    );
    if (!row) throw new Error(`Ülke rehberi bulunamadı: ${code}`);
    return toCountryGuide(row);
  };

  const findOrCreateChecklist = async (meId: ID, code: string) => {
    const countryCode = code.toUpperCase();
    const existing = await maybeRow(
      db
        .from('country_checklists')
        .select('*')
        .eq('user_id', meId)
        .eq('country_code', countryCode),
      'kontrol listesi okunamadı',
    );
    if (existing) return toCountryChecklist(existing);
    const created = await oneRow(
      db
        .from('country_checklists')
        .insert({ user_id: meId, country_code: countryCode, done: [], trip_date: null })
        .select('*'),
      'kontrol listesi oluşturulamadı',
    );
    return toCountryChecklist(created);
  };

  return {
    async list(query) {
      const data = await rows(db.from('country_guides').select('*'), 'ülke rehberleri okunamadı');
      const guides = filterCountries(data.map(toCountryGuide), query);
      const meId = ctx.sessionUserId();
      // Kullanıcının kaydettiği destinasyonların ülkeleri önce.
      const savedCountries = meId
        ? await rows(
            db.from('saved_destinations').select('destination_id').eq('user_id', meId),
            'kaydedilenler okunamadı',
          )
        : [];
      const ids = savedCountries.map((row) => String(row.destination_id));
      const destinations = ids.length
        ? await rows(
            db.from('destinations').select('country_code').in('id', ids),
            'destinasyonlar okunamadı',
          )
        : [];
      return sortByRelevance(
        guides,
        null,
        destinations.map((row) => ({ countryCode: String(row.country_code) })),
      );
    },

    async getByCode(code) {
      const row = await maybeRow(
        db.from('country_guides').select('*').eq('country_code', code.toUpperCase()),
        'ülke rehberi okunamadı',
      );
      return row ? toCountryGuide(row) : null;
    },

    async checklist(meId, code) {
      await requireUser(db, meId);
      await requireGuide(code);
      return await findOrCreateChecklist(meId, code);
    },

    async toggleDocument(meId, code, key) {
      await requireUser(db, meId);
      const guide = await requireGuide(code);
      if (!guide.documents.some((d) => d.key === key)) {
        throw new Error(`Belge anahtarı tanımsız: ${key}`);
      }
      const checklist = await findOrCreateChecklist(meId, code);
      const done = checklist.done.includes(key)
        ? checklist.done.filter((k) => k !== key)
        : [...checklist.done, key];
      const updated = await oneRow(
        db
          .from('country_checklists')
          .update({ done })
          .eq('user_id', meId)
          .eq('country_code', code.toUpperCase())
          .select('*'),
        'kontrol listesi güncellenemedi',
      );
      return toCountryChecklist(updated);
    },

    async setTripDate(meId, code, date: ISODate | null) {
      await requireUser(db, meId);
      await requireGuide(code);
      if (date !== null && Number.isNaN(Date.parse(date))) {
        throw new Error('Geçersiz seyahat tarihi');
      }
      await findOrCreateChecklist(meId, code);
      const updated = await oneRow(
        db
          .from('country_checklists')
          .update({ trip_date: date ? dayKey(date) : null })
          .eq('user_id', meId)
          .eq('country_code', code.toUpperCase())
          .select('*'),
        'seyahat tarihi güncellenemedi',
      );
      return toCountryChecklist(updated);
    },
  };
}

/* ================================================================== */
/* Tarihi alanlar                                                     */
/* ================================================================== */

export function createHeritageRepository(ctx: RemoteContext): HeritageRepository {
  const { db } = ctx;

  const savedSet = async (meId: ID): Promise<Set<ID>> => {
    const data = await rows(
      db.from('heritage_saves').select('site_id').eq('user_id', meId),
      'kayıtlar okunamadı',
    );
    return new Set(data.map((row) => String(row.site_id)));
  };

  const visitedSet = async (meId: ID): Promise<Set<ID>> => {
    const data = await rows(
      db.from('heritage_visits').select('site_id').eq('user_id', meId),
      'ziyaretler okunamadı',
    );
    return new Set(data.map((row) => String(row.site_id)));
  };

  const withMeta = (
    s: HeritageSite,
    origin: GeoPoint | null,
    saved: Set<ID>,
    visited: Set<ID>,
  ): HeritageSiteWithDistance => ({
    ...s,
    distanceKm: origin ? Math.round(distanceKm(origin, s.coords) * 10) / 10 : null,
    savedByMe: saved.has(s.id),
    visitedByMe: visited.has(s.id),
  });

  const requireSite = async (id: ID): Promise<HeritageSite> => {
    const row = await maybeRow(
      db.from('heritage_sites').select('*').eq('id', id),
      'tarihi alan okunamadı',
    );
    if (!row) throw new Error('Tarihi alan bulunamadı.');
    return toHeritageSite(row);
  };

  const xpNote = (site: HeritageSite) => `Tarihi alan ziyareti: ${site.name}`;

  return {
    async list(meId, filter) {
      const data = await rows(db.from('heritage_sites').select('*'), 'tarihi alanlar okunamadı');
      const [saved, visited] = await Promise.all([savedSet(meId), visitedSet(meId)]);
      const origin = filter.origin ?? null;
      return filterHeritageSites(data.map(toHeritageSite), filter).map((s) =>
        withMeta(s, origin, saved, visited),
      );
    },

    async getById(meId, id, origin) {
      const row = await maybeRow(
        db.from('heritage_sites').select('*').eq('id', id),
        'tarihi alan okunamadı',
      );
      if (!row) return null;
      const [saved, visited] = await Promise.all([savedSet(meId), visitedSet(meId)]);
      return withMeta(toHeritageSite(row), origin, saved, visited);
    },

    async audioGuide(siteId) {
      const data = await rows(
        db.from('audio_guide_stops').select('*').eq('site_id', siteId),
        'sesli rehber okunamadı',
      );
      return sortGuideStops(data.map(toAudioGuideStop));
    },

    async toggleSave(meId, siteId) {
      await requireUser(db, meId);
      await requireSite(siteId);
      const existing = await maybeRow(
        db.from('heritage_saves').select('site_id').eq('user_id', meId).eq('site_id', siteId),
        'kayıt okunamadı',
      );
      if (existing) {
        await rows(
          db.from('heritage_saves').delete().eq('user_id', meId).eq('site_id', siteId),
          'kayıt kaldırılamadı',
        );
        return false;
      }
      await rows(
        db.from('heritage_saves').insert({ user_id: meId, site_id: siteId }),
        'kaydedilemedi',
      );
      return true;
    },

    async markVisited(meId, siteId) {
      await requireUser(db, meId);
      const site = await requireSite(siteId);
      const note = xpNote(site);
      const existing = await maybeRow(
        db.from('heritage_visits').select('site_id').eq('user_id', meId).eq('site_id', siteId),
        'ziyaret okunamadı',
      );
      if (existing) {
        // Geri alma: ziyareti ve verilen XP olayını kaldır (puan çiftlemesini önler).
        await rows(
          db.from('heritage_visits').delete().eq('user_id', meId).eq('site_id', siteId),
          'ziyaret kaldırılamadı',
        );
        await rows(
          db.from('xp_events').delete().eq('user_id', meId).eq('note', note),
          'XP kaydı kaldırılamadı',
        );
        return false;
      }
      await rows(
        db.from('heritage_visits').insert({ user_id: meId, site_id: siteId }),
        'ziyaret kaydedilemedi',
      );
      await rows(
        db.from('xp_events').insert({
          user_id: meId,
          source: 'route',
          amount: HERITAGE_VISIT_XP,
          note,
          ref_table: 'heritage_sites',
          ref_id: siteId,
        }),
        'XP yazılamadı',
      );
      return true;
    },

    async tours(meId) {
      const data = await rows(
        db
          .from('heritage_tours')
          .select('*')
          .eq('user_id', meId)
          .order('created_at', { ascending: false }),
        'turlar okunamadı',
      );
      return data.map(toHeritageTour);
    },

    async createTour(meId, input) {
      await requireUser(db, meId);
      const title = input.title.trim();
      const known = input.siteIds.length
        ? await rows(
            db.from('heritage_sites').select('id').in('id', input.siteIds),
            'tarihi alanlar okunamadı',
          )
        : [];
      const knownIds = new Set(known.map((row) => String(row.id)));
      const siteIds = input.siteIds.filter((id) => knownIds.has(id));
      const date = input.date?.trim() || null;
      const error = validateHeritageTourInput({ title, siteIds, date });
      if (error === 'nameRequired') throw new Error('Tura bir ad ver.');
      if (error === 'minSites') throw new Error('En az 2 alan seç.');
      if (error === 'invalidDate') throw new Error('Tarih YYYY-AA-GG biçiminde olmalı.');
      const created = await oneRow(
        db
          .from('heritage_tours')
          .insert({
            user_id: meId,
            title,
            site_ids: siteIds,
            date: date ? dayKey(date) : null,
            notes: input.notes.trim(),
          })
          .select('*'),
        'tur oluşturulamadı',
      );
      return toHeritageTour(created);
    },

    async deleteTour(meId, tourId) {
      const deleted = await rows(
        db.from('heritage_tours').delete().eq('id', tourId).eq('user_id', meId).select('*'),
        'tur silinemedi',
      );
      if (!deleted.length) throw new Error('Tur bulunamadı.');
    },

    async nearby(origin, radiusKm) {
      const shortlist = await rows(
        db.rpc('nearby_heritage_sites', {
          lat: origin.latitude,
          lng: origin.longitude,
          radius_km: radiusKm,
          max_rows: 200,
        }),
        'yakın tarihi alanlar okunamadı',
      );
      const ids = shortlist.map((row) => String(row.id));
      if (!ids.length) return [];
      const data = await rows(
        db.from('heritage_sites').select('*').in('id', ids),
        'tarihi alanlar okunamadı',
      );
      const empty = new Set<ID>();
      return data
        .map((row) => withMeta(toHeritageSite(row), origin, empty, empty))
        .filter((s) => (s.distanceKm ?? Infinity) <= radiusKm)
        .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    },
  };
}

/* ================================================================== */
/* Çocuk modülü                                                       */
/* ================================================================== */

/** Çıkartma kazanınca eğlence XP'si (fun modülü sıralamasına yansır). */
const STICKER_XP = 25;

export function createKidsRepository(ctx: RemoteContext): KidsRepository {
  const { db } = ctx;

  const savedSet = async (meId: ID): Promise<Set<ID>> => {
    const data = await rows(
      db.from('kid_place_saves').select('place_id').eq('user_id', meId),
      'kayıtlar okunamadı',
    );
    return new Set(data.map((row) => String(row.place_id)));
  };

  const ensureProgress = async (meId: ID, childName: string): Promise<HuntProgress> => {
    const existing = await maybeRow(
      db.from('hunt_progress').select('*').eq('user_id', meId).eq('child_name', childName),
      'ilerleme okunamadı',
    );
    if (existing) return toHuntProgress(existing);
    const created = await oneRow(
      db
        .from('hunt_progress')
        .insert({
          user_id: meId,
          child_name: childName,
          completed_task_ids: [],
          stickers: [],
          points: 0,
        })
        .select('*'),
      'ilerleme oluşturulamadı',
    );
    return toHuntProgress(created);
  };

  return {
    async places(meId, filter) {
      const data = await rows(db.from('kid_places').select('*'), 'yerler okunamadı');
      const saved = await savedSet(meId);
      const all = data
        .map(toKidPlace)
        .map((p) => withKidPlaceDistance(p, filter.origin, saved.has(p.id)));
      return filterKidPlaces(all, filter);
    },

    async place(meId, id, origin) {
      const row = await maybeRow(db.from('kid_places').select('*').eq('id', id), 'yer okunamadı');
      if (!row) return null;
      const saved = await savedSet(meId);
      const place = toKidPlace(row);
      return withKidPlaceDistance(place, origin, saved.has(place.id));
    },

    async toggleSave(meId, placeId) {
      await requireUser(db, meId);
      const exists = await maybeRow(
        db.from('kid_places').select('id').eq('id', placeId),
        'yer okunamadı',
      );
      if (!exists) throw new Error('Yer bulunamadı');
      const existing = await maybeRow(
        db.from('kid_place_saves').select('place_id').eq('user_id', meId).eq('place_id', placeId),
        'kayıt okunamadı',
      );
      if (existing) {
        await rows(
          db.from('kid_place_saves').delete().eq('user_id', meId).eq('place_id', placeId),
          'kayıt kaldırılamadı',
        );
        return false;
      }
      await rows(
        db.from('kid_place_saves').insert({ user_id: meId, place_id: placeId }),
        'kaydedilemedi',
      );
      return true;
    },

    async children(meId) {
      const data = await rows(
        db
          .from('child_profiles')
          .select('*')
          .eq('user_id', meId)
          .order('created_at', { ascending: true }),
        'çocuk profilleri okunamadı',
      );
      return data.map(toChildProfile);
    },

    async addChild(meId, name, ageBand, avatar) {
      await requireUser(db, meId);
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Çocuk adı gerekli');
      const existing = await rows(
        db.from('child_profiles').select('name').eq('user_id', meId),
        'çocuk profilleri okunamadı',
      );
      if (
        existing.some(
          (row) =>
            String(row.name).toLocaleLowerCase('tr-TR') === trimmed.toLocaleLowerCase('tr-TR'),
        )
      ) {
        throw new Error('Bu adla bir profil zaten var');
      }
      const created = await oneRow(
        db
          .from('child_profiles')
          .insert({ user_id: meId, name: trimmed, age_band: ageBand, avatar: avatar || '🦊' })
          .select('*'),
        'çocuk profili eklenemedi',
      );
      return toChildProfile(created);
    },

    async removeChild(meId, childId) {
      const removed = await rows(
        db.from('child_profiles').delete().eq('id', childId).eq('user_id', meId).select('*'),
        'profil silinemedi',
      );
      const child = removed[0];
      if (!child) throw new Error('Profil bulunamadı');
      await rows(
        db
          .from('hunt_progress')
          .delete()
          .eq('user_id', meId)
          .eq('child_name', String(child.name)),
        'ilerleme silinemedi',
      );
    },

    async huntTasks(ageBand) {
      const data = await rows(db.from('hunt_tasks').select('*'), 'görevler okunamadı');
      return huntTasksFor(data.map(toHuntTask), ageBand);
    },

    async huntProgress(meId, childName) {
      const row = await maybeRow(
        db.from('hunt_progress').select('*').eq('user_id', meId).eq('child_name', childName),
        'ilerleme okunamadı',
      );
      return row
        ? toHuntProgress(row)
        : {
            userId: meId,
            childName,
            completedTaskIds: [],
            stickers: [],
            points: 0,
            updatedAt: new Date(0).toISOString(),
          };
    },

    async completeTask(meId, childName, taskId) {
      await requireUser(db, meId);
      const taskRow = await maybeRow(
        db.from('hunt_tasks').select('*').eq('id', taskId),
        'görev okunamadı',
      );
      if (!taskRow) throw new Error('Görev bulunamadı');
      const task = toHuntTask(taskRow);
      const progress = await ensureProgress(meId, childName);
      if (progress.completedTaskIds.includes(taskId)) return progress;

      const points = progress.points + task.points;
      const earned = earnedStickers(points);
      const fresh = earned.filter((s) => !progress.stickers.includes(s));
      const updated = await oneRow(
        db
          .from('hunt_progress')
          .update({
            completed_task_ids: [...progress.completedTaskIds, taskId],
            points,
            stickers: [...progress.stickers, ...fresh],
          })
          .eq('user_id', meId)
          .eq('child_name', childName)
          .select('*'),
        'ilerleme güncellenemedi',
      );
      for (const sticker of fresh) {
        await rows(
          db.from('xp_events').insert({
            user_id: meId,
            source: 'quiz',
            amount: STICKER_XP,
            note: `Küçük Kâşif çıkartması: ${sticker} (${childName})`,
            ref_table: 'hunt_progress',
            ref_id: `${childName}:${sticker}`,
          }),
          'XP yazılamadı',
        );
      }
      return toHuntProgress(updated);
    },

    async resetHunt(meId, childName) {
      await ensureProgress(meId, childName);
      const updated = await oneRow(
        db
          .from('hunt_progress')
          .update({ completed_task_ids: [], stickers: [], points: 0 })
          .eq('user_id', meId)
          .eq('child_name', childName)
          .select('*'),
        'ilerleme sıfırlanamadı',
      );
      return toHuntProgress(updated);
    },

    async checklist(ageBand) {
      const data = await rows(
        db.from('family_checklist_items').select('*'),
        'kontrol listesi okunamadı',
      );
      return familyChecklistFor(data.map(toFamilyChecklistItem), ageBand);
    },
  };
}
