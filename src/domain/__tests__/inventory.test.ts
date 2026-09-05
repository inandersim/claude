import type { HostProfile, StayBooking, StayUnit, UnitBlock } from '../types';
import {
  availabilityFor,
  buildQuote,
  canCancel,
  canReview,
  eachNight,
  hostTrustScore,
  isAvailable,
  isWeekendNight,
  nextPaymentStatus,
  nightlyPrice,
  overlaps,
  paymentTimeline,
  payoutSummary,
  refundAmount,
  releaseDue,
  trustLabel,
} from '../inventory';

const unit: StayUnit = {
  id: 'u1',
  businessId: 'b1',
  name: 'Test Oda',
  kind: 'room',
  capacity: 2,
  quantity: 2,
  basePriceTry: 1000,
  weekendMultiplier: 1.5,
  seasons: [{ from: '2026-07-01', to: '2026-08-31', multiplier: 2 }],
  amenities: [],
};

// 2026-06-05 Cuma, 2026-06-06 Cumartesi, 2026-06-07 Pazar, 2026-06-08 Pazartesi
describe('takvim', () => {
  it('eachNight giriş dahil çıkış hariç geceleri listeler', () => {
    expect(eachNight('2026-06-05', '2026-06-08')).toEqual([
      '2026-06-05',
      '2026-06-06',
      '2026-06-07',
    ]);
    expect(eachNight('2026-06-05T14:00:00.000Z', '2026-06-06T11:00:00.000Z')).toEqual([
      '2026-06-05',
    ]);
    expect(eachNight('2026-06-05', '2026-06-05')).toEqual([]);
  });

  it('hafta sonu Cuma ve Cumartesi gecesidir', () => {
    expect(isWeekendNight('2026-06-05')).toBe(true);
    expect(isWeekendNight('2026-06-06')).toBe(true);
    expect(isWeekendNight('2026-06-07')).toBe(false);
    expect(isWeekendNight('2026-06-08')).toBe(false);
  });

  it('nightlyPrice hafta sonu ve sezon çarpanlarını uygular', () => {
    expect(nightlyPrice(unit, '2026-06-08')).toBe(1000); // hafta içi, sezon dışı
    expect(nightlyPrice(unit, '2026-06-05')).toBe(1500); // Cuma
    expect(nightlyPrice(unit, '2026-07-06')).toBe(2000); // Pazartesi, sezon
    expect(nightlyPrice(unit, '2026-07-03')).toBe(3000); // Cuma + sezon
    expect(nightlyPrice(unit, '2026-08-31')).toBe(2000); // sezon son günü dahil
    expect(nightlyPrice(unit, '2026-09-01')).toBe(1000); // sezon bitti
  });

  it('overlaps yarı açık aralıkları karşılaştırır', () => {
    expect(
      overlaps({ from: '2026-06-01', to: '2026-06-03' }, { from: '2026-06-03', to: '2026-06-05' }),
    ).toBe(false);
    expect(
      overlaps({ from: '2026-06-01', to: '2026-06-04' }, { from: '2026-06-03', to: '2026-06-05' }),
    ).toBe(true);
  });

  it('availabilityFor bloklar kadar adet düşer', () => {
    const blocks: UnitBlock[] = [
      {
        id: 'b1',
        unitId: 'u1',
        from: '2026-06-05',
        to: '2026-06-07',
        reason: 'booking',
        bookingId: 'x',
      },
      {
        id: 'b2',
        unitId: 'u1',
        from: '2026-06-06',
        to: '2026-06-08',
        reason: 'maintenance',
        bookingId: null,
      },
      {
        id: 'b3',
        unitId: 'other',
        from: '2026-06-05',
        to: '2026-06-09',
        reason: 'owner',
        bookingId: null,
      },
    ];
    const rows = availabilityFor(unit, blocks, '2026-06-05', '2026-06-09');
    expect(rows.map((r) => r.available)).toEqual([1, 0, 1, 2]);
    expect(rows[0]?.priceTry).toBe(1500);
    expect(isAvailable(unit, blocks, '2026-06-05', '2026-06-06')).toBe(true);
    expect(isAvailable(unit, blocks, '2026-06-05', '2026-06-08')).toBe(false);
    expect(isAvailable(unit, blocks, '2026-06-05', '2026-06-05')).toBe(false);
  });
});

describe('buildQuote', () => {
  it('ara toplam, platform ücreti, toplam ve depozitoyu hesaplar', () => {
    const q = buildQuote(unit, [], 'moderate', {
      checkIn: '2026-06-05',
      checkOut: '2026-06-08',
      guests: 2,
    });
    expect(q.nights).toBe(3);
    expect(q.subtotalTry).toBe(1500 + 1500 + 1000);
    expect(q.platformFeeTry).toBe(Math.round(4000 * 0.08));
    expect(q.totalTry).toBe(4000 + 320);
    expect(q.depositTry).toBe(Math.round(4320 * 0.2));
    expect(q.policy).toBe('moderate');
    expect(q.available).toBe(true);
  });

  it('kapasite aşımı ve dolu günlerde müsait değildir', () => {
    expect(
      buildQuote(unit, [], 'flexible', { checkIn: '2026-06-05', checkOut: '2026-06-06', guests: 3 })
        .available,
    ).toBe(false);
    const full: UnitBlock[] = [
      {
        id: '1',
        unitId: 'u1',
        from: '2026-06-05',
        to: '2026-06-06',
        reason: 'owner',
        bookingId: null,
      },
      {
        id: '2',
        unitId: 'u1',
        from: '2026-06-05',
        to: '2026-06-06',
        reason: 'owner',
        bookingId: null,
      },
    ];
    expect(
      buildQuote(unit, full, 'flexible', {
        checkIn: '2026-06-05',
        checkOut: '2026-06-06',
        guests: 1,
      }).available,
    ).toBe(false);
  });

  it('özel ücret oranı kabul eder', () => {
    const q = buildQuote(
      unit,
      [],
      'strict',
      { checkIn: '2026-06-08', checkOut: '2026-06-09', guests: 1 },
      0.1,
    );
    expect(q.platformFeeTry).toBe(100);
  });
});

describe('ödeme makinesi', () => {
  it('geçerli geçişleri uygular', () => {
    expect(nextPaymentStatus('pending', 'authorize')).toBe('authorized');
    expect(nextPaymentStatus('authorized', 'capture')).toBe('escrow');
    expect(nextPaymentStatus('escrow', 'release')).toBe('released');
    expect(nextPaymentStatus('escrow', 'refund')).toBe('refunded');
    expect(nextPaymentStatus('authorized', 'refund')).toBe('refunded');
    expect(nextPaymentStatus('pending', 'fail')).toBe('failed');
  });

  it('geçersiz geçişte hata fırlatır', () => {
    expect(() => nextPaymentStatus('released', 'refund')).toThrow();
    expect(() => nextPaymentStatus('pending', 'release')).toThrow();
    expect(() => nextPaymentStatus('refunded', 'capture')).toThrow();
  });

  it('paymentTimeline emanet yolculuğunu adımlara böler', () => {
    const steps = paymentTimeline({
      status: 'escrow',
      timeline: [
        { status: 'authorized', at: '2026-06-01T10:00:00.000Z' },
        { status: 'escrow', at: '2026-06-01T10:00:05.000Z' },
      ],
    });
    expect(steps.map((s) => `${s.status}:${s.state}`)).toEqual([
      'authorized:done',
      'escrow:current',
      'released:upcoming',
    ]);
    const refunded = paymentTimeline({
      status: 'refunded',
      timeline: [
        { status: 'authorized', at: '2026-06-01T10:00:00.000Z' },
        { status: 'escrow', at: '2026-06-01T10:00:05.000Z' },
        { status: 'refunded', at: '2026-06-02T10:00:00.000Z' },
      ],
    });
    expect(refunded.map((s) => s.status)).toEqual(['authorized', 'escrow', 'refunded']);
    expect(refunded[2]?.state).toBe('current');
  });
});

describe('refundAmount', () => {
  const checkIn = '2026-06-20T14:00:00.000Z';
  const hours = (h: number) => new Date(Date.parse(checkIn) - h * 3_600_000).toISOString();

  it('flexible: 24 saat öncesine kadar tam iade, sonra yok', () => {
    expect(refundAmount('flexible', checkIn, hours(25), 1000).refundTry).toBe(1000);
    expect(refundAmount('flexible', checkIn, hours(24), 1000).refundTry).toBe(1000);
    expect(refundAmount('flexible', checkIn, hours(23), 1000).refundTry).toBe(0);
    expect(refundAmount('flexible', checkIn, hours(23), 1000).keptTry).toBe(1000);
  });

  it('moderate: 5 gün öncesine kadar tam, sonra yarım', () => {
    expect(refundAmount('moderate', checkIn, hours(24 * 6), 1000).refundTry).toBe(1000);
    expect(refundAmount('moderate', checkIn, hours(24 * 5), 1000).refundTry).toBe(1000);
    expect(refundAmount('moderate', checkIn, hours(24 * 4), 1000).refundTry).toBe(500);
    expect(refundAmount('moderate', checkIn, hours(1), 1001)).toEqual({
      refundTry: 501,
      keptTry: 500,
      reason: 'inventory.refund.reason.moderateHalf',
    });
  });

  it('strict: 14 gün öncesine kadar yarım, sonra yok', () => {
    expect(refundAmount('strict', checkIn, hours(24 * 15), 1000).refundTry).toBe(500);
    expect(refundAmount('strict', checkIn, hours(24 * 14), 1000).refundTry).toBe(500);
    expect(refundAmount('strict', checkIn, hours(24 * 13), 1000).refundTry).toBe(0);
  });

  it('giriş saatinden sonra hiçbir politika iade etmez', () => {
    const after = new Date(Date.parse(checkIn) + 1000).toISOString();
    expect(refundAmount('flexible', checkIn, after, 1000).refundTry).toBe(0);
    expect(refundAmount('flexible', checkIn, after, 1000).reason).toBe(
      'inventory.refund.reason.afterCheckIn',
    );
  });
});

describe('rezervasyon kuralları', () => {
  const base: StayBooking = {
    id: 'sb',
    businessId: 'b1',
    guestId: 'u_me',
    checkIn: '2026-06-20T14:00:00.000Z',
    checkOut: '2026-06-22T11:00:00.000Z',
    guests: 2,
    nights: 2,
    totalTry: 1000,
    platformFeeTry: 80,
    status: 'confirmed',
    createdAt: '2026-06-01T00:00:00.000Z',
  };

  it('canCancel yalnızca girişten önce ve aktif rezervasyonda', () => {
    expect(canCancel(base, '2026-06-19T00:00:00.000Z')).toBe(true);
    expect(canCancel(base, '2026-06-20T15:00:00.000Z')).toBe(false);
    expect(canCancel({ ...base, status: 'cancelled' }, '2026-06-01T00:00:00.000Z')).toBe(false);
    expect(canCancel({ ...base, status: 'completed' }, '2026-06-01T00:00:00.000Z')).toBe(false);
  });

  it('canReview yalnızca tamamlanmış ve 30 gün içinde', () => {
    const done = { ...base, status: 'completed' as const };
    expect(canReview(done, '2026-06-23T00:00:00.000Z')).toBe(true);
    expect(canReview(done, '2026-07-20T00:00:00.000Z')).toBe(true);
    expect(canReview(done, '2026-07-25T00:00:00.000Z')).toBe(false);
    expect(canReview(base, '2026-06-23T00:00:00.000Z')).toBe(false);
  });

  it('releaseDue girişten 24 saat sonra', () => {
    expect(releaseDue(base, '2026-06-21T13:00:00.000Z')).toBe(false);
    expect(releaseDue(base, '2026-06-21T14:00:00.000Z')).toBe(true);
    expect(releaseDue({ ...base, status: 'cancelled' }, '2026-06-25T00:00:00.000Z')).toBe(false);
  });
});

describe('hostTrustScore', () => {
  const profile = (over: Partial<HostProfile>): HostProfile => ({
    businessId: 'b1',
    verification: 'none',
    cancellationPolicy: 'moderate',
    responseRatePct: 0,
    responseTimeMin: 0,
    payoutIban: null,
    pendingPayoutTry: 0,
    paidOutTry: 0,
    ...over,
  });

  it('boş profil 0, tam profil 100', () => {
    expect(hostTrustScore(profile({}), [])).toBe(0);
    expect(
      hostTrustScore(profile({ verification: 'premium', responseRatePct: 100 }), [
        { rating: 5, verifiedStay: true },
        { rating: 5, verifiedStay: true },
      ]),
    ).toBe(100);
  });

  it('her zaman 0..100 aralığında kalır ve etiketlenir', () => {
    const s = hostTrustScore(profile({ verification: 'id', responseRatePct: 250 }), [
      { rating: 9, verifiedStay: false },
    ]);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
    expect(trustLabel(10)).toBe('low');
    expect(trustLabel(50)).toBe('good');
    expect(trustLabel(75)).toBe('excellent');
    expect(trustLabel(95)).toBe('superhost');
  });

  it('doğrulanmış yorum oranı skoru yükseltir', () => {
    const a = hostTrustScore(profile({}), [{ rating: 4, verifiedStay: false }]);
    const b = hostTrustScore(profile({}), [{ rating: 4, verifiedStay: true }]);
    expect(b).toBeGreaterThan(a);
  });
});

describe('payoutSummary', () => {
  it('bekleyen, ödenen, komisyon ve iadeyi ayırır', () => {
    const bookings = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const s = payoutSummary(bookings, [
      { bookingId: 'a', amountTry: 1080, platformFeeTry: 80, status: 'escrow', refundedTry: 0 },
      { bookingId: 'b', amountTry: 2160, platformFeeTry: 160, status: 'released', refundedTry: 0 },
      { bookingId: 'c', amountTry: 1000, platformFeeTry: 80, status: 'refunded', refundedTry: 500 },
      { bookingId: 'zzz', amountTry: 9999, platformFeeTry: 1, status: 'released', refundedTry: 0 },
    ]);
    expect(s.pendingTry).toBe(1000);
    expect(s.paidTry).toBe(2000 + 420);
    expect(s.commissionTry).toBe(80 + 160 + 80);
    expect(s.refundedTry).toBe(500);
    expect(s.count).toBe(3);
  });
});
