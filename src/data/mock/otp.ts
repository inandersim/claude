import {
  EMPTY_SEND_STATE,
  OTP_TTL_SEC,
  OtpError,
  evaluateOtpSend,
  evaluateOtpVerify,
  otpCodeFromSeed,
  resendDelaySec,
  type OtpChallengeState,
  type OtpSendState,
} from '@/domain';

/**
 * Sunucusuz geliştirme için SMS doğrulama motoru.
 *
 * Gerçek bir SMS sağlayıcısı yokken kodu **gerçekten üretir** (sabit `123456`
 * değil), konsola yazar ve ekranın gösterebilmesi için döner. Hız sınırı,
 * kod ömrü, tek kullanımlık kod ve kaba kuvvet kilidi kuralları
 * `src/domain/phone.ts` içindeki saf politikadan gelir — yani uzak sağlayıcıya
 * geçildiğinde davranış aynıdır, yalnızca kodu kim üretiyorsa o değişir.
 *
 * Durum bellekte tutulur: uygulama yeniden başlatıldığında bekleyen kod düşer.
 * Bu kasıtlıdır; kalıcı depoya doğrulama kodu yazılmaz.
 */

/** Doğrulanmış numaranın profil adımı için geçerli kalma süresi (saniye). */
export const VERIFIED_PHONE_TTL_SEC = 900;

interface PhoneRecord {
  /** Bekleyen kod; hiç istenmediyse null */
  challenge: OtpChallengeState | null;
  /** Gönderim hız sınırı durumu */
  send: OtpSendState;
  /** Kodun başarıyla doğrulandığı an (ms epoch) */
  verifiedAt: number | null;
}

export interface OtpIssueResult {
  code: string;
  /** Kodun geçerliliğini yitireceği an (ms epoch) */
  expiresAt: number;
  /** Yeniden gönder düğmesinin açılacağı an (ms epoch) */
  resendAvailableAt: number;
  attemptsRemaining: number;
}

export interface MockOtpOptions {
  /** 0–1 arası değer üreten kaynak; testlerde sabitlenebilir. */
  random?: () => number;
  /** Üretilen kodu bildirir (varsayılan: konsola yazar). */
  onIssue?: (phone: string, code: string) => void;
}

const MAX_ATTEMPTS_TOTAL = 5;

export class MockOtpService {
  private readonly records = new Map<string, PhoneRecord>();
  private readonly random: () => number;
  private readonly onIssue: (phone: string, code: string) => void;

  constructor(options: MockOtpOptions = {}) {
    this.random = options.random ?? Math.random;
    this.onIssue =
      options.onIssue ??
      ((phone, code) => {
        // Geliştirme rozeti ekranda da gösterilir; konsol kaydı ikinci kanaldır.
        console.info(`[Zirtan OTP] ${phone} → ${code} (yalnızca geliştirme)`);
      });
  }

  private record(phone: string): PhoneRecord {
    const existing = this.records.get(phone);
    if (existing) return existing;
    const fresh: PhoneRecord = { challenge: null, send: EMPTY_SEND_STATE, verifiedAt: null };
    this.records.set(phone, fresh);
    return fresh;
  }

  /**
   * Yeni kod üretir. Hız sınırına takılırsa `OtpError` fırlatır
   * (`cooldown` → bekleme, `quota` → saatlik kota).
   */
  issue(phone: string, now: number = Date.now()): OtpIssueResult {
    const record = this.record(phone);

    // Kilitli numaraya yeni kod gönderilmez; kilit bitene kadar beklenir.
    const lockedUntil = record.challenge?.lockedUntil ?? null;
    if (lockedUntil !== null && now < lockedUntil) {
      throw new OtpError('locked', { retryAfterSec: Math.ceil((lockedUntil - now) / 1000) });
    }

    const decision = evaluateOtpSend(record.send, now);
    if (!decision.allowed) {
      throw new OtpError(decision.reason, { retryAfterSec: decision.retryAfterSec });
    }

    const code = otpCodeFromSeed(this.random());
    record.send = decision.next;
    record.challenge = {
      code,
      createdAt: now,
      attempts: 0,
      consumedAt: null,
      lockedUntil: null,
    };
    record.verifiedAt = null;
    this.onIssue(phone, code);

    return {
      code,
      expiresAt: now + OTP_TTL_SEC * 1000,
      resendAvailableAt: now + decision.nextDelaySec * 1000,
      attemptsRemaining: MAX_ATTEMPTS_TOTAL,
    };
  }

  /** Bekleyen kodun kalan yanlış deneme hakkı. */
  attemptsRemaining(phone: string): number {
    const record = this.records.get(phone);
    if (!record?.challenge) return MAX_ATTEMPTS_TOTAL;
    return Math.max(0, MAX_ATTEMPTS_TOTAL - record.challenge.attempts);
  }

  /** Yeniden gönderilebilir hâle geleceği an (ms epoch). */
  resendAvailableAt(phone: string, now: number = Date.now()): number {
    const record = this.records.get(phone);
    if (!record || record.send.lastSentAt === null) return now;
    return record.send.lastSentAt + resendDelaySec(record.send.sends) * 1000;
  }

  /**
   * Kodu doğrular. Başarısızlıkta `OtpError` fırlatır; kod yanlışsa hatanın
   * `attemptsRemaining` alanı ekrana kalan hakkı taşır.
   */
  verify(phone: string, code: string, now: number = Date.now()): void {
    const record = this.record(phone);
    if (!record.challenge) throw new OtpError('noChallenge');

    const decision = evaluateOtpVerify(record.challenge, code, now, {
      maxAttempts: MAX_ATTEMPTS_TOTAL,
    });

    switch (decision.status) {
      case 'ok':
        record.challenge = decision.next;
        record.verifiedAt = now;
        return;
      case 'invalid':
        record.challenge = decision.next;
        throw new OtpError(decision.next.lockedUntil !== null ? 'locked' : 'invalidCode', {
          attemptsRemaining: decision.attemptsRemaining,
          retryAfterSec:
            decision.next.lockedUntil !== null
              ? Math.ceil((decision.next.lockedUntil - now) / 1000)
              : null,
        });
      case 'locked':
        throw new OtpError('locked', { retryAfterSec: decision.retryAfterSec });
      case 'expired':
        throw new OtpError('expired');
      case 'consumed':
        throw new OtpError('consumed');
      case 'malformed':
      default:
        throw new OtpError('malformed');
    }
  }

  /** Numara yakın zamanda doğrulandı mı (profil adımı için)? */
  isVerified(phone: string, now: number = Date.now()): boolean {
    const record = this.records.get(phone);
    if (!record?.verifiedAt) return false;
    return now - record.verifiedAt < VERIFIED_PHONE_TTL_SEC * 1000;
  }

  /** Kayıt tamamlandığında doğrulama biletini düşürür. */
  clear(phone: string): void {
    const record = this.records.get(phone);
    if (record) record.verifiedAt = null;
  }

  /** Testler için tüm durumu sıfırlar. */
  reset(): void {
    this.records.clear();
  }
}
