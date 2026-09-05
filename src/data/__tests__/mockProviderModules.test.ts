import { createMockProvider } from '../mock/provider';
import { CURRENT_USER_ID } from '../mock/seed';

const make = () => createMockProvider({ persist: false, latencyMs: 0 });
const ist = { latitude: 41.0, longitude: 29.0 };

describe('Library', () => {
  it('arama, detay, yakınlık ve ülke sayımı', async () => {
    const p = make();
    const all = await p.library.search({});
    expect(all.length).toBeGreaterThan(60);
    const peaks = await p.library.search({ kind: 'peak', countryCode: 'TR' });
    expect(peaks.every((x) => x.kind === 'peak' && x.countryCode === 'TR')).toBe(true);
    const near = await p.library.nearby({ latitude: 36.2, longitude: 29.64 }, 30);
    expect(near[0]?.id).toMatch(/kas/);
    const detail = await p.library.getById('cur:peak:agri', ist);
    expect(detail?.elevationM).toBe(5137);
    expect(detail?.distanceKm).toBeGreaterThan(1000);
    const countries = await p.library.countries();
    expect(countries[0]?.countryCode).toBe('TR');
  });
});

describe('Presence', () => {
  it('paylaşım başlat / güncelle / durdur ve görünürlük kuralları', async () => {
    const p = make();
    const visible = await p.presence.list(CURRENT_USER_ID, ist);
    // u_elif karşılıklı takip, u_kerem eşleşmesi bekliyor (görünmez), u_mert karşılıklı değil
    expect(visible.map((s) => s.userId)).toEqual(['u_elif']);
    const share = await p.presence.start(CURRENT_USER_ID, {
      mode: 'friends',
      coords: ist,
      durationMin: 60,
    });
    expect(share.expiresAt).not.toBeNull();
    expect((await p.presence.mine(CURRENT_USER_ID))?.mode).toBe('friends');
    const updated = await p.presence.update(
      CURRENT_USER_ID,
      { latitude: 41.1, longitude: 29.1 },
      { batteryPct: 40 },
    );
    expect(updated?.batteryPct).toBe(40);
    await p.presence.stop(CURRENT_USER_ID);
    expect(await p.presence.mine(CURRENT_USER_ID)).toBeNull();
  });
});

describe('Stories', () => {
  it('gruplar, görülme ve oluşturma', async () => {
    const p = make();
    const groups = await p.stories.groups(CURRENT_USER_ID);
    const elif = groups.find((g) => g.author.id === 'u_elif')!;
    expect(elif.stories.length).toBe(2);
    expect(elif.allSeen).toBe(false);
    const baris = groups.find((g) => g.author.id === 'u_baris')!;
    expect(baris.allSeen).toBe(true);
    expect(groups.indexOf(elif)).toBeLessThan(groups.indexOf(baris));

    await p.stories.markSeen(CURRENT_USER_ID, elif.stories[0]!.id);
    await p.stories.markSeen(CURRENT_USER_ID, elif.stories[0]!.id); // tekrar sayılmaz
    const again = await p.stories.groups(CURRENT_USER_ID);
    expect(again.find((g) => g.author.id === 'u_elif')!.stories[0]!.viewsCount).toBe(313);

    const story = await p.stories.create(CURRENT_USER_ID, {
      mediaUri: null,
      caption: 'Test',
      adventureType: 'hiking',
      locationName: '',
    });
    expect(story.locationName).toBe('Kadıköy, İstanbul');
    const mine = (await p.stories.groups(CURRENT_USER_ID))[0]!;
    expect(mine.author.id).toBe(CURRENT_USER_ID);
    const elifNotifs = await p.notifications.list('u_elif');
    expect(elifNotifs[0]?.type).toBe('story_posted');
  });
});

describe('Businesses & stays', () => {
  it('liste sıralaması (öne çıkan → puan), rezervasyon ve kayıt', async () => {
    const p = make();
    const list = await p.businesses.list({ origin: ist });
    expect(list[0]?.isFeatured).toBe(true);
    const stays = await p.businesses.list({ staysOnly: true });
    expect(stays.every((b) => b.priceFromTry !== null)).toBe(true);

    const booking = await p.businesses.reserve(CURRENT_USER_ID, {
      businessId: 'biz1',
      checkIn: '2026-10-10T12:00:00.000Z',
      checkOut: '2026-10-12T10:00:00.000Z',
      guests: 2,
    });
    expect(booking.nights).toBe(2);
    expect(booking.totalTry).toBe(1450 * 2 + Math.round(1450 * 2 * 0.05));
    expect(booking.status).toBe('pending');
    await expect(
      p.businesses.reserve(CURRENT_USER_ID, {
        businessId: 'biz3',
        checkIn: '2026-10-10T00:00:00.000Z',
        checkOut: '2026-10-11T00:00:00.000Z',
        guests: 1,
      }),
    ).rejects.toThrow();
    const emreNotifs = await p.notifications.list('u_emre');
    expect(emreNotifs[0]?.type).toBe('stay_request');

    const created = await p.businesses.register(CURRENT_USER_ID, {
      name: 'Test Pansiyon',
      type: 'pension',
      description: '',
      locationName: '',
      priceFromTry: 900,
      amenities: ['Wi-Fi'],
      adventureTypes: ['hiking'],
      phone: null,
      website: null,
    });
    expect(created.plan).toBe('free');
    expect((await p.businesses.myStays(CURRENT_USER_ID)).length).toBeGreaterThanOrEqual(2);
  });
});

describe('Billing', () => {
  it('abonelik planı değiştirir ve işletme planını senkronlar; kazançları hesaplar', async () => {
    const p = make();
    await p.businesses.register(CURRENT_USER_ID, {
      name: 'X',
      type: 'hotel',
      description: '',
      locationName: '',
      priceFromTry: 1000,
      amenities: [],
      adventureTypes: [],
      phone: null,
      website: null,
    });
    const user = await p.billing.subscribe(CURRENT_USER_ID, 'business', 'yearly');
    expect(user.plan).toBe('business');
    const mine = (await p.businesses.list({})).find((b) => b.ownerId === CURRENT_USER_ID);
    expect(mine?.plan).toBe('business');
    const e = await p.billing.earnings('u_elif');
    // u_elif: onaylı b1 (1200) → pro_guide %5
    expect(e.grossTry).toBe(1200);
    expect(e.netTry).toBe(1140);
  });
});

describe('Emergency', () => {
  it('SOS tetikler, kişilere bildirir, SOS konum paylaşımı açar ve kapatır', async () => {
    const p = make();
    const centers = await p.emergency.centers(ist, 3);
    expect(centers.length).toBe(3);
    expect(centers[0]!.distanceKm).toBeLessThanOrEqual(centers[1]!.distanceKm);

    const event = await p.emergency.triggerSos(CURRENT_USER_ID, ist);
    expect(event.notifiedContacts).toBe(2);
    expect((await p.emergency.activeSos(CURRENT_USER_ID))?.id).toBe(event.id);
    const elifNotifs = await p.notifications.list('u_elif');
    expect(elifNotifs[0]?.type).toBe('sos_alert');
    // SOS herkes tarafından görülür
    const seenByStranger = await p.presence.list('u_nil', ist);
    expect(seenByStranger.some((s) => s.userId === CURRENT_USER_ID && s.mode === 'sos')).toBe(true);

    await p.emergency.resolveSos(CURRENT_USER_ID);
    expect(await p.emergency.activeSos(CURRENT_USER_ID)).toBeNull();
    expect((await p.presence.list('u_nil', ist)).some((s) => s.userId === CURRENT_USER_ID)).toBe(
      false,
    );

    const updated = await p.emergency.updateContacts(CURRENT_USER_ID, [
      { name: ' Ali ', phone: ' 555 ', userId: null },
      { name: '', phone: '1', userId: null },
    ]);
    expect(updated.emergencyContacts).toEqual([{ name: 'Ali', phone: '555', userId: null }]);
  });
});

describe('Drone stream', () => {
  it('drone kaynaklı yayın telemetriyle başlar', async () => {
    const p = make();
    const s = await p.live.start(CURRENT_USER_ID, {
      title: 'Drone',
      description: '',
      adventureType: 'hiking',
      locationName: '',
      source: 'drone',
    });
    expect(s.source).toBe('drone');
    expect(s.droneTelemetry?.batteryPct).toBe(100);
    const list = await p.live.list();
    expect(list.some((x) => x.id === 's8' && x.source === 'drone')).toBe(true);
  });
});
