import { createMockProvider } from '../mock/provider';
import { CURRENT_USER_ID } from '../mock/seed';

const make = () => createMockProvider({ persist: false, latencyMs: 0 });
const KACKAR = { latitude: 40.8321, longitude: 41.1594 };

describe('Satellite provider', () => {
  it('seed: 2 cihaz, 6 mesaj (kuyruk üstte), aktif SOS yok', async () => {
    const p = make();
    const devices = await p.satellite.devices(CURRENT_USER_ID);
    expect(devices.map((d) => d.type).sort()).toEqual(['inreach', 'phone_satellite']);
    const messages = await p.satellite.messages(CURRENT_USER_ID);
    expect(messages).toHaveLength(6);
    expect(messages[0]?.status).toBe('queued');
    expect(await p.satellite.sos(CURRENT_USER_ID)).toBeNull();
  });

  it('eşleştir / kaldır ve IMEI doğrulaması', async () => {
    const p = make();
    await expect(
      p.satellite.pair(CURRENT_USER_ID, { type: 'zoleo', name: 'Z', imei: '123' }),
    ).rejects.toThrow(/IMEI/);
    const d = await p.satellite.pair(CURRENT_USER_ID, {
      type: 'zoleo',
      name: 'ZOLEO',
      imei: '300434063999999',
    });
    expect(d.monthlyQuota).toBe(25);
    expect((await p.satellite.devices(CURRENT_USER_ID)).some((x) => x.id === d.id)).toBe(true);
    await p.satellite.unpair(CURRENT_USER_ID, d.id);
    expect((await p.satellite.devices(CURRENT_USER_ID)).some((x) => x.id === d.id)).toBe(false);
  });

  it('bağlantı simülasyonu ve kuyruk: none → kuyruk, flush hücreselde gönderir', async () => {
    const p = make();
    expect((await p.satellite.linkStatus(CURRENT_USER_ID)).link).toBe('cellular');
    await p.satellite.setLink(CURRENT_USER_ID, 'none');
    const queued = await p.satellite.send(CURRENT_USER_ID, {
      kind: 'text',
      body: 'güvendeyim',
      coords: KACKAR,
      toContacts: [],
    });
    expect(queued.status).toBe('queued');
    expect(queued.body.length).toBeLessThanOrEqual(160);
    // Kullanıcının acil kişileri varsayılan alıcı
    expect(queued.toContacts.length).toBeGreaterThan(0);

    await p.satellite.setLink(CURRENT_USER_ID, 'cellular');
    const attempted = await p.satellite.flush(CURRENT_USER_ID);
    expect(attempted.some((m) => m.id === queued.id && m.status === 'sent')).toBe(true);
    // Kalıcı başarısız (5 deneme) mesaj yeniden denenmez
    expect(attempted.some((m) => m.id === 'sm_4')).toBe(false);
  });

  it('uyduda check-in hemen gider ve cihaz kotasını düşer; metin ilk turda bekler', async () => {
    const p = make();
    await p.satellite.setLink(CURRENT_USER_ID, 'satellite');
    const before = (await p.satellite.devices(CURRENT_USER_ID)).find((d) => d.id === 'sd_inreach');
    const checkin = await p.satellite.send(CURRENT_USER_ID, {
      kind: 'checkin',
      body: 'OK güvendeyim',
      coords: KACKAR,
      toContacts: [],
    });
    expect(checkin.status).toBe('sent');
    expect(checkin.link).toBe('satellite');
    const after = (await p.satellite.devices(CURRENT_USER_ID)).find((d) => d.id === 'sd_inreach');
    expect((after?.usedThisMonth ?? 0) - (before?.usedThisMonth ?? 0)).toBe(1);

    const text = await p.satellite.send(CURRENT_USER_ID, {
      kind: 'text',
      body: 'merhaba',
      coords: null,
      toContacts: [],
    });
    expect(text.status).toBe('queued');
    const flushed = await p.satellite.flush(CURRENT_USER_ID);
    expect(flushed.find((m) => m.id === text.id)?.status).toBe('sent');
  });

  it('SOS: başlat → aşamalar → çöz; bildirim ve sosEvents kaydı', async () => {
    const p = make();
    const s = await p.satellite.startSos(CURRENT_USER_ID, KACKAR);
    expect(s.stage).toBe('sent');
    expect(s.timeline.map((x) => x.stage)).toEqual(['armed', 'sent']);
    expect(s.rescueCenterId).not.toBeNull();
    await expect(p.satellite.startSos(CURRENT_USER_ID, KACKAR)).rejects.toThrow(/aktif/);

    // Genel SOS olayı ve canlı paylaşım ilk yardım tarafında da görünür
    expect((await p.emergency.activeSos(CURRENT_USER_ID))?.id).toBe(s.id);
    // u_elif acil kişi → sos_alert bildirimi
    const notifs = await p.notifications.list('u_elif');
    expect(notifs.some((n) => n.type === 'sos_alert' && n.targetId === s.id)).toBe(true);
    // Mesaj geçmişinde SOS yükü
    const messages = await p.satellite.messages(CURRENT_USER_ID);
    expect(messages.some((m) => m.kind === 'sos' && m.body.startsWith('SOS;'))).toBe(true);

    expect((await p.satellite.advanceSos(CURRENT_USER_ID)).stage).toBe('acknowledged');
    expect((await p.satellite.advanceSos(CURRENT_USER_ID)).stage).toBe('dispatched');
    expect((await p.satellite.advanceSos(CURRENT_USER_ID)).stage).toBe('resolved');
    expect(await p.satellite.sos(CURRENT_USER_ID)).toBeNull();
    expect(await p.emergency.activeSos(CURRENT_USER_ID)).toBeNull();
    await expect(p.satellite.advanceSos(CURRENT_USER_ID)).rejects.toThrow();
  });

  it('SOS iptal ve bağlantı yokken başlatma reddi', async () => {
    const p = make();
    await p.satellite.startSos(CURRENT_USER_ID, KACKAR);
    await p.satellite.cancelSos(CURRENT_USER_ID);
    expect(await p.satellite.sos(CURRENT_USER_ID)).toBeNull();
    await p.satellite.setLink(CURRENT_USER_ID, 'none');
    await expect(p.satellite.startSos(CURRENT_USER_ID, KACKAR)).rejects.toThrow(/Bağlantı/);
  });
});
