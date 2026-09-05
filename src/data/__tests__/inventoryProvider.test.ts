import { createMockProvider } from '../mock/provider';
import { CURRENT_USER_ID } from '../mock/seed';

const make = () => createMockProvider({ persist: false, latencyMs: 0 });
const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

describe('Inventory', () => {
  it('birimler, müsaitlik ve teklif', async () => {
    const p = make();
    const units = await p.inventory.units('biz5');
    expect(units.length).toBeGreaterThanOrEqual(4);
    const unit = units.find((u) => u.id === 'unit_biz5_bungalow')!;
    // sb_inv2 bloğu +6..+8 günlerini 1 adet düşürür
    const avail = await p.inventory.availability(unit.id, day(6), day(8));
    expect(avail).toHaveLength(2);
    expect(avail.every((a) => a.available === unit.quantity - 1)).toBe(true);
    const quote = await p.inventory.quote({
      businessId: 'biz5',
      unitId: unit.id,
      checkIn: day(30),
      checkOut: day(32),
      guests: 2,
    });
    expect(quote.nights).toBe(2);
    expect(quote.totalTry).toBe(quote.subtotalTry + quote.platformFeeTry);
    expect(quote.policy).toBe('strict');
    expect(quote.available).toBe(true);
  });

  it('seed rezervasyonları ödeme kaydıyla birleştirilir', async () => {
    const p = make();
    const mine = await p.inventory.myBookings(CURRENT_USER_ID);
    const ids = mine.map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(['sb1', 'sb_inv1', 'sb_inv2']));
    expect(mine.find((b) => b.id === 'sb1')?.payment).toBeNull();
    expect(mine.find((b) => b.id === 'sb_inv2')?.payment?.status).toBe('escrow');
    expect(mine.find((b) => b.id === 'sb_inv1')?.unit).toBeNull();
    expect(mine.find((b) => b.id === 'sb_inv2')?.unit?.id).toBe('unit_biz5_bungalow');
  });

  it('rezervasyon → emanet → iptal (kısmi iade) akışı', async () => {
    const p = make();
    const input = {
      businessId: 'biz2',
      unitId: 'unit_biz2_pitch',
      checkIn: day(3),
      checkOut: day(5),
      guests: 2,
    };
    const booking = await p.inventory.book(CURRENT_USER_ID, input);
    expect(booking.status).toBe('confirmed');
    expect(booking.payment?.status).toBe('escrow');
    expect(booking.payment?.timeline.map((e) => e.status)).toEqual(['authorized', 'escrow']);
    expect(booking.unit?.id).toBe('unit_biz2_pitch');

    // Blok düştü
    const avail = await p.inventory.availability('unit_biz2_pitch', day(3), day(5));
    expect(avail.every((a) => a.available === 5)).toBe(true);

    // İşletme sahibine bildirim
    const notes = await p.notifications.list('u_baris');
    expect(notes.some((n) => n.type === 'stay_request' && n.targetId === booking.id)).toBe(true);

    // Orta politika, girişe 3 gün: %50 iade
    const preview = await p.inventory.refundPreview(CURRENT_USER_ID, booking.id);
    expect(preview.refundTry).toBe(Math.round(booking.totalTry * 0.5));
    const cancelled = await p.inventory.cancel(CURRENT_USER_ID, booking.id);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.payment?.status).toBe('refunded');
    expect(cancelled.payment?.refundedTry).toBe(preview.refundTry);
    const after = await p.inventory.availability('unit_biz2_pitch', day(3), day(5));
    expect(after.every((a) => a.available === 6)).toBe(true);
    await expect(p.inventory.cancel(CURRENT_USER_ID, booking.id)).rejects.toThrow();
  });

  it('dolu birimde rezervasyon reddedilir', async () => {
    const p = make();
    // unit_biz2_safari +1..+3 günlerinde 3 sahip bloğu var (adet 3)
    await expect(
      p.inventory.book(CURRENT_USER_ID, {
        businessId: 'biz2',
        unitId: 'unit_biz2_safari',
        checkIn: day(1),
        checkOut: day(3),
        guests: 2,
      }),
    ).rejects.toThrow();
  });

  it('giriş → serbest bırakma → doğrulanmış yorum', async () => {
    const p = make();
    const done = await p.inventory.checkIn(CURRENT_USER_ID, 'sb_inv2');
    expect(done.status).toBe('completed');
    expect(done.payment?.status).toBe('released');
    expect(done.payment?.releasedAt).not.toBeNull();

    const before = (await p.businesses.getById('biz5', null))!;
    const review = await p.inventory.review(
      CURRENT_USER_ID,
      'sb_inv2',
      5,
      'Harika bir hafta sonuydu.',
    );
    expect(review.verifiedStay).toBe(true);
    expect(review.author.id).toBe(CURRENT_USER_ID);
    const after = (await p.businesses.getById('biz5', null))!;
    expect(after.reviewCount).toBe(before.reviewCount + 1);
    await expect(
      p.inventory.review(CURRENT_USER_ID, 'sb_inv2', 4, 'İkinci yorum'),
    ).rejects.toThrow();
    // Tamamlanmamış rezervasyona yorum yazılamaz
    await expect(p.inventory.review(CURRENT_USER_ID, 'sb1', 4, 'Henüz gitmedim')).rejects.toThrow();
  });

  it('host paneli okunur, mutasyonlar sahiplik ister', async () => {
    const p = make();
    const host = await p.inventory.host(CURRENT_USER_ID, 'biz1');
    expect(host.verification).toBe('address');
    expect(host.pendingPayoutTry).toBe(7776 - 576);
    expect(host.paidOutTry).toBe(3132 - 232);
    const incoming = await p.inventory.hostBookings(CURRENT_USER_ID, 'biz1');
    expect(incoming.map((b) => b.id)).toEqual(expect.arrayContaining(['sb_inv1', 'sb_inv4']));

    await expect(
      p.inventory.blockDates(CURRENT_USER_ID, 'unit_biz1_std', day(40), day(42)),
    ).rejects.toThrow();
    await expect(p.inventory.verifyHost(CURRENT_USER_ID, 'biz1', 'premium')).rejects.toThrow();

    // Sahip (u_emre) yapabilir
    const block = await p.inventory.blockDates('u_emre', 'unit_biz1_std', day(40), day(42));
    expect(block.reason).toBe('owner');
    const created = await p.inventory.upsertUnit('u_emre', {
      businessId: 'biz1',
      name: 'Çatı Odası',
      kind: 'room',
      capacity: 2,
      quantity: 1,
      basePriceTry: 1200,
      weekendMultiplier: 1.1,
      seasons: [],
      amenities: ['Manzara'],
    });
    expect(created.id).toMatch(/^unit/);
    const updated = await p.inventory.upsertUnit('u_emre', { ...created, basePriceTry: 1300 });
    expect(updated.basePriceTry).toBe(1300);
    const verified = await p.inventory.verifyHost('u_emre', 'biz1', 'premium');
    expect(verified.verification).toBe('premium');
    await expect(p.inventory.verifyHost('u_emre', 'biz1', 'id')).rejects.toThrow();
  });
});
