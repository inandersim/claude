import { createMockProvider } from '../mock/provider';
import { CURRENT_USER_ID } from '../mock/seed';

const make = () => createMockProvider({ persist: false, latencyMs: 0 });
const istanbul = { latitude: 41.0, longitude: 29.0 };

describe('Hazards', () => {
  it('yakın aktif tehlikeleri mesafe ve onay bilgisiyle döner', async () => {
    const p = make();
    const list = await p.hazards.list(CURRENT_USER_ID, istanbul, 50);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((h) => h.status === 'active')).toBe(true);
    expect(list.every((h) => (h.distanceKm ?? 0) <= 50)).toBe(true);
    const h1 = list.find((h) => h.id === 'h1');
    expect(h1?.confirmedByMe).toBe(true);
  });

  it('bildirim oluşturur, yakındaki kullanıcılara uyarı gönderir', async () => {
    const p = make();
    const created = await p.hazards.report(CURRENT_USER_ID, {
      type: 'wildlife',
      severity: 'high',
      title: 'Ayı görüldü',
      description: 'Kamp alanı yakını',
      locationName: 'Kadıköy',
      coords: istanbul,
      radiusM: 500,
      expiresInHours: 24,
    });
    expect(created.status).toBe('active');
    expect(created.expiresAt).not.toBeNull();
    expect(created.reporter.id).toBe(CURRENT_USER_ID);
    const elifNotifs = await p.notifications.list('u_elif');
    expect(elifNotifs[0]?.type).toBe('hazard_alert');
    expect(elifNotifs[0]?.targetId).toBe(created.id);
  });

  it('onay tek seferliktir ve bildiren kendini onaylayamaz', async () => {
    const p = make();
    const before = (await p.hazards.getById(CURRENT_USER_ID, 'h2', null))!;
    const once = await p.hazards.confirm(CURRENT_USER_ID, 'h2');
    expect(once.confirmations).toBe(before.confirmations + 1);
    expect(once.confirmedByMe).toBe(true);
    const twice = await p.hazards.confirm(CURRENT_USER_ID, 'h2');
    expect(twice.confirmations).toBe(once.confirmations);
    await expect(p.hazards.confirm(CURRENT_USER_ID, 'h3')).rejects.toThrow();
  });

  it('yalnızca bildiren çözüldü işaretleyebilir', async () => {
    const p = make();
    await expect(p.hazards.resolve(CURRENT_USER_ID, 'h1')).rejects.toThrow();
    const resolved = await p.hazards.resolve(CURRENT_USER_ID, 'h3');
    expect(resolved.status).toBe('resolved');
    const active = await p.hazards.list(CURRENT_USER_ID, null);
    expect(active.some((h) => h.id === 'h3')).toBe(false);
  });
});

describe('Live', () => {
  it('canlı → planlı → tekrar sırasıyla listeler', async () => {
    const p = make();
    const list = await p.live.list();
    const order = list.map((s) => s.status);
    const firstScheduled = order.indexOf('scheduled');
    const firstEnded = order.indexOf('ended');
    expect(order.lastIndexOf('live')).toBeLessThan(firstScheduled);
    expect(firstScheduled).toBeLessThan(firstEnded);
  });

  it('yayın başlatır, takipçilere bildirir, bitirince tekrar olur', async () => {
    const p = make();
    const stream = await p.live.start(CURRENT_USER_ID, {
      title: 'Test yayın',
      description: '',
      adventureType: 'hiking',
      locationName: 'Uludağ',
    });
    expect(stream.status).toBe('live');
    expect(stream.host.id).toBe(CURRENT_USER_ID);
    // u_elif beni takip ediyor (seedFollows)
    const notifs = await p.notifications.list('u_elif');
    expect(notifs[0]?.type).toBe('stream_live');
    await expect(p.live.end('u_elif', stream.id)).rejects.toThrow();
    const ended = await p.live.end(CURRENT_USER_ID, stream.id);
    expect(ended.status).toBe('ended');
    expect(ended.playbackUrl).toContain('.mp4');
  });

  it('izleyici sayacı ve sohbet çalışır', async () => {
    const p = make();
    const before = (await p.live.getById('s1'))!;
    await p.live.join('s1');
    expect((await p.live.getById('s1'))!.viewerCount).toBe(before.viewerCount + 1);
    await p.live.leave('s1');
    expect((await p.live.getById('s1'))!.viewerCount).toBe(before.viewerCount);
    const msg = await p.live.sendMessage(CURRENT_USER_ID, 's1', 'Selam!');
    const list = await p.live.messages('s1');
    expect(list[list.length - 1]?.id).toBe(msg.id);
    const liked = await p.live.like('s1');
    expect(liked.likesCount).toBe(before.likesCount + 1);
  });
});

describe('Market', () => {
  it('ilan oluşturur, favori aç/kapa yapar, satıldı işaretler', async () => {
    const p = make();
    const created = await p.market.create(CURRENT_USER_ID, {
      title: 'Test kask',
      description: '',
      priceTry: 999.6,
      category: 'equipment',
      condition: 'good',
      imageUri: null,
      locationName: '',
      adventureTypes: ['climbing'],
    });
    expect(created.priceTry).toBe(1000);
    expect(created.locationName).toBe('Kadıköy, İstanbul');
    const fav = await p.market.toggleFavorite('u_elif', created.id);
    expect(fav).toEqual({ favorited: true, favoritesCount: 1 });
    expect((await p.market.getById('u_elif', created.id))!.favoritedByMe).toBe(true);
    await expect(p.market.markSold('u_elif', created.id)).rejects.toThrow();
    const sold = await p.market.markSold(CURRENT_USER_ID, created.id);
    expect(sold.isSold).toBe(true);
    const visible = await p.market.list(CURRENT_USER_ID);
    expect(visible.some((l) => l.id === created.id)).toBe(false);
  });
});

describe('Instructors', () => {
  it('rezervasyon yaşam döngüsü: talep → bildirim → onay → bildirim', async () => {
    const p = make();
    const booking = await p.instructors.book(CURRENT_USER_ID, {
      instructorId: 'i_can',
      adventureType: 'climbing',
      date: '2026-10-01T09:00:00.000Z',
      message: 'Lead dersi',
    });
    expect(booking.status).toBe('pending');
    expect(booking.priceTry).toBe(1500);
    expect(booking.instructor.user.id).toBe('u_can');
    const canNotifs = await p.notifications.list('u_can');
    expect(canNotifs[0]?.type).toBe('booking_request');

    await expect(p.instructors.respondBooking(CURRENT_USER_ID, booking.id, true)).rejects.toThrow();
    const confirmed = await p.instructors.respondBooking('u_can', booking.id, true);
    expect(confirmed.status).toBe('confirmed');
    const myNotifs = await p.notifications.list(CURRENT_USER_ID);
    expect(myNotifs[0]?.type).toBe('booking_confirmed');

    const mine = await p.instructors.myBookings(CURRENT_USER_ID);
    expect(mine.some((b) => b.id === booking.id)).toBe(true);
  });

  it('kendinden ders talep edemez', async () => {
    const p = make();
    await expect(
      p.instructors.book('u_can', {
        instructorId: 'i_can',
        adventureType: 'climbing',
        date: '2026-10-01T09:00:00.000Z',
        message: '',
      }),
    ).rejects.toThrow();
  });

  it('listeyi puana göre, yorumları tarihe göre döner', async () => {
    const p = make();
    const list = await p.instructors.list(istanbul);
    expect(list[0]?.id).toBe('i_zeynep');
    const reviews = await p.instructors.reviews('i_can');
    expect(reviews.length).toBe(3);
    expect(reviews[0]!.createdAt >= reviews[1]!.createdAt).toBe(true);
  });
});
