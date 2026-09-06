import { TelemetryClient } from '../client';
import {
  eventSignature,
  scrubEndpoint,
  scrubRoute,
  scrubStack,
  scrubText,
  sessionHash,
} from '../scrub';

/** Bellekte çalışan sahte depolama. */
function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    store: map,
    getItem: jest.fn(async (k: string) => map.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => void map.set(k, v)),
    removeItem: jest.fn(async (k: string) => void map.delete(k)),
  };
}

const client = (over: Partial<ConstructorParameters<typeof TelemetryClient>[0]> = {}) =>
  new TelemetryClient({
    app: { version: '1.6.0', channel: 'production' },
    locale: 'tr',
    now: () => Date.parse('2026-09-06T12:00:00.000Z'),
    storage: memoryStorage(),
    flushIntervalMs: 0,
    ...over,
  });

describe('scrubRoute', () => {
  it('kimlikleri şablona çevirir', () => {
    expect(scrubRoute('/heritage/her_gobeklitepe')).toBe('/heritage/[id]');
    expect(scrubRoute('/post/p1')).toBe('/post/[id]');
    expect(scrubRoute('/user/u_elif')).toBe('/user/[id]');
    expect(scrubRoute('/articles/temel-dagcilik-egitimi')).toBe('/articles/[slug]');
  });
  it('sorgu dizesini ve çapayı atar', () => {
    expect(scrubRoute('/stays/reserve?businessId=biz1#bolum')).toBe('/stays/reserve');
  });
  it('sabit rotaları olduğu gibi bırakır', () => {
    expect(scrubRoute('/settings')).toBe('/settings');
    expect(scrubRoute('/first-aid/contacts')).toBe('/first-aid/contacts');
  });
  it('boş girdide undefined döner', () => {
    expect(scrubRoute(null)).toBeUndefined();
    expect(scrubRoute('')).toBeUndefined();
  });
});

describe('scrubText — kişisel veri sızdırmaz', () => {
  it('e-posta, telefon ve koordinatı gizler', () => {
    const text = 'Kullanıcı deniz.kaya@ornek.com, +90 555 123 45 67, 41.0082, 28.9784 konumunda';
    const out = scrubText(text);
    expect(out).toContain('[eposta]');
    expect(out).toContain('[telefon]');
    expect(out).toContain('[konum]');
    expect(out).not.toContain('deniz.kaya@ornek.com');
    expect(out).not.toContain('28.9784');
  });
  it('jeton ve anahtarları gizler', () => {
    expect(scrubText('Authorization: Bearer abc123def456ghi789')).toContain('[jeton]');
    expect(scrubText('api_key = sk_live_9f8e7d6c5b4a3210')).toContain('[gizli]');
  });
  it('kart ve kimlik numarasını gizler', () => {
    expect(scrubText('kart 4242 4242 4242 4242')).toContain('[kart]');
    expect(scrubText('tc 12345678901')).toContain('[kimlik]');
  });
  it('kullanıcı dizin yollarını kısaltır', () => {
    expect(scrubText('/home/deniz/proje/src/app.ts')).toBe('~/proje/src/app.ts');
    expect(scrubText('/Users/deniz/kod/x.ts')).toBe('~/kod/x.ts');
  });
  it('uzunluğu sınırlar', () => {
    expect(scrubText('a'.repeat(1000), 50)).toHaveLength(50);
  });
  it('boş girdiyi tolere eder', () => {
    expect(scrubText(null)).toBe('');
    expect(scrubText(undefined)).toBe('');
  });
});

describe('scrubStack', () => {
  it('kareleri sınırlar ve yolları temizler', () => {
    const stack = Array.from(
      { length: 30 },
      (_, i) => `  at fn${i} (/home/deniz/src/a.ts:${i})`,
    ).join('\n');
    const out = scrubStack(stack, 5);
    expect(out?.split('\n')).toHaveLength(5);
    expect(out).not.toContain('/home/deniz');
    expect(out).toContain('~/src/a.ts');
  });
  it('boş yığında undefined döner', () => {
    expect(scrubStack(null)).toBeUndefined();
    expect(scrubStack('')).toBeUndefined();
  });
});

describe('scrubEndpoint', () => {
  it('mutlak adreste yalnızca yolu tutar', () => {
    expect(scrubEndpoint('https://api.zirtan.app/v1/posts/p12')).toBe('/v1/posts/[id]');
  });
  it('ana bilgisayar adını sızdırmaz', () => {
    expect(scrubEndpoint('https://gizli-sunucu.example.com/v1/x')).not.toContain('gizli-sunucu');
  });
  it('bilinmeyen girdide yer tutucu döner', () => {
    expect(scrubEndpoint(null)).toBe('[bilinmiyor]');
  });
});

describe('sessionHash / eventSignature', () => {
  it('aynı girdi aynı özeti verir, girdi geri döndürülemez', () => {
    const a = sessionHash('kullanici-123');
    expect(a).toBe(sessionHash('kullanici-123'));
    expect(a).toHaveLength(8);
    expect(a).not.toContain('kullanici');
  });
  it('farklı girdi farklı özet verir', () => {
    expect(sessionHash('a')).not.toBe(sessionHash('b'));
  });
  it('imza tür ve rotayı ayırır', () => {
    expect(eventSignature('error', '/a', 'x')).not.toBe(eventSignature('error', '/b', 'x'));
    expect(eventSignature('error', '/a', 'x')).toBe(eventSignature('error', '/a', 'x'));
  });
});

describe('TelemetryClient', () => {
  it('olayı şemaya uygun kaydeder', async () => {
    const c = client();
    await c.init();
    c.setRoute('/heritage/her_efes');
    c.track('error', { message: 'Bir şey bozuldu', handledBy: 'boundary' });
    const [event] = c.pending();
    expect(event?.kind).toBe('error');
    expect(event?.app.version).toBe('1.6.0');
    expect(['ios', 'android', 'web']).toContain(event?.platform);
    expect(event?.locale).toBe('tr');
    expect(event?.route).toBe('/heritage/[id]');
    expect(event?.sessionHash).toHaveLength(8);
    expect(event?.count).toBe(1);
    expect(event?.ts).toBe('2026-09-06T12:00:00.000Z');
    c.stop();
  });

  it('aynı hatayı tekrarlarsa sayacı artırır, yeni kayıt açmaz', async () => {
    const c = client();
    await c.init();
    for (let i = 0; i < 5; i += 1) c.track('error', { message: 'aynı hata' });
    expect(c.pending()).toHaveLength(1);
    expect(c.pending()[0]?.count).toBe(5);
    c.stop();
  });

  it('farklı hatalar ayrı kayıt olur', async () => {
    const c = client();
    await c.init();
    c.track('error', { message: 'birinci' });
    c.track('error', { message: 'ikinci' });
    expect(c.pending()).toHaveLength(2);
    c.stop();
  });

  it('kişisel veriyi tamponda tutmaz', async () => {
    const c = client();
    await c.init();
    c.track('error', {
      message: 'giriş başarısız: deniz@ornek.com / +90 555 111 22 33',
      stack: 'at login (/home/deniz/src/auth.ts:10)',
    });
    const serialized = JSON.stringify(c.pending());
    expect(serialized).not.toContain('deniz@ornek.com');
    expect(serialized).not.toContain('/home/deniz');
    expect(serialized).toContain('[eposta]');
    c.stop();
  });

  it('tampon sınırını aşınca en eskiyi düşürür', async () => {
    const c = client({ maxBuffer: 3 });
    await c.init();
    for (let i = 0; i < 6; i += 1) c.track('error', { message: `hata ${i}` });
    expect(c.pending()).toHaveLength(3);
    expect((c.pending()[0]?.detail as { message: string } | undefined)?.message).toBe('hata 3');
    c.stop();
  });

  it('kapalıyken hiçbir olay toplamaz', async () => {
    const c = client();
    await c.init();
    await c.setEnabled(false);
    c.track('error', { message: 'toplanmamalı' });
    expect(c.pending()).toHaveLength(0);
    expect(c.isEnabled()).toBe(false);
    c.stop();
  });

  it('kapatınca tamponu ve depolamayı temizler', async () => {
    const storage = memoryStorage();
    const c = client({ storage });
    await c.init();
    c.track('error', { message: 'x' });
    await c.setEnabled(false);
    expect(c.pending()).toHaveLength(0);
    expect(storage.removeItem).toHaveBeenCalledWith('zirtan.telemetry.v1');
    c.stop();
  });

  it('önceki oturumun onay tercihini geri yükler', async () => {
    const c = client({ storage: memoryStorage({ 'zirtan.telemetry.consent': 'off' }) });
    await c.init();
    expect(c.isEnabled()).toBe(false);
    c.stop();
  });

  it('tamponu diskten geri yükler', async () => {
    const saved = JSON.stringify([
      {
        id: 'error:abc',
        ts: '2026-09-05T00:00:00.000Z',
        kind: 'error',
        app: { version: '1.0.0' },
        platform: 'web',
      },
    ]);
    const c = client({ storage: memoryStorage({ 'zirtan.telemetry.v1': saved }) });
    await c.init();
    expect(c.pending()).toHaveLength(1);
    c.stop();
  });

  it('bozuk tamponu tolere eder', async () => {
    const c = client({ storage: memoryStorage({ 'zirtan.telemetry.v1': '{bozuk' }) });
    await expect(c.init()).resolves.toBeUndefined();
    expect(c.pending()).toHaveLength(0);
    c.stop();
  });

  it('uç tanımlı değilse ağ isteği yapmaz', async () => {
    const fetchImpl = jest.fn();
    const c = client({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await c.init();
    c.track('error', { message: 'x' });
    const result = await c.flush();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, ok: true });
    expect(c.pending()).toHaveLength(1);
    c.stop();
  });

  it('uç tanımlıysa gönderir ve tamponu boşaltır', async () => {
    const fetchImpl = jest.fn(async () => ({ ok: true }) as Response);
    const c = client({ endpoint: 'https://t.zirtan.app/v1/events', fetchImpl });
    await c.init();
    c.track('error', { message: 'x' });
    c.track('slow_screen', { screen: '/maps', ms: 3200 });
    const result = await c.flush();
    expect(result).toEqual({ sent: 2, ok: true });
    expect(c.pending()).toHaveLength(0);
    const init = (fetchImpl.mock.calls as unknown as [string, RequestInit][])[0]?.[1];
    const body = JSON.parse(String(init?.body));
    expect(body.events).toHaveLength(2);
    c.stop();
  });

  it('gönderim başarısızsa olayları tamponda tutar', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('ağ yok');
    });
    const c = client({ endpoint: 'https://t.zirtan.app/v1/events', fetchImpl: fetchImpl as never });
    await c.init();
    c.track('error', { message: 'x' });
    const result = await c.flush();
    expect(result.ok).toBe(false);
    expect(c.pending()).toHaveLength(1);
    c.stop();
  });

  it('sunucu hatasında da olayları korur', async () => {
    const fetchImpl = jest.fn(async () => ({ ok: false, status: 500 }) as Response);
    const c = client({ endpoint: 'https://t.zirtan.app/v1/events', fetchImpl });
    await c.init();
    c.track('error', { message: 'x' });
    expect((await c.flush()).ok).toBe(false);
    expect(c.pending()).toHaveLength(1);
    c.stop();
  });

  it('parti boyutunu aşan olayları bölerek gönderir', async () => {
    const fetchImpl = jest.fn(async () => ({ ok: true }) as Response);
    const c = client({ endpoint: 'https://t.zirtan.app/v1/e', fetchImpl, batchSize: 2 });
    await c.init();
    for (let i = 0; i < 5; i += 1) c.track('error', { message: `h${i}` });
    expect((await c.flush()).sent).toBe(2);
    expect(c.pending()).toHaveLength(3);
    c.stop();
  });

  it('depolama hatası olay kaydını bozmaz', async () => {
    const storage = memoryStorage();
    storage.setItem.mockRejectedValue(new Error('disk dolu'));
    const c = client({ storage });
    await c.init();
    expect(() => c.track('error', { message: 'x' })).not.toThrow();
    expect(c.pending()).toHaveLength(1);
    c.stop();
  });

  it('her olay türünü kabul eder', async () => {
    const c = client();
    await c.init();
    c.track('crash', { message: 'çöktü', fatal: true });
    c.track('slow_screen', { screen: '/maps', ms: 4000, budgetMs: 1500 });
    c.track('failed_request', { endpoint: '/v1/posts/[id]', status: 500, method: 'GET' });
    c.track('flow_abandon', { flow: 'rezervasyon', step: 'ödeme', stepIndex: 3, totalSteps: 4 });
    c.track('empty_screen', { screen: '/tracks', hasEmptyState: false });
    c.track('i18n_missing', { key: 'courses.newKey', locale: 'ka' });
    expect(c.pending()).toHaveLength(6);
    expect(new Set(c.pending().map((e) => e.kind)).size).toBe(6);
    c.stop();
  });
});
