import { createMockProvider } from '../mock/provider';
import { CURRENT_USER_ID } from '../mock/seed';

const make = () => createMockProvider({ persist: false, latencyMs: 0 });

/** latencyMs=0 bile setTimeout kullanır; sahte zamanlayıcılarla beklerken ilerletiriz. */
async function run<T>(promise: Promise<T>): Promise<T> {
  // Zamanlayıcı ilerlerken erken reddedilen sözün "unhandled" sayılmaması için
  promise.catch(() => undefined);
  await jest.advanceTimersByTimeAsync(5);
  return promise;
}

const snakeInput = {
  complaint: 'Arkadaşımı yılan ısırdı, bileği şişiyor, hastaneye 3 saat uzaktayız',
  urgency: 'high' as const,
  specialty: null,
  firstAidSlug: null,
  speciesId: null,
  coords: { latitude: 40.83, longitude: 41.17 },
  channel: 'chat' as const,
};

describe('Telemed', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('doktor listesi: çevrimiçi önce, uzmanlık ve çevrimiçi filtresi', async () => {
    const p = make();
    const all = await run(p.telemed.doctors());
    expect(all).toHaveLength(10);
    expect(all.filter((d) => d.isOnline)).toHaveLength(6);
    expect(all.slice(0, 6).every((d) => d.isOnline)).toBe(true);
    expect(all.every((d) => d.user.id === d.userId)).toBe(true);
    const tox = await run(p.telemed.doctors('toxicology', true));
    expect(tox.map((d) => d.id)).toEqual(['d_ayse']);
    const detail = await run(p.telemed.doctor('d_lale'));
    expect(detail?.user.displayName).toBe('Lale Demir');
  });

  it('geçmiş danışmalar seed: tamamlanmış yılan ısırığı 12 mesaj, iptal edilmiş kene', async () => {
    const p = make();
    const mine = await run(p.telemed.myConsultations(CURRENT_USER_ID));
    expect(mine.map((c) => c.id)).toEqual(['cs_snake', 'cs_tick']);
    const snake = mine[0]!;
    expect(snake.status).toBe('completed');
    expect(snake.messages).toHaveLength(12);
    expect(snake.messages.filter((m) => m.isInstruction)).toHaveLength(5);
    expect(snake.doctor?.id).toBe('d_ayse');
    expect(snake.summary).toMatch(/Doktor talimatları/);
    expect(mine[1]?.status).toBe('cancelled');
  });

  it('request → toksikolog atanır, bildirim gider, 6 sn içinde otomatik kabul + karşılama', async () => {
    const p = make();
    const c = await run(p.telemed.request(CURRENT_USER_ID, snakeInput));
    expect(c.status).toBe('requested');
    expect(c.doctorId).toBe('d_ayse');
    expect(c.firstAidSlug).toBe('snakebite');
    expect(c.triage.length).toBeGreaterThan(3);
    expect(c.messages).toHaveLength(1);
    expect(c.messages[0]?.senderId).toBe(CURRENT_USER_ID);

    // Doktora "message" bildirimi (sos_alert değil)
    const doctorNotifs = await run(p.notifications.list('u_ayse'));
    expect(doctorNotifs.some((n) => n.type === 'message' && n.targetId === c.id)).toBe(true);

    // İkinci açık talep reddedilir
    await expect(run(p.telemed.request(CURRENT_USER_ID, snakeInput))).rejects.toThrow();

    await jest.advanceTimersByTimeAsync(6100);
    const active = await run(p.telemed.consultation(CURRENT_USER_ID, c.id));
    expect(active?.status).toBe('active');
    expect(active?.acceptedAt).not.toBeNull();
    expect(active?.messages).toHaveLength(2);
    expect(active?.messages[1]?.senderId).toBe('u_ayse');
    expect(active?.messages[1]?.content).toMatch(/^Merhaba, ben Uzm\. Dr\. Ayşe Kurt\./);
  });

  it('send → 4 sn içinde kural tabanlı doktor talimatı; end özet üretir', async () => {
    const p = make();
    const c = await run(p.telemed.request(CURRENT_USER_ID, snakeInput));
    // Kabul öncesi hasta yazabilir, doktor yanıtlamaz
    await run(p.telemed.send(CURRENT_USER_ID, c.id, 'Fotoğraf ekliyorum', 'file://x.jpg'));
    await jest.advanceTimersByTimeAsync(6100);
    let cur = await run(p.telemed.consultation(CURRENT_USER_ID, c.id));
    expect(cur?.status).toBe('active');
    expect(cur?.messages).toHaveLength(3);

    const sent = await run(p.telemed.send(CURRENT_USER_ID, c.id, 'Şişlik var ve morardı'));
    expect(sent.sender.id).toBe(CURRENT_USER_ID);
    expect(sent.isInstruction).toBe(false);
    await jest.advanceTimersByTimeAsync(4100);
    cur = await run(p.telemed.consultation(CURRENT_USER_ID, c.id));
    const last = cur!.messages[cur!.messages.length - 1]!;
    expect(last.senderId).toBe('u_ayse');
    expect(last.isInstruction).toBe(true);
    expect(last.content).toMatch(/Turnike/);

    // Yabancı kullanıcı yazamaz
    await expect(run(p.telemed.send('u_kerem', c.id, 'selam'))).rejects.toThrow();

    const ended = await run(p.telemed.end(CURRENT_USER_ID, c.id));
    expect(ended.status).toBe('completed');
    expect(ended.endedAt).not.toBeNull();
    expect(ended.summary).toMatch(/^Doktor talimatları:\n• /);
    await expect(run(p.telemed.send(CURRENT_USER_ID, c.id, 'tekrar'))).rejects.toThrow();
    await expect(run(p.telemed.end(CURRENT_USER_ID, c.id))).rejects.toThrow();
  });

  it('cancel → iptal edilir, gecikmiş kabul uygulanmaz; accept doktor tarafı', async () => {
    const p = make();
    const c = await run(p.telemed.request(CURRENT_USER_ID, snakeInput));
    await run(p.telemed.cancel(CURRENT_USER_ID, c.id));
    await jest.advanceTimersByTimeAsync(6100);
    const after = await run(p.telemed.consultation(CURRENT_USER_ID, c.id));
    expect(after?.status).toBe('cancelled');
    expect(after?.messages).toHaveLength(1);
    await expect(run(p.telemed.cancel(CURRENT_USER_ID, c.id))).rejects.toThrow();

    const c2 = await run(
      p.telemed.request(CURRENT_USER_ID, { ...snakeInput, specialty: 'orthopedics' }),
    );
    expect(c2.doctorId).toBe('d_selin');
    const accepted = await run(p.telemed.accept('u_nil', c2.id));
    expect(accepted.status).toBe('active');
    expect(accepted.doctorId).toBe('d_nil');
    expect(accepted.messages[1]?.senderId).toBe('u_nil');
  });

  it('triage: gateway yoksa yerel kural tabanlı sonuç', async () => {
    const p = make();
    const r = await run(
      p.telemed.triage({ complaint: 'Arı soktu, dudakları şişti', locale: 'en' }),
    );
    expect(r.urgency).toBe('critical');
    expect(r.firstAidSlug).toBe('anaphylaxis');
    expect(r.callEmergency).toBe(true);
    expect(r.steps[0]).toMatch(/adrenaline/i);
  });
});
