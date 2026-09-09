import { uuidV4 } from '../ids';

const uuidMi = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

describe('istemci kimliği', () => {
  it('geçerli biçimde UUID üretir', () => {
    for (let i = 0; i < 50; i++) expect(uuidMi(uuidV4())).toBe(true);
  });

  it('sürüm ve varyant bitleri RFC 4122 ile uyumlu', () => {
    for (let i = 0; i < 50; i++) {
      const u = uuidV4();
      expect(u[14]).toBe('4');
      expect(['8', '9', 'a', 'b']).toContain(u[19]!.toLowerCase());
    }
  });

  it('çakışma üretmez', () => {
    const n = 5000;
    expect(new Set(Array.from({ length: n }, uuidV4)).size).toBe(n);
  });

  it('crypto yokken de çalışır (Math.random yedeği)', () => {
    const asil = globalThis.crypto;
    // @ts-expect-error — yedek yolu sınanıyor.
    delete globalThis.crypto;
    try {
      const u = uuidV4();
      expect(uuidMi(u)).toBe(true);
      expect(u[14]).toBe('4');
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: asil, configurable: true });
    }
  });

  it('randomUUID fırlatırsa yedeğe düşer', () => {
    const asil = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        randomUUID: () => {
          throw new Error('güvenli bağlam değil');
        },
      },
      configurable: true,
    });
    try {
      expect(uuidMi(uuidV4())).toBe(true);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: asil, configurable: true });
    }
  });
});
