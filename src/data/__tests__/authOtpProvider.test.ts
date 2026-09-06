import { createMockProvider } from '@/data/mock/provider';
import { MockOtpService } from '@/data/mock/otp';
import type { DataProvider } from '@/data/repositories';
import { OTP_MAX_SENDS_PER_WINDOW, OtpError } from '@/domain';

/**
 * Mock sağlayıcının telefon + OTP akışı.
 * Kod sabit değildir; testte tohum sabitlenerek okunabilir hâle getirilir.
 */

const DEMO_PHONE = '+905321112267';
const NEW_PHONE = '+905339998877';

function makeProvider(seed = 0.123456): { provider: DataProvider; otp: MockOtpService } {
  const otp = new MockOtpService({ random: () => seed, onIssue: () => undefined });
  const provider = createMockProvider({ persist: false, latencyMs: 0, otp });
  return { provider, otp };
}

describe('mock sağlayıcı · telefon OTP', () => {
  it('kod üretir, ekranda gösterilecek geliştirme kodunu döner', async () => {
    const { provider } = makeProvider(0.123456);
    const challenge = await provider.auth.requestOtp({ phone: '0532 111 22 67' });

    expect(challenge.phone).toBe(DEMO_PHONE);
    expect(challenge.devCode).toMatch(/^\d{6}$/);
    // Kod tohumdan türer (0.123456 → 123456); sağlayıcıda sabit kod yoktur.
    expect(challenge.devCode).toBe('123456');
    expect(new Date(challenge.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(challenge.attemptsRemaining).toBe(5);
  });

  it('üretilen kod tohumdan gelir (sabit değil)', async () => {
    const a = makeProvider(0.111111);
    const b = makeProvider(0.777777);
    const codeA = (await a.provider.auth.requestOtp({ phone: NEW_PHONE })).devCode;
    const codeB = (await b.provider.auth.requestOtp({ phone: NEW_PHONE })).devCode;
    expect(codeA).not.toBe(codeB);
  });

  it('geçersiz numarayı reddeder', async () => {
    const { provider } = makeProvider();
    await expect(provider.auth.requestOtp({ phone: '0212 111 22 67' })).rejects.toMatchObject({
      code: 'invalidPhone',
    });
    await expect(provider.auth.requestOtp({ phone: '123' })).rejects.toBeInstanceOf(OtpError);
  });

  it('doğru kodla demo hesabına giriş yapar', async () => {
    const { provider } = makeProvider();
    const challenge = await provider.auth.requestOtp({ phone: DEMO_PHONE });
    const result = await provider.auth.verifyOtp({
      phone: DEMO_PHONE,
      code: challenge.devCode!,
    });

    expect(result.needsProfile).toBe(false);
    expect(result.user?.username).toBe('deniz.kaya');
    expect(await provider.auth.getSession()).not.toBeNull();
  });

  it('yanlış kodda kalan deneme sayısını bildirir', async () => {
    const { provider } = makeProvider();
    await provider.auth.requestOtp({ phone: DEMO_PHONE });

    await expect(
      provider.auth.verifyOtp({ phone: DEMO_PHONE, code: '000000' }),
    ).rejects.toMatchObject({ code: 'invalidCode', attemptsRemaining: 4 });
    await expect(
      provider.auth.verifyOtp({ phone: DEMO_PHONE, code: '000001' }),
    ).rejects.toMatchObject({ code: 'invalidCode', attemptsRemaining: 3 });
  });

  it('beş yanlış denemeden sonra numarayı kilitler', async () => {
    const { provider } = makeProvider();
    await provider.auth.requestOtp({ phone: DEMO_PHONE });
    for (let i = 0; i < 4; i += 1) {
      await expect(
        provider.auth.verifyOtp({ phone: DEMO_PHONE, code: '000000' }),
      ).rejects.toMatchObject({ code: 'invalidCode' });
    }
    await expect(
      provider.auth.verifyOtp({ phone: DEMO_PHONE, code: '000000' }),
    ).rejects.toMatchObject({ code: 'locked' });
    // Kilitliyken doğru kod da çalışmaz.
    await expect(
      provider.auth.verifyOtp({ phone: DEMO_PHONE, code: '123456' }),
    ).rejects.toMatchObject({ code: 'locked' });
  });

  it('kod tek kullanımlıktır', async () => {
    const { provider } = makeProvider();
    const challenge = await provider.auth.requestOtp({ phone: DEMO_PHONE });
    await provider.auth.verifyOtp({ phone: DEMO_PHONE, code: challenge.devCode! });
    await expect(
      provider.auth.verifyOtp({ phone: DEMO_PHONE, code: challenge.devCode! }),
    ).rejects.toMatchObject({ code: 'consumed' });
  });

  it('bekleme süresi dolmadan yeniden kod göndermez', async () => {
    const { provider } = makeProvider();
    await provider.auth.requestOtp({ phone: NEW_PHONE });
    await expect(provider.auth.requestOtp({ phone: NEW_PHONE })).rejects.toMatchObject({
      code: 'cooldown',
    });
  });

  it('saatlik kota dolunca reddeder', async () => {
    const otp = new MockOtpService({ random: () => 0.5, onIssue: () => undefined });
    const provider = createMockProvider({ persist: false, latencyMs: 0, otp });
    const base = Date.UTC(2026, 0, 1, 12, 0, 0);
    const spy = jest.spyOn(Date, 'now');

    // Bekleme sürelerini atlayarak kotayı doldur.
    let t = base;
    for (let i = 0; i < OTP_MAX_SENDS_PER_WINDOW; i += 1) {
      spy.mockReturnValue(t);
      await provider.auth.requestOtp({ phone: NEW_PHONE });
      t += 400_000; // her seferinde beklemeyi aşacak kadar ilerle (pencere içinde)
    }
    spy.mockReturnValue(t);
    await expect(provider.auth.requestOtp({ phone: NEW_PHONE })).rejects.toMatchObject({
      code: 'quota',
    });
    spy.mockRestore();
  });

  it('süresi dolmuş kodu reddeder', async () => {
    const otp = new MockOtpService({ random: () => 0.5, onIssue: () => undefined });
    const provider = createMockProvider({ persist: false, latencyMs: 0, otp });
    const base = Date.UTC(2026, 0, 1, 12, 0, 0);
    const spy = jest.spyOn(Date, 'now').mockReturnValue(base);
    const challenge = await provider.auth.requestOtp({ phone: NEW_PHONE });

    spy.mockReturnValue(base + 200_000); // 200 sn > 180 sn ömür
    await expect(
      provider.auth.verifyOtp({ phone: NEW_PHONE, code: challenge.devCode! }),
    ).rejects.toMatchObject({ code: 'expired' });
    spy.mockRestore();
  });

  it('yeni numarada profil adımı ister ve kaydı tamamlar', async () => {
    const { provider } = makeProvider();
    const challenge = await provider.auth.requestOtp({ phone: NEW_PHONE });
    const verified = await provider.auth.verifyOtp({
      phone: NEW_PHONE,
      code: challenge.devCode!,
    });
    expect(verified.needsProfile).toBe(true);
    expect(verified.user).toBeNull();

    expect(await provider.auth.isUsernameAvailable('deniz.kaya')).toBe(false);
    expect(await provider.auth.isUsernameAvailable('yeni.gezgin')).toBe(true);

    const user = await provider.auth.completeProfile({
      phone: NEW_PHONE,
      displayName: 'Yeni Gezgin',
      username: 'Yeni.Gezgin',
    });
    expect(user.username).toBe('yeni.gezgin');
    expect(user.displayName).toBe('Yeni Gezgin');
    expect((await provider.auth.getSession())?.id).toBe(user.id);
  });

  it('alınmış kullanıcı adını reddeder', async () => {
    const { provider } = makeProvider();
    const challenge = await provider.auth.requestOtp({ phone: NEW_PHONE });
    await provider.auth.verifyOtp({ phone: NEW_PHONE, code: challenge.devCode! });
    await expect(
      provider.auth.completeProfile({
        phone: NEW_PHONE,
        displayName: 'Kopya',
        username: 'deniz.kaya',
      }),
    ).rejects.toMatchObject({ code: 'usernameTaken' });
  });

  it('doğrulanmamış numarayla profil tamamlanamaz', async () => {
    const { provider } = makeProvider();
    await expect(
      provider.auth.completeProfile({
        phone: NEW_PHONE,
        displayName: 'Sahte',
        username: 'sahte.kayit',
      }),
    ).rejects.toMatchObject({ code: 'notVerified' });
  });
});
