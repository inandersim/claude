import { generateId } from '@/core/utils/format';
import { olcumleriTemizle } from '@/domain/altitude';
import type { DestinationRepository } from '@/data/repositories';
import {
  distanceKm,
  filterDestinations,
  isOverdue,
  lakeLouiseScore,
  overdueMessage,
  sortStages,
  validateReturnPlanInput,
  type AmsSymptomScore,
  type Destination,
  type DestinationWithDistance,
  type GeoPoint,
  type ReturnPlan,
} from '@/domain';

import type { MockContext } from '../context';

/** destinations modülü mock repository fabrikası. */
export function createDestinationRepository(ctx: MockContext): DestinationRepository {
  const withMeta = (
    d: Destination,
    meId: string,
    origin: GeoPoint | null,
    savedSet: Set<string>,
  ): DestinationWithDistance => ({
    ...d,
    distanceKm: origin ? Math.round(distanceKm(origin, d.coords)) : null,
    savedByMe: savedSet.has(d.id),
  });

  const savedIdsOf = (
    t: Awaited<ReturnType<MockContext['db']['load']>>,
    meId: string,
  ): Set<string> =>
    new Set(t.savedDestinations.filter((s) => s.userId === meId).map((s) => s.destinationId));

  const findPlan = (
    t: Awaited<ReturnType<MockContext['db']['load']>>,
    meId: string,
    planId: string,
  ): ReturnPlan => {
    const plan = t.returnPlans.find((p) => p.id === planId && p.userId === meId);
    if (!plan) throw new Error('Yol planı bulunamadı.');
    return plan;
  };

  return {
    async list(meId, filter) {
      await ctx.wait();
      const t = await ctx.db.load();
      const saved = savedIdsOf(t, meId);
      const origin = filter.origin ?? null;
      return filterDestinations(t.destinations, filter).map((d) =>
        withMeta(d, meId, origin, saved),
      );
    },

    async getById(meId, id, origin) {
      await ctx.wait();
      const t = await ctx.db.load();
      const d = t.destinations.find((x) => x.id === id);
      if (!d) return null;
      return withMeta(d, meId, origin, savedIdsOf(t, meId));
    },

    async stages(destinationId) {
      await ctx.wait();
      const t = await ctx.db.load();
      return sortStages(t.destinationStages.filter((s) => s.destinationId === destinationId));
    },

    async toggleSave(meId, destinationId) {
      await ctx.wait();
      const t = await ctx.db.load();
      ctx.requireUser(t.users, meId);
      if (!t.destinations.some((d) => d.id === destinationId)) {
        throw new Error('Destinasyon bulunamadı.');
      }
      const index = t.savedDestinations.findIndex(
        (s) => s.userId === meId && s.destinationId === destinationId,
      );
      if (index >= 0) {
        t.savedDestinations.splice(index, 1);
        ctx.db.markDirty();
        return { saved: false };
      }
      t.savedDestinations.push({ userId: meId, destinationId });
      ctx.db.markDirty();
      return { saved: true };
    },

    async saved(meId) {
      await ctx.wait();
      const t = await ctx.db.load();
      const ids = t.savedDestinations.filter((s) => s.userId === meId).map((s) => s.destinationId);
      return ids
        .map((id) => t.destinations.find((d) => d.id === id))
        .filter((d): d is Destination => Boolean(d));
    },

    async amsChecks(meId) {
      await ctx.wait();
      const t = await ctx.db.load();
      return t.amsChecks
        .filter((c) => c.userId === meId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async logAms(meId, input) {
      await ctx.wait();
      const t = await ctx.db.load();
      ctx.requireUser(t.users, meId);
      if (!Number.isFinite(input.elevationM) || input.elevationM < 0 || input.elevationM > 9000) {
        throw new Error('Geçerli bir irtifa gir (0–9000 m).');
      }
      const clamp = (v: number): AmsSymptomScore =>
        Math.max(0, Math.min(3, Math.round(v))) as AmsSymptomScore;
      const headache = clamp(input.headache);
      const gi = clamp(input.gi);
      const fatigue = clamp(input.fatigue);
      const dizziness = clamp(input.dizziness);
      const { score, severity } = lakeLouiseScore(headache, gi, fatigue, dizziness);
      const check = {
        id: generateId('ams'),
        userId: meId,
        destinationId: input.destinationId ?? null,
        elevationM: Math.round(input.elevationM),
        headache,
        gi,
        fatigue,
        dizziness,
        score,
        severity,
        note: input.note.trim(),
        // Geçersiz ölçüm kırpılmaz, düşürülür (uzak sağlayıcıyla aynı kural).
        ...olcumleriTemizle(input),
        createdAt: new Date().toISOString(),
      };
      t.amsChecks.unshift(check);
      ctx.db.markDirty();
      return check;
    },

    async returnPlans(meId) {
      await ctx.wait();
      const t = await ctx.db.load();
      return t.returnPlans
        .filter((p) => p.userId === meId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async createReturnPlan(meId, input) {
      await ctx.wait();
      const t = await ctx.db.load();
      const me = ctx.requireUser(t.users, meId);
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
      if (input.destinationId && !t.destinations.some((d) => d.id === input.destinationId)) {
        throw new Error('Destinasyon bulunamadı.');
      }
      const nowIso = new Date().toISOString();
      const plan: ReturnPlan = {
        id: generateId('rp'),
        userId: meId,
        title: input.title.trim(),
        destinationId: input.destinationId ?? null,
        adventureType: input.adventureType,
        startAt: input.startAt,
        expectedReturnAt: input.expectedReturnAt,
        graceMin: Math.round(input.graceMin),
        route: input.route.trim(),
        companions: input.companions.trim(),
        contactIds: me.emergencyContacts
          .map((c) => c.userId)
          .filter((id): id is string => Boolean(id)),
        status: Date.parse(input.startAt) > Date.now() ? 'planned' : 'active',
        returnedAt: null,
        alertSentAt: null,
        createdAt: nowIso,
      };
      t.returnPlans.unshift(plan);
      ctx.db.markDirty();
      return plan;
    },

    async markReturned(meId, planId) {
      await ctx.wait();
      const t = await ctx.db.load();
      const plan = findPlan(t, meId, planId);
      if (plan.status === 'cancelled') throw new Error('İptal edilmiş plan kapatılamaz.');
      plan.status = 'returned';
      plan.returnedAt = new Date().toISOString();
      ctx.db.markDirty();
      return plan;
    },

    async cancelReturnPlan(meId, planId) {
      await ctx.wait();
      const t = await ctx.db.load();
      const plan = findPlan(t, meId, planId);
      if (plan.status === 'returned') throw new Error('Tamamlanmış plan iptal edilemez.');
      plan.status = 'cancelled';
      ctx.db.markDirty();
    },

    async checkOverdue(meId, now) {
      const t = await ctx.db.load();
      const me = ctx.requireUser(t.users, meId);
      const nowMs = Date.parse(now);
      const updated: ReturnPlan[] = [];
      for (const plan of t.returnPlans) {
        if (plan.userId !== meId) continue;
        if (plan.status !== 'active' && plan.status !== 'planned') continue;
        if (!isOverdue(plan, nowMs)) continue;
        plan.status = 'overdue';
        plan.alertSentAt = now;
        updated.push(plan);
        const message = overdueMessage(plan, me, 'tr');
        for (const contactId of plan.contactIds) {
          if (!t.users.some((u) => u.id === contactId)) continue;
          await ctx.pushNotification({
            type: 'trip_overdue',
            senderId: meId,
            receiverId: contactId,
            message,
            postId: null,
            matchId: null,
            targetId: plan.id,
          });
        }
      }
      if (updated.length > 0) ctx.db.markDirty();
      return updated;
    },
  };
}
