import type { VisionRequest } from '@/domain';

import { RemoteVisionClient, toRemoteVisionBody } from '../ai/remoteVision';
import { createMockProvider } from '../mock/provider';
import { CURRENT_USER_ID } from '../mock/seed';

const make = () => createMockProvider({ persist: false, latencyMs: 0 });

const input: VisionRequest = {
  imageUri: 'file:///tmp/slope.jpg',
  imageBase64: null,
  situation: 'terrain',
  question: 'Buradan geçebilir miyim?',
  coords: { latitude: 40.83, longitude: 41.15 },
  altitudeM: 2900,
  locale: 'tr',
};

describe('Vision repository (mock)', () => {
  it('analyze yerel kaynakla tavsiye üretir ve geçmişe yazar', async () => {
    const p = make();
    const before = await p.vision.history(CURRENT_USER_ID);
    expect(before.length).toBeGreaterThanOrEqual(1);

    const advice = await p.vision.analyze(CURRENT_USER_ID, input);
    expect(advice.source).toBe('local');
    expect(advice.situation).toBe('terrain');
    expect(advice.advice.length).toBeGreaterThanOrEqual(3);
    expect(advice.actions.length).toBeGreaterThanOrEqual(1);
    expect(advice.actions.some((a) => a.href === '/destinations/ams')).toBe(true);
    expect(advice.id).toMatch(/^vis_/);

    const after = await p.vision.history(CURRENT_USER_ID);
    expect(after.length).toBe(before.length + 1);
    expect(after[0]?.id).toBe(advice.id);
    expect(after[0]?.thumbnailUri).toBe(input.imageUri);
    expect(after[0]?.question).toBe(input.question);
    expect((after[0]?.createdAt ?? '') >= (after[1]?.createdAt ?? '')).toBe(true);
    // userId dışarı sızmaz
    expect('userId' in (after[0] ?? {})).toBe(false);

    // Başka kullanıcının geçmişi ayrı
    expect(await p.vision.history('u_elif')).toEqual([]);
    await expect(p.vision.analyze('yok', input)).rejects.toThrow();
  });

  it('geçmiş 50 kayıtla sınırlıdır ve clearHistory yalnızca kullanıcının kayıtlarını siler', async () => {
    const p = make();
    for (let i = 0; i < 55; i += 1)
      await p.vision.analyze(CURRENT_USER_ID, { ...input, question: `soru ${i}` });
    const mine = await p.vision.history(CURRENT_USER_ID);
    expect(mine.length).toBe(50);
    expect(mine[0]?.question).toBe('soru 54');

    await p.vision.analyze('u_elif', { ...input, situation: 'water' });
    await p.vision.clearHistory(CURRENT_USER_ID);
    expect(await p.vision.history(CURRENT_USER_ID)).toEqual([]);
    expect((await p.vision.history('u_elif')).length).toBe(1);
  });
});

describe('RemoteVisionClient', () => {
  const png = Buffer.alloc(2048, 7).toString('base64');

  it('gövdeyi hazırlar: data URL ayıklanır, medya türü tahmin edilir', () => {
    const body = toRemoteVisionBody({ ...input, imageBase64: `data:image/png;base64,${png}` });
    expect(body.mediaType).toBe('image/png');
    expect(body.imageBase64).toBe(png);
    expect(body.situation).toBe('terrain');
    expect(toRemoteVisionBody({ ...input, imageBase64: png }).mediaType).toBe('image/jpeg');
    expect(
      toRemoteVisionBody({ ...input, imageUri: 'file:///a.webp', imageBase64: png }).mediaType,
    ).toBe('image/webp');
    expect(() => toRemoteVisionBody(input)).toThrow();
    expect(() =>
      toRemoteVisionBody({ ...input, imageBase64: 'A'.repeat(5 * 1024 * 1024) }),
    ).toThrow(/büyük/);
  });

  it('gateway yanıtını VisionAdvice olarak döner ve x-zirve-key gönderir', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(
        JSON.stringify({
          observations: ['Dik kar yamacı'],
          risk: 'high',
          advice: ['Tek tek geç', 'Kask tak', 'Erken saat'],
          avoid: ['Altında bekleme'],
          actions: [{ label: 'Tehlike', href: '/hazards', icon: 'triangle-alert' }],
          confidence: 0.8,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as typeof fetch;
    const client = new RemoteVisionClient({ baseUrl: 'http://gw/', apiKey: 'k1', fetchImpl });
    const advice = await client.analyze({ ...input, imageBase64: png }, new Date(0));
    expect(calls[0]?.url).toBe('http://gw/v1/vision');
    expect((calls[0]?.init.headers as Record<string, string>)['x-zirve-key']).toBe('k1');
    const sent = JSON.parse(String(calls[0]?.init.body)) as { imageBase64: string; locale: string };
    expect(sent.imageBase64).toBe(png);
    expect(sent.locale).toBe('tr');
    expect(advice.source).toBe('remote');
    expect(advice.risk).toBe('high');
    expect(advice.actions).toHaveLength(1);
    expect(advice.createdAt).toBe(new Date(0).toISOString());
  });

  it('HTTP hatasında RemoteAiError fırlatır; repository yerel tavsiyeye düşer', async () => {
    const failing = (async () => new Response('boom', { status: 502 })) as typeof fetch;
    const client = new RemoteVisionClient({ baseUrl: 'http://gw', fetchImpl: failing });
    await expect(client.analyze({ ...input, imageBase64: png })).rejects.toMatchObject({
      name: 'RemoteAiError',
      status: 502,
    });

    const { createVisionRepository } = await import('../mock/repos/vision');
    const { MockDatabase } = await import('../mock/database');
    const db = new MockDatabase(false);
    const repo = createVisionRepository(
      {
        db,
        wait: async () => {},
        latencyMs: 0,
        requireUser: (users, id) => {
          const u = users.find((x) => x.id === id);
          if (!u) throw new Error('yok');
          return u;
        },
        pushNotification: async () => {},
      },
      { remote: client },
    );
    const advice = await repo.analyze(CURRENT_USER_ID, { ...input, imageBase64: png });
    expect(advice.source).toBe('local');
  });
});
