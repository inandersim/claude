import {
  canConfirm,
  compareGrades,
  cragVerificationOf,
  distanceKm,
  filterCrags,
  gradeIndex,
  verificationOf,
  type AscentWithUser,
  type ClimbingRoute,
  type Crag,
  type CragSector,
  type CragWithDistance,
  type GeoPoint,
  type ID,
} from '@/domain';

import type { ClimbingRepository } from '../../repositories';
import { PROFILE_SELECT, requireUser, type RemoteContext } from '../context';
import { toAscent, toClimbingRoute, toCrag, toCragSector, toUser } from '../mappers';
import { maybeRow, oneRow, rows, type Row } from '../postgrest';

/** climbing modülü uzak repository fabrikası. */
export function createClimbingRepository(ctx: RemoteContext): ClimbingRepository {
  const { db } = ctx;

  const withDistance = (crag: Crag, origin: GeoPoint | null): CragWithDistance => ({
    ...crag,
    distanceKm: origin ? distanceKm(origin, crag.coords) : null,
  });

  const requireCrag = async (id: ID): Promise<Crag> => {
    const row = await maybeRow(db.from('crags').select('*').eq('id', id), 'kaya okunamadı');
    if (!row) throw new Error(`Kaya bulunamadı: ${id}`);
    return toCrag(row);
  };

  const requireSector = async (id: ID): Promise<CragSector> => {
    const row = await maybeRow(
      db.from('crag_sectors').select('*').eq('id', id),
      'sektör okunamadı',
    );
    if (!row) throw new Error(`Sektör bulunamadı: ${id}`);
    return toCragSector(row);
  };

  const requireRoute = async (id: ID): Promise<ClimbingRoute> => {
    const row = await maybeRow(
      db.from('climbing_routes').select('*').eq('id', id),
      'rota okunamadı',
    );
    if (!row) throw new Error(`Rota bulunamadı: ${id}`);
    return toClimbingRoute(row);
  };

  /** Kayanın doğrulama durumunu rotalarından türetip yazar. */
  const syncCragVerification = async (cragId: ID): Promise<void> => {
    const routeRows = await rows(
      db.from('climbing_routes').select('verification').eq('crag_id', cragId),
      'rotalar okunamadı',
    );
    await rows(
      db
        .from('crags')
        .update({ verification: cragVerificationOf(routeRows.map(toClimbingRoute)) })
        .eq('id', cragId),
      'kaya doğrulaması güncellenemedi',
    );
  };

  return {
    async crags(filter) {
      // Uzamsal ön eleme sunucuda; süzme/sıralama domain fonksiyonunda.
      let query = db.from('crags').select('*');
      if (filter.countryCode) query = query.eq('country_code', filter.countryCode);
      const data = await rows(query, 'kayalar okunamadı');
      return filterCrags(data.map(toCrag), filter, filter.origin ?? null);
    },

    async crag(id, origin) {
      const row = await maybeRow(db.from('crags').select('*').eq('id', id), 'kaya okunamadı');
      return row ? withDistance(toCrag(row), origin) : null;
    },

    async sectors(cragId) {
      const data = await rows(
        db.from('crag_sectors').select('*').eq('crag_id', cragId),
        'sektörler okunamadı',
      );
      return data.map(toCragSector);
    },

    async routes(cragId, sectorId = null) {
      let query = db.from('climbing_routes').select('*').eq('crag_id', cragId);
      if (sectorId) query = query.eq('sector_id', sectorId);
      const data = await rows(query, 'rotalar okunamadı');
      // Kolaydan zora: sistemler karışık olabildiği için ortak zorluk puanı.
      return data
        .map(toClimbingRoute)
        .sort((a, b) => compareGrades(a.grade, a.gradeSystem, b.grade, b.gradeSystem));
    },

    async route(id, meId) {
      const row = await maybeRow(
        db.from('climbing_routes').select('*').eq('id', id),
        'rota okunamadı',
      );
      if (!row) return null;
      const route = toClimbingRoute(row);
      const [crag, sector, confirmation] = await Promise.all([
        requireCrag(route.cragId),
        requireSector(route.sectorId),
        meId
          ? maybeRow(
              db
                .from('route_confirmations')
                .select('route_id')
                .eq('user_id', meId)
                .eq('route_id', id),
              'onay okunamadı',
            )
          : Promise.resolve(null),
      ]);
      return { ...route, crag, sector, confirmedByMe: confirmation !== null };
    },

    async ascents(routeId) {
      const data = await rows(
        db
          .from('ascents')
          .select(`*, user:profiles!user_id(${PROFILE_SELECT})`)
          .eq('route_id', routeId)
          .order('date', { ascending: false }),
        'çıkışlar okunamadı',
      );
      return data.map<AscentWithUser>((row) => ({
        ...toAscent(row),
        user: toUser((row.user ?? {}) as Row),
      }));
    },

    async myAscents(meId) {
      const user = await requireUser(db, meId);
      const data = await rows(
        db.from('ascents').select('*').eq('user_id', meId).order('date', { ascending: false }),
        'çıkışlar okunamadı',
      );
      const ascents = data.map(toAscent);
      if (!ascents.length) return [];
      const routeRows = await rows(
        db
          .from('climbing_routes')
          .select('*')
          .in(
            'id',
            ascents.map((a) => a.routeId),
          ),
        'rotalar okunamadı',
      );
      const routes = new Map(routeRows.map((row) => [String(row.id), toClimbingRoute(row)]));
      const cragRows = await rows(
        db
          .from('crags')
          .select('*')
          .in(
            'id',
            routeRows.map((row) => String(row.crag_id)),
          ),
        'kayalar okunamadı',
      );
      const crags = new Map(cragRows.map((row) => [String(row.id), toCrag(row)]));
      return ascents.flatMap((a) => {
        const route = routes.get(a.routeId);
        const crag = route ? crags.get(route.cragId) : null;
        return route && crag ? [{ ...a, user, route, crag }] : [];
      });
    },

    async logAscent(meId, input) {
      const user = await requireUser(db, meId);
      const route = await requireRoute(input.routeId);
      // `ascents_count` sayacı ve `ascents_award_xp` XP'si tetikleyicilerle işlenir.
      const created = await oneRow(
        db
          .from('ascents')
          .insert({
            route_id: route.id,
            user_id: meId,
            style: input.style,
            date: new Date().toISOString().slice(0, 10),
            note: input.note.trim(),
            felt_grade: input.feltGrade?.trim() || null,
          })
          .select('*'),
        'çıkış kaydedilemedi',
      );
      return { ...toAscent(created), user };
    },

    async submitRoute(meId, input) {
      await requireUser(db, meId);
      const crag = await requireCrag(input.cragId);
      const sector = await requireSector(input.sectorId);
      if (sector.cragId !== crag.id) throw new Error('Sektör bu kayaya ait değil.');
      const name = input.name.trim();
      if (!name) throw new Error('Rota adı zorunlu.');
      if (gradeIndex(input.grade, input.gradeSystem) < 0) throw new Error('Geçersiz derece.');
      // `sync_crag_route_counts` tetikleyicisi kaya/sektör sayaçlarını günceller.
      const created = await oneRow(
        db
          .from('climbing_routes')
          .insert({
            crag_id: crag.id,
            sector_id: sector.id,
            name,
            type: input.type,
            grade: input.grade.trim(),
            grade_system: input.gradeSystem,
            length_m: input.lengthM,
            pitches: Math.max(1, Math.round(input.pitches)),
            bolts: null,
            stars: 0,
            first_ascent: null,
            description: input.description.trim(),
            verification: verificationOf(0, false, false),
            submitted_by: meId,
          })
          .select('*'),
        'rota eklenemedi',
      );
      const route = toClimbingRoute(created);
      if (!crag.climbTypes.includes(route.type)) {
        await rows(
          db
            .from('crags')
            .update({ climb_types: [...crag.climbTypes, route.type] })
            .eq('id', crag.id),
          'kaya türleri güncellenemedi',
        );
      }
      await syncCragVerification(crag.id);
      return route;
    },

    async confirmRoute(meId, routeId) {
      await requireUser(db, meId);
      const route = await requireRoute(routeId);
      const existing = await rows(
        db.from('route_confirmations').select('user_id, route_id').eq('route_id', routeId),
        'onaylar okunamadı',
      );
      const confirmations = existing.map((row) => ({
        userId: String(row.user_id),
        routeId: String(row.route_id),
      }));
      if (!canConfirm(route, meId, confirmations)) {
        throw new Error('Bu rotayı onaylayamazsın.');
      }
      // `route_confirmations_count` sayacı ve `promote_route_verification`
      // doğrulama yükseltmesi tetikleyicilerle yapılır.
      await rows(
        db.from('route_confirmations').insert({ user_id: meId, route_id: routeId }),
        'rota onaylanamadı',
      );
      const fresh = await requireRoute(routeId);
      const verification = verificationOf(fresh.confirmations, false, false);
      if (verification !== fresh.verification) {
        await rows(
          db.from('climbing_routes').update({ verification }).eq('id', routeId),
          'doğrulama güncellenemedi',
        );
      }
      await syncCragVerification(fresh.cragId);
      return { ...fresh, verification };
    },
  };
}
