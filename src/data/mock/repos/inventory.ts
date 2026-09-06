import { generateId } from '@/core/utils/format';
import type { InventoryRepository } from '@/data/repositories';
import type {
  BookingWithPayment,
  BookStayInput,
  Business,
  CancellationPolicy,
  HostProfile,
  ID,
  Payment,
  QuoteInput,
  StayBooking,
  StayReviewWithAuthor,
  StayUnit,
  UnitBlock,
} from '@/domain';
import {
  applyPaymentEvent,
  availabilityFor,
  buildQuote,
  canCancel,
  canReview,
  toDayKey,
  nightsBetweenDays,
  payoutSummary,
  refundAmount,
  VERIFICATION_RANK,
} from '@/domain';

import type { MockContext } from '../context';
import type { Tables } from '../database';
import { seedInventoryBookings } from '../seed.inventory';

const DEFAULT_POLICY: CancellationPolicy = 'moderate';

/** Varsayılan ev sahibi profili (kayıtlı profil yoksa) */
function defaultProfile(businessId: ID): HostProfile {
  return {
    businessId,
    verification: 'none',
    cancellationPolicy: DEFAULT_POLICY,
    responseRatePct: 0,
    responseTimeMin: 0,
    payoutIban: null,
    pendingPayoutTry: 0,
    paidOutTry: 0,
  };
}

/** inventory modülü mock repository fabrikası. */
export function createInventoryRepository(ctx: MockContext): InventoryRepository {
  /**
   * Modülün ek demo rezervasyonlarını t.stayBookings tablosuna tembel ekler
   * (database.ts değiştirilmeden). Kimliğe göre idempotenttir.
   */
  const load = async (): Promise<Tables> => {
    const t = await ctx.db.load();
    let added = false;
    for (const b of seedInventoryBookings) {
      if (!t.stayBookings.some((x) => x.id === b.id)) {
        t.stayBookings.push({ ...b });
        added = true;
      }
    }
    if (added) ctx.db.markDirty();
    return t;
  };

  const findBusiness = (t: Tables, id: ID): Business => {
    const b = t.businesses.find((x) => x.id === id);
    if (!b) throw new Error('İşletme bulunamadı.');
    return b;
  };

  const findUnit = (t: Tables, id: ID): StayUnit => {
    const u = t.stayUnits.find((x) => x.id === id);
    if (!u) throw new Error('Birim bulunamadı.');
    return u;
  };

  const findBooking = (t: Tables, id: ID): StayBooking => {
    const b = t.stayBookings.find((x) => x.id === id);
    if (!b) throw new Error('Rezervasyon bulunamadı.');
    return b;
  };

  const profileOf = (t: Tables, businessId: ID): HostProfile => {
    let p = t.hostProfiles.find((x) => x.businessId === businessId);
    if (!p) {
      p = defaultProfile(businessId);
      t.hostProfiles.push(p);
      ctx.db.markDirty();
    }
    return p;
  };

  const policyOf = (t: Tables, businessId: ID): CancellationPolicy =>
    t.hostProfiles.find((x) => x.businessId === businessId)?.cancellationPolicy ?? DEFAULT_POLICY;

  /** Mutasyonlar yalnızca işletme sahibine açıktır. */
  const requireOwner = (t: Tables, meId: ID, businessId: ID): Business => {
    const b = findBusiness(t, businessId);
    if (b.ownerId !== meId) throw new Error('Bu işlem yalnızca işletme sahibine açık.');
    return b;
  };

  const unitOfBooking = (t: Tables, bookingId: ID): StayUnit | null => {
    const block = t.unitBlocks.find((b) => b.bookingId === bookingId);
    return block ? (t.stayUnits.find((u) => u.id === block.unitId) ?? null) : null;
  };

  const withPayment = (t: Tables, booking: StayBooking): BookingWithPayment => ({
    ...booking,
    business: findBusiness(t, booking.businessId),
    unit: unitOfBooking(t, booking.id),
    payment: t.payments.find((p) => p.bookingId === booking.id) ?? null,
    policy: policyOf(t, booking.businessId),
  });

  const withAuthor = (t: Tables, reviewId: ID): StayReviewWithAuthor => {
    const r = t.stayReviews.find((x) => x.id === reviewId);
    if (!r) throw new Error('Yorum bulunamadı.');
    return { ...r, author: ctx.requireUser(t.users, r.authorId) };
  };

  /** İşletmenin ödemelerinden bekleyen/ödenen tutarı profile işler. */
  const refreshPayouts = (t: Tables, businessId: ID): HostProfile => {
    const profile = profileOf(t, businessId);
    const bookings = t.stayBookings.filter((b) => b.businessId === businessId);
    const summary = payoutSummary(bookings, t.payments);
    profile.pendingPayoutTry = summary.pendingTry;
    profile.paidOutTry = summary.paidTry;
    return profile;
  };

  const quoteFor = (t: Tables, input: QuoteInput) => {
    const unit = findUnit(t, input.unitId);
    if (unit.businessId !== input.businessId) throw new Error('Birim bu işletmeye ait değil.');
    if (nightsBetweenDays(input.checkIn, input.checkOut) < 1) {
      throw new Error('Çıkış tarihi girişten sonra olmalı.');
    }
    const blocks = t.unitBlocks.filter((b) => b.unitId === unit.id);
    return { unit, quote: buildQuote(unit, blocks, policyOf(t, unit.businessId), input) };
  };

  return {
    async units(businessId) {
      await ctx.wait();
      const t = await load();
      return t.stayUnits.filter((u) => u.businessId === businessId);
    },

    async availability(unitId, from, to) {
      await ctx.wait();
      const t = await load();
      const unit = findUnit(t, unitId);
      const blocks = t.unitBlocks.filter((b) => b.unitId === unitId);
      return availabilityFor(unit, blocks, from, to);
    },

    async quote(input) {
      await ctx.wait();
      const t = await load();
      return quoteFor(t, input).quote;
    },

    async book(meId, input) {
      await ctx.wait();
      const t = await load();
      ctx.requireUser(t.users, meId);
      const { unit, quote } = quoteFor(t, input);
      if (!quote.available) {
        throw new Error(
          input.guests > unit.capacity
            ? 'Misafir sayısı birim kapasitesini aşıyor.'
            : 'Seçilen tarihlerde müsaitlik yok.',
        );
      }
      const business = findBusiness(t, unit.businessId);
      const nowIso = new Date().toISOString();
      const booking: StayBooking = {
        id: generateId('sb'),
        businessId: business.id,
        guestId: meId,
        checkIn: `${toDayKey(input.checkIn)}T14:00:00.000Z`,
        checkOut: `${toDayKey(input.checkOut)}T11:00:00.000Z`,
        guests: input.guests,
        nights: quote.nights,
        totalTry: quote.totalTry,
        platformFeeTry: quote.platformFeeTry,
        status: 'confirmed',
        createdAt: nowIso,
      };
      const block: UnitBlock = {
        id: generateId('blk'),
        unitId: unit.id,
        from: toDayKey(input.checkIn),
        to: toDayKey(input.checkOut),
        reason: 'booking',
        bookingId: booking.id,
      };
      const providerChoice = (input as BookStayInput).provider;
      // Kart bloke (authorize) → emanete al (capture)
      let payment: Payment = {
        id: generateId('pay'),
        bookingId: booking.id,
        payerId: meId,
        amountTry: quote.totalTry,
        platformFeeTry: quote.platformFeeTry,
        status: 'pending',
        provider: providerChoice === 'card' ? 'stripe' : 'iyzico',
        createdAt: nowIso,
        releasedAt: null,
        refundedTry: 0,
        timeline: [],
      };
      payment = applyPaymentEvent(payment, 'authorize', nowIso);
      payment = applyPaymentEvent(payment, 'capture', nowIso);

      t.stayBookings.unshift(booking);
      t.unitBlocks.push(block);
      t.payments.unshift(payment);
      refreshPayouts(t, business.id);
      ctx.db.markDirty();
      await ctx.pushNotification({
        type: 'stay_request',
        senderId: meId,
        receiverId: business.ownerId,
        message: `${business.name} · ${unit.name}`,
        postId: null,
        matchId: null,
        targetId: booking.id,
      });
      return withPayment(t, booking);
    },

    async booking(meId, bookingId) {
      await ctx.wait();
      const t = await load();
      const b = t.stayBookings.find((x) => x.id === bookingId);
      if (!b) return null;
      const business = findBusiness(t, b.businessId);
      // Misafir ya da işletme sahibi görebilir
      if (b.guestId !== meId && business.ownerId !== meId) return null;
      return withPayment(t, b);
    },

    async myBookings(meId) {
      await ctx.wait();
      const t = await load();
      return t.stayBookings
        .filter((b) => b.guestId === meId)
        .sort((a, b) => b.checkIn.localeCompare(a.checkIn))
        .map((b) => withPayment(t, b));
    },

    async refundPreview(meId, bookingId) {
      await ctx.wait();
      const t = await load();
      const b = findBooking(t, bookingId);
      if (b.guestId !== meId) throw new Error('Bu rezervasyon sana ait değil.');
      return refundAmount(policyOf(t, b.businessId), b.checkIn, Date.now(), b.totalTry);
    },

    async cancel(meId, bookingId) {
      await ctx.wait();
      const t = await load();
      const b = findBooking(t, bookingId);
      if (b.guestId !== meId) throw new Error('Bu rezervasyon sana ait değil.');
      const nowMs = Date.now();
      if (!canCancel(b, nowMs)) throw new Error('Bu rezervasyon artık iptal edilemez.');
      const preview = refundAmount(policyOf(t, b.businessId), b.checkIn, nowMs, b.totalTry);
      const nowIso = new Date(nowMs).toISOString();
      const idx = t.payments.findIndex((p) => p.bookingId === b.id);
      if (idx !== -1) {
        const p = t.payments[idx]!;
        if (p.status === 'escrow' || p.status === 'authorized') {
          t.payments[idx] = applyPaymentEvent(p, 'refund', nowIso, preview.refundTry);
        }
      }
      // Tarihleri serbest bırak ama rezervasyon → birim bağını koru: bloğu sıfır uzunluğa
      // indiriyoruz (from === to hiçbir geceyle kesişmez), böylece iptal sonrası detay
      // ekranında birim ve gecelik kırılım görünmeye devam eder.
      for (const blk of t.unitBlocks) {
        if (blk.bookingId === b.id) blk.to = blk.from;
      }
      b.status = 'cancelled';
      refreshPayouts(t, b.businessId);
      ctx.db.markDirty();
      return withPayment(t, b);
    },

    async checkIn(meId, bookingId) {
      await ctx.wait();
      const t = await load();
      const b = findBooking(t, bookingId);
      const business = findBusiness(t, b.businessId);
      if (b.guestId !== meId && business.ownerId !== meId) {
        throw new Error('Bu rezervasyon sana ait değil.');
      }
      if (b.status !== 'confirmed' && b.status !== 'pending') {
        throw new Error('Yalnızca aktif rezervasyonlarda giriş yapılabilir.');
      }
      const nowIso = new Date().toISOString();
      const idx = t.payments.findIndex((p) => p.bookingId === b.id);
      if (idx !== -1) {
        let p = t.payments[idx]!;
        if (p.status === 'authorized') p = applyPaymentEvent(p, 'capture', nowIso);
        if (p.status === 'escrow') p = applyPaymentEvent(p, 'release', nowIso);
        t.payments[idx] = p;
      }
      b.status = 'completed';
      refreshPayouts(t, b.businessId);
      ctx.db.markDirty();
      return withPayment(t, b);
    },

    async reviews(businessId) {
      await ctx.wait();
      const t = await load();
      return t.stayReviews
        .filter((r) => r.businessId === businessId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((r) => withAuthor(t, r.id));
    },

    async review(meId, bookingId, rating, text) {
      await ctx.wait();
      const t = await load();
      const b = findBooking(t, bookingId);
      if (b.guestId !== meId) throw new Error('Bu rezervasyon sana ait değil.');
      if (!canReview(b, Date.now())) {
        throw new Error('Yalnızca tamamlanmış konaklamalar için yorum yazılabilir.');
      }
      if (t.stayReviews.some((r) => r.bookingId === bookingId)) {
        throw new Error('Bu konaklama için zaten yorum yazdın.');
      }
      const trimmed = text.trim();
      if (trimmed.length < 3) throw new Error('Birkaç kelime yazmalısın.');
      const clamped = Math.max(1, Math.min(5, Math.round(rating)));
      const review = {
        id: generateId('srv'),
        businessId: b.businessId,
        bookingId,
        authorId: meId,
        rating: clamped,
        text: trimmed,
        verifiedStay: true,
        createdAt: new Date().toISOString(),
      };
      t.stayReviews.unshift(review);
      const business = findBusiness(t, b.businessId);
      const total = business.rating * business.reviewCount + clamped;
      business.reviewCount += 1;
      business.rating = Math.round((total / business.reviewCount) * 10) / 10;
      ctx.db.markDirty();
      return withAuthor(t, review.id);
    },

    async host(_meId, businessId) {
      await ctx.wait();
      const t = await load();
      findBusiness(t, businessId);
      // Okuma demo amaçlı herkese açık; mutasyonlarda sahiplik aranır.
      return refreshPayouts(t, businessId);
    },

    async hostBookings(_meId, businessId) {
      await ctx.wait();
      const t = await load();
      findBusiness(t, businessId);
      return t.stayBookings
        .filter((b) => b.businessId === businessId)
        .sort((a, b) => b.checkIn.localeCompare(a.checkIn))
        .map((b) => withPayment(t, b));
    },

    async blockDates(meId, unitId, from, to) {
      await ctx.wait();
      const t = await load();
      const unit = findUnit(t, unitId);
      requireOwner(t, meId, unit.businessId);
      if (nightsBetweenDays(from, to) < 1) throw new Error('Çıkış tarihi girişten sonra olmalı.');
      const block: UnitBlock = {
        id: generateId('blk'),
        unitId,
        from: toDayKey(from),
        to: toDayKey(to),
        reason: 'owner',
        bookingId: null,
      };
      t.unitBlocks.push(block);
      ctx.db.markDirty();
      return block;
    },

    async upsertUnit(meId, unit) {
      await ctx.wait();
      const t = await load();
      requireOwner(t, meId, unit.businessId);
      if (!unit.name.trim()) throw new Error('Birim adı gerekli.');
      if (!(unit.basePriceTry > 0)) throw new Error('Geçerli bir fiyat gir.');
      const normalized: Omit<StayUnit, 'id'> = {
        ...unit,
        name: unit.name.trim(),
        capacity: Math.max(1, Math.round(unit.capacity)),
        quantity: Math.max(1, Math.round(unit.quantity)),
        basePriceTry: Math.round(unit.basePriceTry),
        weekendMultiplier: unit.weekendMultiplier > 0 ? unit.weekendMultiplier : 1,
      };
      if (unit.id) {
        const idx = t.stayUnits.findIndex((u) => u.id === unit.id);
        if (idx === -1) throw new Error('Birim bulunamadı.');
        if (t.stayUnits[idx]!.businessId !== unit.businessId) {
          throw new Error('Birim bu işletmeye ait değil.');
        }
        const updated: StayUnit = { ...normalized, id: unit.id };
        t.stayUnits[idx] = updated;
        ctx.db.markDirty();
        return updated;
      }
      const created: StayUnit = { ...normalized, id: generateId('unit') };
      t.stayUnits.push(created);
      // İşletmenin "başlayan fiyat" bilgisini en ucuz birimle eşitle
      const business = findBusiness(t, unit.businessId);
      const cheapest = Math.min(
        ...t.stayUnits.filter((u) => u.businessId === business.id).map((u) => u.basePriceTry),
      );
      if (business.priceFromTry === null || cheapest < business.priceFromTry) {
        business.priceFromTry = cheapest;
      }
      ctx.db.markDirty();
      return created;
    },

    async verifyHost(meId, businessId, level) {
      await ctx.wait();
      const t = await load();
      requireOwner(t, meId, businessId);
      const profile = profileOf(t, businessId);
      if (VERIFICATION_RANK[level] < VERIFICATION_RANK[profile.verification]) {
        throw new Error('Doğrulama seviyesi düşürülemez.');
      }
      profile.verification = level;
      if (level === 'premium') {
        const business = findBusiness(t, businessId);
        business.isVerified = true;
      }
      ctx.db.markDirty();
      return refreshPayouts(t, businessId);
    },
  };
}
