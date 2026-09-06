import type { HostProfile, Payment, StayBooking, StayReview, StayUnit, UnitBlock } from '@/domain';

import { CURRENT_USER_ID } from './seed';

/* ------------------------------------------------------------------ */
/* Yardımcılar — tüm tarihler bugüne göre hesaplanır                     */
/* ------------------------------------------------------------------ */

const now = Date.now();
const DAY = 86_400_000;
const daysAgo = (d: number) => new Date(now - d * DAY).toISOString();
const daysAhead = (d: number) => new Date(now + d * DAY).toISOString();
const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();
const dayKey = (iso: string) => iso.slice(0, 10);
const year = new Date(now).getUTCFullYear();

/** Yaz sezonu: 15 Haziran – 15 Eylül (bu yıl ve gelecek yıl) */
const summer = (multiplier: number) => [
  { from: `${year}-06-15`, to: `${year}-09-15`, multiplier },
  { from: `${year + 1}-06-15`, to: `${year + 1}-09-15`, multiplier },
];
/** Kış/kayak sezonu: 15 Aralık – 15 Mart */
const winter = (multiplier: number) => [
  { from: `${year - 1}-12-15`, to: `${year}-03-15`, multiplier },
  { from: `${year}-12-15`, to: `${year + 1}-03-15`, multiplier },
];
/** Balon sezonu (Kapadokya): Nisan–Mayıs ve Ekim */
const cappadocia = (multiplier: number) => [
  { from: `${year}-04-01`, to: `${year}-05-31`, multiplier },
  { from: `${year}-10-01`, to: `${year}-10-31`, multiplier },
  { from: `${year + 1}-04-01`, to: `${year + 1}-05-31`, multiplier },
];

/* ------------------------------------------------------------------ */
/* Birimler — 14 adet (biz1 pansiyon, biz2 glamping, biz4 otel, biz5 kamp) */
/* ------------------------------------------------------------------ */

export const seedStayUnits: StayUnit[] = [
  // biz1 — Aladağlar Dağ Evi (pension)
  {
    id: 'unit_biz1_std',
    businessId: 'biz1',
    name: 'Standart Oda',
    kind: 'room',
    capacity: 2,
    quantity: 6,
    basePriceTry: 1450,
    weekendMultiplier: 1.15,
    seasons: [...winter(1.25), ...summer(1.1)],
    amenities: ['Soba', 'Kahvaltı', 'Dağ manzarası'],
  },
  {
    id: 'unit_biz1_family',
    businessId: 'biz1',
    name: 'Aile Odası',
    kind: 'room',
    capacity: 4,
    quantity: 3,
    basePriceTry: 2400,
    weekendMultiplier: 1.15,
    seasons: [...winter(1.25), ...summer(1.1)],
    amenities: ['Soba', 'Kahvaltı', 'Ekipman dolabı'],
  },
  {
    id: 'unit_biz1_dorm',
    businessId: 'biz1',
    name: 'Yatakhane Yatağı',
    kind: 'dorm_bed',
    capacity: 1,
    quantity: 8,
    basePriceTry: 550,
    weekendMultiplier: 1.1,
    seasons: winter(1.2),
    amenities: ['Kilitli dolap', 'Ortak duş', 'Kahvaltı'],
  },
  // biz2 — Kabak Glamping
  {
    id: 'unit_biz2_deluxe',
    businessId: 'biz2',
    name: 'Deluxe Koy Manzaralı Çadır',
    kind: 'bungalow',
    capacity: 2,
    quantity: 4,
    basePriceTry: 3200,
    weekendMultiplier: 1.2,
    seasons: summer(1.35),
    amenities: ['Deniz manzarası', 'Klima', 'Özel banyo', 'Kahvaltı'],
  },
  {
    id: 'unit_biz2_safari',
    businessId: 'biz2',
    name: 'Safari Çadırı',
    kind: 'bungalow',
    capacity: 3,
    quantity: 3,
    basePriceTry: 2600,
    weekendMultiplier: 1.2,
    seasons: summer(1.3),
    amenities: ['Veranda', 'Vantilatör', 'Kahvaltı'],
  },
  {
    id: 'unit_biz2_pitch',
    businessId: 'biz2',
    name: 'Kendi Çadırın — Alan',
    kind: 'tent_pitch',
    capacity: 2,
    quantity: 6,
    basePriceTry: 450,
    weekendMultiplier: 1.1,
    seasons: summer(1.2),
    amenities: ['Ortak duş', 'Elektrik', 'Gölgelik'],
  },
  // biz4 — Göreme Cave Suites (hotel)
  {
    id: 'unit_biz4_cave',
    businessId: 'biz4',
    name: 'Mağara Oda',
    kind: 'room',
    capacity: 2,
    quantity: 5,
    basePriceTry: 4800,
    weekendMultiplier: 1.1,
    seasons: cappadocia(1.4),
    amenities: ['Kahvaltı', 'Wi-Fi', 'Yerden ısıtma'],
  },
  {
    id: 'unit_biz4_suite',
    businessId: 'biz4',
    name: 'Teraslı Süit',
    kind: 'room',
    capacity: 3,
    quantity: 2,
    basePriceTry: 7900,
    weekendMultiplier: 1.1,
    seasons: cappadocia(1.45),
    amenities: ['Balon manzaralı teras', 'Jakuzi', 'Kahvaltı', 'Wi-Fi'],
  },
  {
    id: 'unit_biz4_deluxe',
    businessId: 'biz4',
    name: 'Deluxe Mağara Oda',
    kind: 'room',
    capacity: 2,
    quantity: 3,
    basePriceTry: 6100,
    weekendMultiplier: 1.1,
    seasons: cappadocia(1.4),
    amenities: ['Kahvaltı', 'Wi-Fi', 'Şömine'],
  },
  // biz5 — Belgrad Kamp & Bungalov (campsite)
  {
    id: 'unit_biz5_pitch',
    businessId: 'biz5',
    name: 'Çadır Yeri',
    kind: 'tent_pitch',
    capacity: 3,
    quantity: 20,
    basePriceTry: 650,
    weekendMultiplier: 1.25,
    seasons: summer(1.15),
    amenities: ['Ateş yeri', 'Duş', 'Otopark'],
  },
  {
    id: 'unit_biz5_rv',
    businessId: 'biz5',
    name: 'Karavan Yeri',
    kind: 'rv_spot',
    capacity: 4,
    quantity: 6,
    basePriceTry: 950,
    weekendMultiplier: 1.25,
    seasons: summer(1.15),
    amenities: ['Elektrik', 'Su', 'Atık boşaltma'],
  },
  {
    id: 'unit_biz5_bungalow',
    businessId: 'biz5',
    name: 'Ahşap Bungalov',
    kind: 'bungalow',
    capacity: 4,
    quantity: 6,
    basePriceTry: 1800,
    weekendMultiplier: 1.3,
    seasons: summer(1.2),
    amenities: ['Veranda', 'Mini mutfak', 'Isıtıcı'],
  },
  {
    id: 'unit_biz5_dorm',
    businessId: 'biz5',
    name: 'Ortak Kulübe Yatağı',
    kind: 'dorm_bed',
    capacity: 1,
    quantity: 10,
    basePriceTry: 400,
    weekendMultiplier: 1.2,
    seasons: summer(1.1),
    amenities: ['Kilitli dolap', 'Ortak duş'],
  },
  {
    id: 'unit_biz5_glamp',
    businessId: 'biz5',
    name: 'Hazır Çadır (Glamping)',
    kind: 'tent_pitch',
    capacity: 2,
    quantity: 4,
    basePriceTry: 1200,
    weekendMultiplier: 1.3,
    seasons: summer(1.2),
    amenities: ['Şişme yatak', 'Elektrik', 'Kahvaltı'],
  },
];

/* ------------------------------------------------------------------ */
/* Ek rezervasyonlar — repo t.stayBookings tablosuna tembel ekler         */
/* (seed.extra'daki sb1 ile çakışmaz: sb1 = biz2, +20..+22 gün)           */
/* ------------------------------------------------------------------ */

export const seedInventoryBookings: StayBooking[] = [
  {
    // u_me — tamamlanmış konaklama (yorum yazılabilir), ödeme serbest bırakıldı
    id: 'sb_inv1',
    unitId: null,
    businessId: 'biz1',
    guestId: CURRENT_USER_ID,
    checkIn: daysAgo(12),
    checkOut: daysAgo(10),
    guests: 2,
    nights: 2,
    totalTry: 3132,
    platformFeeTry: 232,
    status: 'completed',
    createdAt: daysAgo(25),
  },
  {
    // u_me — yaklaşan konaklama, emanette (iptal edilebilir)
    id: 'sb_inv2',
    unitId: 'unit_biz5_bungalow',
    businessId: 'biz5',
    guestId: CURRENT_USER_ID,
    checkIn: daysAhead(6),
    checkOut: daysAhead(8),
    guests: 3,
    nights: 2,
    totalTry: 4212,
    platformFeeTry: 312,
    status: 'confirmed',
    createdAt: daysAgo(3),
  },
  {
    // u_elif — iptal edildi, kısmi iade
    id: 'sb_inv3',
    unitId: null,
    businessId: 'biz4',
    guestId: 'u_elif',
    checkIn: daysAhead(9),
    checkOut: daysAhead(11),
    guests: 2,
    nights: 2,
    totalTry: 10368,
    platformFeeTry: 768,
    status: 'cancelled',
    createdAt: daysAgo(6),
  },
  {
    // u_can — biz1'e yaklaşan, emanette
    id: 'sb_inv4',
    unitId: 'unit_biz1_family',
    businessId: 'biz1',
    guestId: 'u_can',
    checkIn: daysAhead(4),
    checkOut: daysAhead(7),
    guests: 4,
    nights: 3,
    totalTry: 7776,
    platformFeeTry: 576,
    status: 'confirmed',
    createdAt: daysAgo(2),
  },
  {
    // u_zeynep — biz2 geçmiş konaklama, ödeme aktarıldı
    id: 'sb_inv5',
    unitId: null,
    businessId: 'biz2',
    guestId: 'u_zeynep',
    checkIn: daysAgo(20),
    checkOut: daysAgo(17),
    guests: 2,
    nights: 3,
    totalTry: 10368,
    platformFeeTry: 768,
    status: 'completed',
    createdAt: daysAgo(40),
  },
];

/* ------------------------------------------------------------------ */
/* Bloklar — 10 adet (bakım, sahip ve rezervasyon)                       */
/* ------------------------------------------------------------------ */

export const seedUnitBlocks: UnitBlock[] = [
  // Rezervasyon blokları
  {
    id: 'blk_sb1',
    unitId: 'unit_biz2_deluxe',
    from: dayKey(daysAhead(20)),
    to: dayKey(daysAhead(22)),
    reason: 'booking',
    bookingId: 'sb1',
  },
  {
    id: 'blk_sb_inv2',
    unitId: 'unit_biz5_bungalow',
    from: dayKey(daysAhead(6)),
    to: dayKey(daysAhead(8)),
    reason: 'booking',
    bookingId: 'sb_inv2',
  },
  {
    id: 'blk_sb_inv4',
    unitId: 'unit_biz1_family',
    from: dayKey(daysAhead(4)),
    to: dayKey(daysAhead(7)),
    reason: 'booking',
    bookingId: 'sb_inv4',
  },
  // Bakım blokları
  {
    id: 'blk_m1',
    unitId: 'unit_biz1_std',
    from: dayKey(daysAhead(2)),
    to: dayKey(daysAhead(5)),
    reason: 'maintenance',
    bookingId: null,
  },
  {
    id: 'blk_m2',
    unitId: 'unit_biz4_suite',
    from: dayKey(daysAhead(3)),
    to: dayKey(daysAhead(6)),
    reason: 'maintenance',
    bookingId: null,
  },
  {
    id: 'blk_m3',
    unitId: 'unit_biz4_suite',
    from: dayKey(daysAhead(3)),
    to: dayKey(daysAhead(6)),
    reason: 'maintenance',
    bookingId: null,
  },
  {
    id: 'blk_m4',
    unitId: 'unit_biz5_rv',
    from: dayKey(daysAhead(10)),
    to: dayKey(daysAhead(12)),
    reason: 'maintenance',
    bookingId: null,
  },
  // Sahip blokları (özel kullanım / kapalı günler)
  {
    id: 'blk_o1',
    unitId: 'unit_biz2_safari',
    from: dayKey(daysAhead(1)),
    to: dayKey(daysAhead(3)),
    reason: 'owner',
    bookingId: null,
  },
  {
    id: 'blk_o2',
    unitId: 'unit_biz2_safari',
    from: dayKey(daysAhead(1)),
    to: dayKey(daysAhead(3)),
    reason: 'owner',
    bookingId: null,
  },
  {
    id: 'blk_o3',
    unitId: 'unit_biz2_safari',
    from: dayKey(daysAhead(1)),
    to: dayKey(daysAhead(3)),
    reason: 'owner',
    bookingId: null,
  },
];

/* ------------------------------------------------------------------ */
/* Ödemeler — escrow / released / refunded                              */
/* ------------------------------------------------------------------ */

export const seedPayments: Payment[] = [
  {
    id: 'pay_inv1',
    bookingId: 'sb_inv1',
    payerId: CURRENT_USER_ID,
    amountTry: 3132,
    platformFeeTry: 232,
    status: 'released',
    provider: 'iyzico',
    createdAt: daysAgo(25),
    releasedAt: daysAgo(11),
    refundedTry: 0,
    timeline: [
      { status: 'authorized', at: daysAgo(25) },
      { status: 'escrow', at: daysAgo(25) },
      { status: 'released', at: daysAgo(11) },
    ],
  },
  {
    id: 'pay_inv2',
    bookingId: 'sb_inv2',
    payerId: CURRENT_USER_ID,
    amountTry: 4212,
    platformFeeTry: 312,
    status: 'escrow',
    provider: 'iyzico',
    createdAt: daysAgo(3),
    releasedAt: null,
    refundedTry: 0,
    timeline: [
      { status: 'authorized', at: daysAgo(3) },
      { status: 'escrow', at: hoursAgo(71) },
    ],
  },
  {
    id: 'pay_inv3',
    bookingId: 'sb_inv3',
    payerId: 'u_elif',
    amountTry: 10368,
    platformFeeTry: 768,
    status: 'refunded',
    provider: 'stripe',
    createdAt: daysAgo(6),
    releasedAt: null,
    refundedTry: 5184,
    timeline: [
      { status: 'authorized', at: daysAgo(6) },
      { status: 'escrow', at: daysAgo(6) },
      { status: 'refunded', at: daysAgo(1) },
    ],
  },
  {
    id: 'pay_inv4',
    bookingId: 'sb_inv4',
    payerId: 'u_can',
    amountTry: 7776,
    platformFeeTry: 576,
    status: 'escrow',
    provider: 'iyzico',
    createdAt: daysAgo(2),
    releasedAt: null,
    refundedTry: 0,
    timeline: [
      { status: 'authorized', at: daysAgo(2) },
      { status: 'escrow', at: daysAgo(2) },
    ],
  },
  {
    id: 'pay_inv5',
    bookingId: 'sb_inv5',
    payerId: 'u_zeynep',
    amountTry: 10368,
    platformFeeTry: 768,
    status: 'released',
    provider: 'iyzico',
    createdAt: daysAgo(40),
    releasedAt: daysAgo(19),
    refundedTry: 0,
    timeline: [
      { status: 'authorized', at: daysAgo(40) },
      { status: 'escrow', at: daysAgo(40) },
      { status: 'released', at: daysAgo(19) },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Doğrulanmış yorumlar — 8 adet                                        */
/* ------------------------------------------------------------------ */

export const seedStayReviews: StayReview[] = [
  {
    id: 'srv1',
    businessId: 'biz1',
    bookingId: 'sb_hist_1',
    authorId: 'u_elif',
    rating: 5,
    text: 'Demirkazık için mükemmel üs. Sabah 4’te kahvaltı hazırladılar, ekipman kurutma odası hayat kurtardı.',
    verifiedStay: true,
    createdAt: daysAgo(35),
  },
  {
    id: 'srv2',
    businessId: 'biz1',
    bookingId: 'sb_hist_2',
    authorId: 'u_can',
    rating: 4,
    text: 'Odalar sade ama sıcak. Soba gece boyu yanıyor. Wi-Fi zayıf — zaten dağa geliyorsun.',
    verifiedStay: true,
    createdAt: daysAgo(60),
  },
  {
    id: 'srv3',
    businessId: 'biz2',
    bookingId: 'sb_inv5',
    authorId: 'u_zeynep',
    rating: 5,
    text: 'Likya Yolu sonrası bu manzara ödül gibi. Bagaj taşıma servisi kusursuz çalıştı.',
    verifiedStay: true,
    createdAt: daysAgo(16),
  },
  {
    id: 'srv4',
    businessId: 'biz2',
    bookingId: 'sb_hist_4',
    authorId: 'u_lale',
    rating: 4,
    text: 'Çadırlar lüks, yoga sabahları harika. Koya iniş dik, dizlerinize dikkat.',
    verifiedStay: true,
    createdAt: daysAgo(48),
  },
  {
    id: 'srv5',
    businessId: 'biz4',
    bookingId: 'sb_hist_5',
    authorId: 'u_mert',
    rating: 5,
    text: 'Terastan balonları izlemek için erken kalkmaya değer. Bisiklet kiralayıp vadileri gezdik.',
    verifiedStay: true,
    createdAt: daysAgo(22),
  },
  {
    id: 'srv6',
    businessId: 'biz4',
    bookingId: 'sb_hist_6',
    authorId: 'u_selin',
    rating: 4,
    text: 'Mağara oda serin ve sessiz. Kahvaltı çeşitli; fiyat sezon dışında daha makul.',
    verifiedStay: true,
    createdAt: daysAgo(70),
  },
  {
    id: 'srv7',
    businessId: 'biz5',
    bookingId: 'sb_hist_7',
    authorId: 'u_kerem',
    rating: 4,
    text: 'İstanbul’dan kaçış için ideal. Ateş yeri ve duşlar temiz, hafta sonu kalabalık olabiliyor.',
    verifiedStay: true,
    createdAt: daysAgo(14),
  },
  {
    id: 'srv8',
    businessId: 'biz5',
    bookingId: 'sb_hist_8',
    authorId: 'u_nil',
    rating: 3,
    text: 'Bungalov rahat ama karavan alanında elektrik bir gece kesildi. Personel ilgiliydi.',
    verifiedStay: true,
    createdAt: daysAgo(30),
  },
];

/* ------------------------------------------------------------------ */
/* Ev sahibi profilleri — biz4 premium, biz5 doğrulamasız               */
/* ------------------------------------------------------------------ */

export const seedHostProfiles: HostProfile[] = [
  {
    businessId: 'biz1',
    verification: 'address',
    cancellationPolicy: 'flexible',
    responseRatePct: 96,
    responseTimeMin: 45,
    payoutIban: 'TR33 0006 1005 1978 6457 8413 26',
    pendingPayoutTry: 0,
    paidOutTry: 0,
  },
  {
    businessId: 'biz2',
    verification: 'id',
    cancellationPolicy: 'moderate',
    responseRatePct: 88,
    responseTimeMin: 120,
    payoutIban: 'TR12 0001 0002 3456 7890 1234 56',
    pendingPayoutTry: 0,
    paidOutTry: 0,
  },
  {
    businessId: 'biz4',
    verification: 'premium',
    cancellationPolicy: 'strict',
    responseRatePct: 99,
    responseTimeMin: 20,
    payoutIban: 'TR98 0004 6000 1234 5678 9012 34',
    pendingPayoutTry: 0,
    paidOutTry: 0,
  },
  {
    businessId: 'biz5',
    verification: 'none',
    cancellationPolicy: 'strict',
    responseRatePct: 62,
    responseTimeMin: 480,
    payoutIban: null,
    pendingPayoutTry: 0,
    paidOutTry: 0,
  },
];
