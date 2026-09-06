import { createRemoteContext } from '@/data/remote/context';
import type { PostgrestError, PostgrestResponse, Row, SupabaseLike } from '@/data/remote/postgrest';
import { createPhoneAuthRepository } from '@/data/remote/repos/auth';
import { OTP_TTL_SEC } from '@/domain';

/**
 * Uzak sağlayıcının telefon OTP yüzeyi — sahte Supabase istemcisiyle.
 *
 * Gerçek Postgres gerekmez: burada denetlenen şey GoTrue çağrılarının doğru
 * parametrelerle yapılması ve **hata eşlemesinin** ekranın anladığı `OtpError`
 * koduna dönüşmesidir (`over_sms_send_rate_limit` → `quota` gibi).
 */

interface Scenario {
  otpError?: PostgrestError | null;
  verifyError?: PostgrestError | null;
  userId?: string | null;
  profileCompleted?: boolean;
  storedPhone?: string | null;
  usernameAvailable?: unknown;
  updateError?: PostgrestError | null;
}

/** Zincirlenebilir sahte sorgu kurucusu; yalnızca kullanılan yüzeyi karşılar. */
function builder(data: unknown, error: PostgrestError | null = null) {
  const chain: Record<string, unknown> = {};
  const self = new Proxy(chain, {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (value: PostgrestResponse<unknown>) => unknown) =>
          resolve({ data, error });
      }
      if (prop === 'maybeSingle' || prop === 'single') {
        return async () => ({ data, error });
      }
      return () => self;
    },
  });
  return self as never;
}

function fakeClient(scenario: Scenario): SupabaseLike {
  const calls: Row[] = [];
  const client = {
    calls,
    from(table: string) {
      if (table === 'user_phones') {
        return builder(
          scenario.storedPhone === undefined ? null : { phone: scenario.storedPhone },
        );
      }
      return {
        select: () => builder({ id: 'u1', profile_completed: scenario.profileCompleted ?? false }),
        update: (values: Row) => {
          calls.push({ table, ...values });
          return builder([{ id: 'u1' }], scenario.updateError ?? null);
        },
        insert: () => builder([]),
        upsert: () => builder([]),
        delete: () => builder([]),
      };
    },
    rpc: () => builder(scenario.usernameAvailable ?? true),
    auth: {
      async getSession() {
        return { data: { session: null }, error: null };
      },
      async getUser() {
        return { data: { user: null }, error: null };
      },
      async signInWithPassword() {
        return { data: { user: null }, error: null };
      },
      async signUp() {
        return { data: { user: null }, error: null };
      },
      async signInWithOtp(input: Row) {
        calls.push({ method: 'signInWithOtp', ...input });
        return { data: { user: { id: 'u1' } }, error: scenario.otpError ?? null };
      },
      async verifyOtp(input: Row) {
        calls.push({ method: 'verifyOtp', ...input });
        return {
          data: { user: scenario.userId === null ? null : { id: scenario.userId ?? 'u1' } },
          error: scenario.verifyError ?? null,
        };
      },
      async signOut() {
        return { error: null };
      },
    },
  };
  return client as unknown as SupabaseLike;
}

function make(scenario: Scenario = {}) {
  const client = fakeClient(scenario);
  const ctx = createRemoteContext(client);
  return { repo: createPhoneAuthRepository(ctx), ctx, calls: (client as unknown as { calls: Row[] }).calls };
}

describe('uzak sağlayıcı · telefon OTP', () => {
  it('numarayı E.164 yapıp signInWithOtp çağırır ve kodu asla döndürmez', async () => {
    const { repo, calls } = make();
    const challenge = await repo.requestOtp({ phone: '0532 111 22 67', locale: 'tr' });

    expect(calls[0]).toMatchObject({ method: 'signInWithOtp', phone: '+905321112267' });
    expect(challenge.phone).toBe('+905321112267');
    expect(challenge.devCode).toBeNull();
    const ttl = new Date(challenge.expiresAt).getTime() - Date.now();
    expect(ttl).toBeLessThanOrEqual(OTP_TTL_SEC * 1000);
    expect(ttl).toBeGreaterThan(OTP_TTL_SEC * 1000 - 5000);
  });

  it('geçersiz numarayı sunucuya sormadan reddeder', async () => {
    const { repo, calls } = make();
    await expect(repo.requestOtp({ phone: '0212 111 22 67' })).rejects.toMatchObject({
      code: 'invalidPhone',
    });
    expect(calls).toHaveLength(0);
  });

  it('istemci tarafı bekleme süresi ikinci isteği keser', async () => {
    const { repo } = make();
    await repo.requestOtp({ phone: '+905321112267' });
    await expect(repo.requestOtp({ phone: '+905321112267' })).rejects.toMatchObject({
      code: 'cooldown',
    });
  });

  it('GoTrue hız sınırı hatasını kotaya eşler', async () => {
    const { repo } = make({
      otpError: { message: 'For security purposes, you can only request this after 34 seconds.' },
    });
    await expect(repo.requestOtp({ phone: '+905321112267' })).rejects.toMatchObject({
      code: 'cooldown',
      retryAfterSec: 34,
    });
  });

  it('SMS gönderim sınırını kota olarak bildirir', async () => {
    const { repo } = make({ otpError: { message: 'sms send rate limit exceeded' } });
    await expect(repo.requestOtp({ phone: '+905321112267' })).rejects.toMatchObject({
      code: 'quota',
    });
  });

  it('6 haneli olmayan kodu sunucuya sormaz', async () => {
    const { repo, calls } = make();
    await expect(repo.verifyOtp({ phone: '+905321112267', code: '123' })).rejects.toMatchObject({
      code: 'malformed',
    });
    expect(calls).toHaveLength(0);
  });

  it('süresi dolmuş kodu eşler', async () => {
    const { repo } = make({ verifyError: { message: 'Token has expired or is invalid' } });
    await expect(repo.verifyOtp({ phone: '+905321112267', code: '123456' })).rejects.toMatchObject(
      { code: 'expired' },
    );
  });

  it('doğrulanan yeni numarada profil adımı ister', async () => {
    const { repo, ctx, calls } = make({ profileCompleted: false });
    const result = await repo.verifyOtp({ phone: '0532 111 22 67', code: '123456' });

    expect(calls[0]).toMatchObject({ method: 'verifyOtp', phone: '+905321112267', type: 'sms' });
    expect(result.needsProfile).toBe(true);
    expect(result.user).toBeNull();
    expect(ctx.sessionUserId()).toBe('u1');
  });

  it('oturum yokken profil tamamlanamaz', async () => {
    const { repo } = make();
    await expect(
      repo.completeProfile({
        phone: '+905321112267',
        displayName: 'Ada Yolcu',
        username: 'ada.yolcu',
      }),
    ).rejects.toMatchObject({ code: 'notVerified' });
  });

  it('doğrulanan numaradan farklı numarayla profil tamamlanamaz', async () => {
    const { repo, ctx } = make({ storedPhone: '+905339998877' });
    ctx.setSessionUserId('u1');
    await expect(
      repo.completeProfile({
        phone: '+905321112267',
        displayName: 'Ada Yolcu',
        username: 'ada.yolcu',
      }),
    ).rejects.toMatchObject({ code: 'notVerified' });
  });

  it('kullanıcı adı çakışmasını (23505) ayırt eder', async () => {
    const { repo, ctx } = make({
      storedPhone: '+905321112267',
      updateError: { message: 'duplicate key value', code: '23505' },
    });
    ctx.setSessionUserId('u1');
    await expect(
      repo.completeProfile({
        phone: '+905321112267',
        displayName: 'Ada Yolcu',
        username: 'deniz.kaya',
      }),
    ).rejects.toMatchObject({ code: 'usernameTaken' });
  });

  it('kullanıcı adı denetimini RPC ile yapar; biçimsiz adı sormadan reddeder', async () => {
    const free = make({ usernameAvailable: true });
    expect(await free.repo.isUsernameAvailable('ada.yolcu')).toBe(true);

    const taken = make({ usernameAvailable: false });
    expect(await taken.repo.isUsernameAvailable('deniz.kaya')).toBe(false);

    // Postgres'e doğrudan bağlanan uyarlayıcı satır listesi döner.
    const asRows = make({ usernameAvailable: [{ is_username_available: false }] });
    expect(await asRows.repo.isUsernameAvailable('deniz.kaya')).toBe(false);

    const invalid = make({ usernameAvailable: true });
    expect(await invalid.repo.isUsernameAvailable('ab')).toBe(false);
    expect(await invalid.repo.isUsernameAvailable('admin')).toBe(false);
  });
});
