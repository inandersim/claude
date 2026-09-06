import {
  VERIFICATION_RANK,
  applyPaymentEvent,
  availabilityFor,
  buildQuote,
  canCancel,
  canReview,
  nightsBetweenDays,
  payoutSummary,
  refundAmount,
  toDayKey,
  type BookStayInput,
  type BookingWithPayment,
  type Business,
  type CancellationPolicy,
  type HostProfile,
  type ID,
  type Payment,
  type QuoteInput,
  type StayBooking,
  type StayReviewWithAuthor,
  type StayUnit,
  type UnitBlock,
} from '@/domain';

import type { InventoryRepository } from '../../repositories';
import { PROFILE_SELECT, notify, requireUser, type RemoteContext } from '../context';
import {
  num,
  toBusiness,
  toDateRange,
  toHostProfile,
  toPayment,
  toStayBooking,
  toStayReview,
  toStayUnit,
  toUnitBlock,
  toUser,
} from '../mappers';
import { RemoteError, maybeRow, oneRow, rows, type Row } from '../postgrest';

const DEFAULT_POLICY: CancellationPolicy = 'moderate';

/** Rezervasyon çakışması: `unit_blocks_no_overlap` EXCLUDE kısıtı ya da reserve_unit hatası. */
function isOverbooking(error: unknown): boolean {
  if (!(error instanceof RemoteError)) return false;
  return (
    error.code === '23P01' ||
    error.code === '23514' ||
    /uygun yer kalmadı|unit_blocks_no_overlap/i.test(error.message)
  );
}

/** envanter modülü uzak repository fabrikası. */
export function createInventoryRepository(ctx: RemoteContext): InventoryRepository {
  const { db } = ctx;

  const findBusiness = async (id: ID): Promise<Business> => {
    const row = await maybeRow(db.from('businesses').select('*').eq('id', id), 'işletme okunamadı');
    if (!row) throw new Error('İşletme bulunamadı.');
    return toBusiness(row);
  };

  const findUnit = async (id: ID): Promise<StayUnit> => {
    const row = await maybeRow(db.from('stay_units').select('*').eq('id', id), 'birim okunamadı');
    if (!row) throw new Error('Birim bulunamadı.');
    return toStayUnit(row);
  };

  const findBooking = async (id: ID): Promise<StayBooking> => {
    const row = await maybeRow(
      db.from('stay_bookings').select('*').eq('id', id),
      'rezervasyon okunamadı',
    );
    if (!row) throw new Error('Rezervasyon bulunamadı.');
    return toStayBooking(row);
  };

  const blocksOf = async (unitId: ID): Promise<UnitBlock[]> => {
    const data = await rows(
      db.from('unit_blocks').select('*').eq('unit_id', unitId),
      'bloklar okunamadı',
    );
    return data.map(toUnitBlock);
  };

  /** Ev sahibi profili; yoksa varsayılan değerlerle oluşturur. */
  const profileOf = async (businessId: ID): Promise<HostProfile> => {
    const existing = await maybeRow(
      db.from('host_profiles').select('*').eq('business_id', businessId),
      'ev sahibi profili okunamadı',
    );
    if (existing) return toHostProfile(existing);
    const created = await oneRow(
      db
        .from('host_profiles')
        .insert({
          business_id: businessId,
          verification: 'none',
          cancellation_policy: DEFAULT_POLICY,
          response_rate_pct: 0,
          response_time_min: 0,
          pending_payout_try: 0,
          paid_out_try: 0,
        })
        .select('*'),
      'ev sahibi profili oluşturulamadı',
    );
    return toHostProfile(created);
  };

  const policyOf = async (businessId: ID): Promise<CancellationPolicy> => {
    const row = await maybeRow(
      db.from('host_profiles').select('cancellation_policy').eq('business_id', businessId),
      'iptal politikası okunamadı',
    );
    return row ? (String(row.cancellation_policy) as CancellationPolicy) : DEFAULT_POLICY;
  };

  const requireOwner = async (meId: ID, businessId: ID): Promise<Business> => {
    const business = await findBusiness(businessId);
    if (business.ownerId !== meId) throw new Error('Bu işlem yalnızca işletme sahibine açık.');
    return business;
  };

  const withPayment = async (booking: StayBooking): Promise<BookingWithPayment> => {
    const [business, policy, paymentRow] = await Promise.all([
      findBusiness(booking.businessId),
      policyOf(booking.businessId),
      maybeRow(db.from('payments').select('*').eq('booking_id', booking.id), 'ödeme okunamadı'),
    ]);
    // Birim bağı doğrudan; eski kayıtlarda blok üzerinden çözülür.
    let unitId = booking.unitId;
    if (!unitId) {
      const block = await maybeRow(
        db.from('unit_blocks').select('unit_id').eq('booking_id', booking.id),
        'blok okunamadı',
      );
      unitId = block ? String(block.unit_id) : null;
    }
    const unit = unitId
      ? await maybeRow(db.from('stay_units').select('*').eq('id', unitId), 'birim okunamadı')
      : null;
    return {
      ...booking,
      business,
      unit: unit ? toStayUnit(unit) : null,
      payment: paymentRow ? toPayment(paymentRow) : null,
      policy,
    };
  };

  const withPaymentMany = async (bookings: StayBooking[]): Promise<BookingWithPayment[]> => {
    const out: BookingWithPayment[] = [];
    for (const booking of bookings) out.push(await withPayment(booking));
    return out;
  };

  /** İşletmenin ödemelerinden bekleyen/ödenen tutarı profile işler. */
  const refreshPayouts = async (businessId: ID): Promise<HostProfile> => {
    await profileOf(businessId);
    const bookingRows = await rows(
      db.from('stay_bookings').select('id').eq('business_id', businessId),
      'rezervasyonlar okunamadı',
    );
    const ids = bookingRows.map((row) => String(row.id));
    const paymentRows = ids.length
      ? await rows(db.from('payments').select('*').in('booking_id', ids), 'ödemeler okunamadı')
      : [];
    const summary = payoutSummary(
      ids.map((id) => ({ id })),
      paymentRows.map(toPayment),
    );
    const updated = await oneRow(
      db
        .from('host_profiles')
        .update({ pending_payout_try: summary.pendingTry, paid_out_try: summary.paidTry })
        .eq('business_id', businessId)
        .select('*'),
      'ödeme özeti güncellenemedi',
    );
    return toHostProfile(updated);
  };

  const quoteFor = async (input: QuoteInput) => {
    const unit = await findUnit(input.unitId);
    if (unit.businessId !== input.businessId) throw new Error('Birim bu işletmeye ait değil.');
    if (nightsBetweenDays(input.checkIn, input.checkOut) < 1) {
      throw new Error('Çıkış tarihi girişten sonra olmalı.');
    }
    const blocks = await blocksOf(unit.id);
    const quote = buildQuote(unit, blocks, await policyOf(unit.businessId), input);
    return { unit, quote };
  };

  return {
    async units(businessId) {
      const data = await rows(
        db.from('stay_units').select('*').eq('business_id', businessId),
        'birimler okunamadı',
      );
      return data.map(toStayUnit);
    },

    async availability(unitId, from, to) {
      const unit = await findUnit(unitId);
      return availabilityFor(unit, await blocksOf(unitId), from, to);
    },

    async quote(input) {
      return (await quoteFor(input)).quote;
    },

    async book(meId, input) {
      await requireUser(db, meId);
      const { unit, quote } = await quoteFor(input);
      if (!quote.available) {
        throw new Error(
          input.guests > unit.capacity
            ? 'Misafir sayısı birim kapasitesini aşıyor.'
            : 'Seçilen tarihlerde müsaitlik yok.',
        );
      }
      const business = await findBusiness(unit.businessId);
      const nowIso = new Date().toISOString();
      const created = await oneRow(
        db
          .from('stay_bookings')
          .insert({
            business_id: business.id,
            unit_id: unit.id,
            guest_id: meId,
            check_in: toDayKey(input.checkIn),
            check_out: toDayKey(input.checkOut),
            guests: input.guests,
            nights: quote.nights,
            total_try: quote.totalTry,
            platform_fee_try: quote.platformFeeTry,
            status: 'confirmed',
          })
          .select('*'),
        'rezervasyon oluşturulamadı',
      );
      const booking = toStayBooking(created);

      // Çakışma kontrolü veritabanındadır: `reserve_unit` boş slot bulur,
      // `unit_blocks_no_overlap` kısıtı aşırı rezervasyonu imkânsız kılar.
      try {
        await rows(
          db.rpc('reserve_unit', {
            unit: unit.id,
            booking: booking.id,
            from_date: toDayKey(input.checkIn),
            to_date: toDayKey(input.checkOut),
          }),
          'birim ayrılamadı',
        );
      } catch (error) {
        await rows(
          db.from('stay_bookings').delete().eq('id', booking.id),
          'rezervasyon geri alınamadı',
        );
        if (isOverbooking(error)) throw new Error('Seçilen tarihlerde müsaitlik yok.');
        throw error;
      }

      const providerChoice = (input as BookStayInput).provider;
      // Kart bloke (authorize) → emanete al (capture)
      let payment: Payment = {
        id: '',
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
      await rows(
        db.from('payments').insert({
          booking_id: booking.id,
          payer_id: meId,
          amount_try: payment.amountTry,
          platform_fee_try: payment.platformFeeTry,
          status: payment.status,
          provider: payment.provider,
          timeline: payment.timeline,
        }),
        'ödeme kaydedilemedi',
      );
      await refreshPayouts(business.id);
      await notify(db, {
        type: 'stay_request',
        senderId: meId,
        receiverId: business.ownerId,
        message: `${business.name} · ${unit.name}`,
        postId: null,
        matchId: null,
        targetId: booking.id,
      });
      return await withPayment(booking);
    },

    async booking(meId, bookingId) {
      const row = await maybeRow(
        db.from('stay_bookings').select('*').eq('id', bookingId),
        'rezervasyon okunamadı',
      );
      if (!row) return null;
      const booking = toStayBooking(row);
      const business = await findBusiness(booking.businessId);
      // Misafir ya da işletme sahibi görebilir.
      if (booking.guestId !== meId && business.ownerId !== meId) return null;
      return await withPayment(booking);
    },

    async myBookings(meId) {
      const data = await rows(
        db
          .from('stay_bookings')
          .select('*')
          .eq('guest_id', meId)
          .order('check_in', { ascending: false }),
        'rezervasyonlar okunamadı',
      );
      return await withPaymentMany(data.map(toStayBooking));
    },

    async refundPreview(meId, bookingId) {
      const booking = await findBooking(bookingId);
      if (booking.guestId !== meId) throw new Error('Bu rezervasyon sana ait değil.');
      return refundAmount(
        await policyOf(booking.businessId),
        booking.checkIn,
        Date.now(),
        booking.totalTry,
      );
    },

    async cancel(meId, bookingId) {
      const booking = await findBooking(bookingId);
      if (booking.guestId !== meId) throw new Error('Bu rezervasyon sana ait değil.');
      const nowMs = Date.now();
      if (!canCancel(booking, nowMs)) throw new Error('Bu rezervasyon artık iptal edilemez.');
      const preview = refundAmount(
        await policyOf(booking.businessId),
        booking.checkIn,
        nowMs,
        booking.totalTry,
      );
      const nowIso = new Date(nowMs).toISOString();
      const paymentRow = await maybeRow(
        db.from('payments').select('*').eq('booking_id', booking.id),
        'ödeme okunamadı',
      );
      if (paymentRow) {
        const payment = toPayment(paymentRow);
        if (payment.status === 'escrow' || payment.status === 'authorized') {
          const next = applyPaymentEvent(payment, 'refund', nowIso, preview.refundTry);
          await rows(
            db
              .from('payments')
              .update({ status: next.status, refunded_try: next.refundedTry })
              .eq('id', payment.id),
            'ödeme iade edilemedi',
          );
        }
      }
      // `release_blocks_on_cancel` tetikleyicisi tarihleri serbest bırakır.
      await rows(
        db.from('stay_bookings').update({ status: 'cancelled' }).eq('id', bookingId),
        'rezervasyon iptal edilemedi',
      );
      await refreshPayouts(booking.businessId);
      return await withPayment(await findBooking(bookingId));
    },

    async checkIn(meId, bookingId) {
      const booking = await findBooking(bookingId);
      const business = await findBusiness(booking.businessId);
      if (booking.guestId !== meId && business.ownerId !== meId) {
        throw new Error('Bu rezervasyon sana ait değil.');
      }
      if (booking.status !== 'confirmed' && booking.status !== 'pending') {
        throw new Error('Yalnızca aktif rezervasyonlarda giriş yapılabilir.');
      }
      const nowIso = new Date().toISOString();
      const paymentRow = await maybeRow(
        db.from('payments').select('*').eq('booking_id', booking.id),
        'ödeme okunamadı',
      );
      if (paymentRow) {
        let payment = toPayment(paymentRow);
        if (payment.status === 'authorized')
          payment = applyPaymentEvent(payment, 'capture', nowIso);
        if (payment.status === 'escrow') payment = applyPaymentEvent(payment, 'release', nowIso);
        await rows(
          db
            .from('payments')
            .update({ status: payment.status, released_at: payment.releasedAt })
            .eq('id', payment.id),
          'ödeme güncellenemedi',
        );
      }
      await rows(
        db
          .from('stay_bookings')
          .update({ status: 'completed', checked_in_at: nowIso })
          .eq('id', bookingId),
        'giriş yapılamadı',
      );
      await refreshPayouts(booking.businessId);
      return await withPayment(await findBooking(bookingId));
    },

    async reviews(businessId) {
      const data = await rows(
        db
          .from('stay_reviews')
          .select(`*, author:profiles!author_id(${PROFILE_SELECT})`)
          .eq('business_id', businessId)
          .order('created_at', { ascending: false }),
        'yorumlar okunamadı',
      );
      return data.map<StayReviewWithAuthor>((row) => ({
        ...toStayReview(row),
        author: toUser((row.author ?? {}) as Row),
      }));
    },

    async review(meId, bookingId, rating, text) {
      const booking = await findBooking(bookingId);
      if (booking.guestId !== meId) throw new Error('Bu rezervasyon sana ait değil.');
      if (!canReview(booking, Date.now())) {
        throw new Error('Yalnızca tamamlanmış konaklamalar için yorum yazılabilir.');
      }
      const existing = await maybeRow(
        db.from('stay_reviews').select('id').eq('booking_id', bookingId),
        'yorum okunamadı',
      );
      if (existing) throw new Error('Bu konaklama için zaten yorum yazdın.');
      const trimmed = text.trim();
      if (trimmed.length < 3) throw new Error('Birkaç kelime yazmalısın.');
      const clamped = Math.max(1, Math.min(5, Math.round(rating)));
      // `sync_rating` tetikleyicisi işletmenin puanını günceller.
      const created = await oneRow(
        db
          .from('stay_reviews')
          .insert({
            business_id: booking.businessId,
            booking_id: bookingId,
            author_id: meId,
            rating: clamped,
            text: trimmed,
            verified_stay: true,
          })
          .select(`*, author:profiles!author_id(${PROFILE_SELECT})`),
        'yorum yazılamadı',
      );
      return { ...toStayReview(created), author: toUser((created.author ?? {}) as Row) };
    },

    async host(_meId, businessId) {
      await findBusiness(businessId);
      // Okuma herkese açık; mutasyonlarda sahiplik aranır.
      return await refreshPayouts(businessId);
    },

    async hostBookings(_meId, businessId) {
      await findBusiness(businessId);
      const data = await rows(
        db
          .from('stay_bookings')
          .select('*')
          .eq('business_id', businessId)
          .order('check_in', { ascending: false }),
        'rezervasyonlar okunamadı',
      );
      return await withPaymentMany(data.map(toStayBooking));
    },

    async blockDates(meId, unitId, from, to) {
      const unit = await findUnit(unitId);
      await requireOwner(meId, unit.businessId);
      if (nightsBetweenDays(from, to) < 1) throw new Error('Çıkış tarihi girişten sonra olmalı.');
      const created = await oneRow(
        db
          .from('unit_blocks')
          .insert({
            unit_id: unitId,
            during: toDateRange(from, to),
            reason: 'owner',
            booking_id: null,
            slot: 0,
          })
          .select('*'),
        'tarihler kapatılamadı',
      );
      return toUnitBlock(created);
    },

    async upsertUnit(meId, unit) {
      await requireOwner(meId, unit.businessId);
      if (!unit.name.trim()) throw new Error('Birim adı gerekli.');
      if (!(unit.basePriceTry > 0)) throw new Error('Geçerli bir fiyat gir.');
      const payload: Row = {
        business_id: unit.businessId,
        name: unit.name.trim(),
        kind: unit.kind,
        capacity: Math.max(1, Math.round(unit.capacity)),
        quantity: Math.max(1, Math.round(unit.quantity)),
        base_price_try: Math.round(unit.basePriceTry),
        weekend_multiplier: unit.weekendMultiplier > 0 ? unit.weekendMultiplier : 1,
        seasons: unit.seasons,
        amenities: unit.amenities,
      };
      if (unit.id) {
        const existing = await maybeRow(
          db.from('stay_units').select('business_id').eq('id', unit.id),
          'birim okunamadı',
        );
        if (!existing) throw new Error('Birim bulunamadı.');
        if (String(existing.business_id) !== unit.businessId) {
          throw new Error('Birim bu işletmeye ait değil.');
        }
        const updated = await oneRow(
          db.from('stay_units').update(payload).eq('id', unit.id).select('*'),
          'birim güncellenemedi',
        );
        return toStayUnit(updated);
      }
      const created = await oneRow(
        db.from('stay_units').insert(payload).select('*'),
        'birim oluşturulamadı',
      );
      // İşletmenin "başlayan fiyat" bilgisini en ucuz birimle eşitle.
      const business = await findBusiness(unit.businessId);
      const all = await rows(
        db.from('stay_units').select('base_price_try').eq('business_id', unit.businessId),
        'birimler okunamadı',
      );
      const cheapest = Math.min(...all.map((row) => num(row.base_price_try)));
      if (business.priceFromTry === null || cheapest < business.priceFromTry) {
        await rows(
          db.from('businesses').update({ price_from_try: cheapest }).eq('id', business.id),
          'başlangıç fiyatı güncellenemedi',
        );
      }
      return toStayUnit(created);
    },

    async verifyHost(meId, businessId, level) {
      await requireOwner(meId, businessId);
      const profile = await profileOf(businessId);
      if (VERIFICATION_RANK[level] < VERIFICATION_RANK[profile.verification]) {
        throw new Error('Doğrulama seviyesi düşürülemez.');
      }
      await rows(
        db.from('host_profiles').update({ verification: level }).eq('business_id', businessId),
        'doğrulama güncellenemedi',
      );
      if (level === 'premium') {
        await rows(
          db.from('businesses').update({ is_verified: true }).eq('id', businessId),
          'işletme doğrulanamadı',
        );
      }
      return await refreshPayouts(businessId);
    },
  };
}
