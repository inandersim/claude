import {
  OTP_TTL_SEC,
  OtpError,
  EMPTY_SEND_STATE,
  evaluateOtpSend,
  isValidOtpCode,
  normalizeUsername,
  validateDisplayName,
  validatePhone,
  validateUsername,
  type OtpSendState,
} from '@/domain';

import type { PhoneAuthRepository } from '../../repositories';
import { AuthError, fetchUser, requireUser, type RemoteContext } from '../context';
import { maybeRow, type PostgrestError, type Row } from '../postgrest';

/**
 * Telefon + SMS doğrulama (OTP) — Supabase Auth uygulaması.
 *
 * Supabase Auth telefon OTP'sini doğrudan destekler:
 *  · `auth.signInWithOtp({ phone })` → yapılandırılmış SMS sağlayıcısı üzerinden kod
 *  · `auth.verifyOtp({ phone, token, type: 'sms' })` → kodu doğrular, oturum açar
 *
 * Kod **hiçbir zaman istemciye dönmez**; `devCode` bu sağlayıcıda her zaman
 * `null`'dır (kodu ekranda gösteren tek yer mock sağlayıcıdır).
 *
 * Hız sınırının **asıl** uygulayıcısı sunucudur (GoTrue `sms_*` ayarları ve
 * `supabase/migrations/0035_phone_auth.sql` içindeki `otp_attempts` tablosu).
 * Buradaki istemci tarafı sayaç yalnızca geri sayımı doğru çizmek ve gereksiz
 * isteği baştan kesmek içindir; güvenlik sınırı olarak sayılmaz.
 *
 * Not: e-posta/şifre uygulaması `repos/core.ts` içindedir; sağlayıcı iki
 * yüzeyi `provider.ts` içinde birleştirir (`AuthApi`).
 */
export function createPhoneAuthRepository(ctx: RemoteContext): PhoneAuthRepository {
  const { db } = ctx;
  /** Numara başına istemci tarafı gönderim sayacı (geri sayım için). */
  const sendState = new Map<string, OtpSendState>();

  const normalized = (phone: string): string => {
    const check = validatePhone(phone);
    if (!check.valid || !check.e164) throw new OtpError('invalidPhone');
    return check.e164;
  };

  return {
    async requestOtp({ phone, locale }) {
      const e164 = normalized(phone);
      const now = Date.now();

      const decision = evaluateOtpSend(sendState.get(e164) ?? EMPTY_SEND_STATE, now);
      if (!decision.allowed) {
        throw new OtpError(decision.reason, { retryAfterSec: decision.retryAfterSec });
      }

      const result = await db.auth.signInWithOtp({
        phone: e164,
        options: {
          // Numara ilk kez görülüyorsa auth kullanıcısı açılır; profil
          // `handle_new_auth_user` tetikleyicisiyle gelir, adlar
          // `completeProfile` adımında yazılır.
          shouldCreateUser: true,
          channel: 'sms',
          data: locale ? { locale } : undefined,
        },
      });
      if (result.error) throw mapAuthError(result.error);

      sendState.set(e164, decision.next);

      return {
        phone: e164,
        expiresAt: new Date(now + OTP_TTL_SEC * 1000).toISOString(),
        resendAvailableAt: new Date(now + decision.nextDelaySec * 1000).toISOString(),
        attemptsRemaining: 5,
        // Gerçek SMS gider; kod istemciye asla dönmez.
        devCode: null,
      };
    },

    async verifyOtp({ phone, code }) {
      const e164 = normalized(phone);
      if (!isValidOtpCode(code)) throw new OtpError('malformed');

      const result = await db.auth.verifyOtp({ phone: e164, token: code, type: 'sms' });
      if (result.error) throw mapAuthError(result.error);

      const id = result.data?.user?.id;
      if (!id) throw new OtpError('invalidCode');
      ctx.setSessionUserId(id);
      sendState.delete(e164);

      const row = await maybeRow(
        db.from('profiles').select('id, profile_completed').eq('id', id),
        'profil okunamadı',
      );
      // Profil satırı henüz yoksa (tetikleyici gecikmesi) kayıt tamamlanmamıştır.
      const completed = Boolean(row?.profile_completed);
      if (!completed) return { user: null, needsProfile: true, phone: e164 };

      return { user: await requireUser(db, id), needsProfile: false, phone: e164 };
    },

    async completeProfile({ phone, displayName, username, locale }) {
      const e164 = normalized(phone);
      const id = ctx.sessionUserId();
      // Profil adımı yalnızca kodu az önce doğrulamış oturumla çalışır.
      if (!id) throw new OtpError('notVerified');

      if (validateDisplayName(displayName)) throw new AuthError('Görünen ad geçersiz.');
      const handle = normalizeUsername(username);
      if (validateUsername(handle)) throw new AuthError('Kullanıcı adı geçersiz.');

      // Oturumun doğruladığı numara ile ekrandaki numara aynı mı? (Tetikleyici
      // `user_phones` satırını doğrulama anında yazar; RLS'te yalnızca sahibi okur.)
      const phoneRow = await maybeRow(
        db.from('user_phones').select('phone').eq('user_id', id),
        'numara okunamadı',
      );
      if (phoneRow && String(phoneRow.phone) !== e164) throw new OtpError('notVerified');

      // Numara `user_phones` tablosuna tetikleyiciyle yazılır (0035); burada
      // yalnızca kullanıcının verdiği adlar ve "kayıt tamam" bayrağı güncellenir.
      const patch: Row = {
        username: handle,
        display_name: displayName.trim(),
        profile_completed: true,
      };
      if (locale) patch.locale = locale;

      const result = await db.from('profiles').update(patch).eq('id', id).select('id');
      if (result.error) {
        // 23505 = benzersizlik ihlali (profiles_username_key).
        if (result.error.code === '23505') throw new OtpError('usernameTaken');
        throw new AuthError(result.error.message);
      }

      const user = await fetchUser(db, id);
      if (!user) throw new AuthError('Profil oluşturulamadı.');
      return user;
    },

    async isUsernameAvailable(username) {
      const handle = normalizeUsername(username);
      if (validateUsername(handle)) return false;

      // RPC `SECURITY DEFINER`'dır: aday ad, profil okuma yetkisi gerekmeden
      // denetlenir (bkz. 0035_phone_auth.sql).
      const result = await db.rpc('is_username_available', { candidate: handle });
      if (result.error) throw new AuthError(result.error.message);

      // PostgREST skaler `boolean` döner; Postgres'e doğrudan bağlanan test
      // uyarlayıcısı ise tek sütunlu satır listesi döner. İkisi de karşılanır.
      const payload: unknown = result.data;
      if (typeof payload === 'boolean') return payload;
      if (Array.isArray(payload)) {
        const first: unknown = payload[0];
        if (typeof first === 'boolean') return first;
        if (first && typeof first === 'object') {
          const value = (first as Row).is_username_available;
          if (typeof value === 'boolean') return value;
        }
      }
      // Beklenmedik biçim: son söz sunucudaki tekil indekstedir, ekranı kilitleme.
      return true;
    },
  };
}

/**
 * GoTrue hatalarını ekranın anladığı `OtpError` koduna çevirir.
 * Supabase sürümleri arasında `code` alanı her zaman dolu olmadığı için
 * ileti içeriğine de bakılır.
 */
function mapAuthError(error: PostgrestError): OtpError {
  const code = (error.code ?? '').toLowerCase();
  const message = error.message.toLowerCase();

  if (code === 'over_sms_send_rate_limit' || message.includes('rate limit')) {
    return new OtpError('quota', { retryAfterSec: retryAfterFrom(message) });
  }
  if (code === 'over_request_rate_limit' || message.includes('only request this after')) {
    return new OtpError('cooldown', { retryAfterSec: retryAfterFrom(message) });
  }
  if (code === 'otp_expired' || message.includes('expired')) return new OtpError('expired');
  if (code === 'otp_disabled') return new OtpError('invalidPhone');
  if (message.includes('invalid') && message.includes('phone')) {
    return new OtpError('invalidPhone');
  }
  if (code === 'invalid_credentials' || message.includes('token') || message.includes('invalid')) {
    return new OtpError('invalidCode');
  }
  return new OtpError('invalidCode');
}

/** `... after 34 seconds` gibi iletilerden bekleme süresini çıkarır. */
function retryAfterFrom(message: string): number | null {
  const match = /(\d+)\s*second/.exec(message);
  return match?.[1] ? Number(match[1]) : null;
}
