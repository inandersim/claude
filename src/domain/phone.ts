/**
 * Telefonla kayıt / SMS doğrulama (OTP) alan mantığı.
 *
 * Bu dosyadaki her şey **saf fonksiyondur**: ağ, saat ya da rastgelelik yok.
 * "Şimdi" her zaman dışarıdan `now` (ms epoch) olarak verilir; böylece hem mock
 * sağlayıcı hem uzak sağlayıcı hem de ekranlar aynı kuralları paylaşır ve
 * kurallar testlerde birebir doğrulanabilir.
 *
 * Kapsam:
 *  · E.164 normalizasyonu ve ülke kodu tespiti
 *  · Numara doğrulama (uzunluk + mobil öneki), canlı biçimlendirme, maskeleme
 *  · OTP kodu kuralları (uzunluk, ömür, tek kullanımlık)
 *  · Hız sınırı politikası (üstel bekleme + saatlik kota + kaba kuvvet kilidi)
 *  · Kayıt tamamlama alanlarının (görünen ad, kullanıcı adı) doğrulanması
 */

/* ------------------------------------------------------------------ */
/* Ülkeler                                                             */
/* ------------------------------------------------------------------ */

export interface PhoneCountry {
  /** ISO 3166-1 alpha-2 */
  iso2: string;
  /** Uluslararası arama kodu, `+` ile: '+90' */
  dialCode: string;
  /** Türkçe ülke adı */
  name: string;
  /** Bayrak emojisi (ekranlarda ülke seçicide gösterilir) */
  flag: string;
  /** Ulusal numaranın (NSN) kabul edilen uzunlukları */
  nsnLengths: readonly number[];
  /** Mobil numaraların başlaması gereken önekler; boşsa önek kontrolü yapılmaz */
  mobilePrefixes: readonly string[];
  /** Ulusal biçimde gruplama: [3,3,2,2] → `532 111 22 67` */
  groups: readonly number[];
  /** Ulusal arama öneki (trunk prefix); Türkiye'de '0' */
  trunkPrefix?: string;
  /** Girişte gösterilen örnek (ulusal biçim) */
  example: string;
}

/**
 * Desteklenen ülkeler. Liste kapalı değildir: buraya girmeyen bir `+` numarası
 * da genel uzunluk kuralıyla (8–15 hane) kabul edilir, yalnızca mobil öneki
 * denetlenemez. Sıralama ekrandaki seçicide kullanılır (önce Türkiye).
 */
export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  {
    iso2: 'TR',
    dialCode: '+90',
    name: 'Türkiye',
    flag: '🇹🇷',
    nsnLengths: [10],
    mobilePrefixes: ['5'],
    groups: [3, 3, 2, 2],
    trunkPrefix: '0',
    example: '532 111 22 67',
  },
  {
    iso2: 'DE',
    dialCode: '+49',
    name: 'Almanya',
    flag: '🇩🇪',
    nsnLengths: [10, 11],
    mobilePrefixes: ['15', '16', '17'],
    groups: [3, 4, 4],
    trunkPrefix: '0',
    example: '151 2345 6789',
  },
  {
    iso2: 'GB',
    dialCode: '+44',
    name: 'Birleşik Krallık',
    flag: '🇬🇧',
    nsnLengths: [10],
    mobilePrefixes: ['7'],
    groups: [4, 6],
    trunkPrefix: '0',
    example: '7400 123456',
  },
  {
    iso2: 'US',
    dialCode: '+1',
    name: 'ABD',
    flag: '🇺🇸',
    nsnLengths: [10],
    mobilePrefixes: [],
    groups: [3, 3, 4],
    trunkPrefix: '1',
    example: '415 555 0132',
  },
  {
    iso2: 'FR',
    dialCode: '+33',
    name: 'Fransa',
    flag: '🇫🇷',
    nsnLengths: [9],
    mobilePrefixes: ['6', '7'],
    groups: [1, 2, 2, 2, 2],
    trunkPrefix: '0',
    example: '6 12 34 56 78',
  },
  {
    iso2: 'NL',
    dialCode: '+31',
    name: 'Hollanda',
    flag: '🇳🇱',
    nsnLengths: [9],
    mobilePrefixes: ['6'],
    groups: [1, 4, 4],
    trunkPrefix: '0',
    example: '6 1234 5678',
  },
  {
    iso2: 'AT',
    dialCode: '+43',
    name: 'Avusturya',
    flag: '🇦🇹',
    nsnLengths: [10, 11],
    mobilePrefixes: ['6'],
    groups: [3, 3, 4],
    trunkPrefix: '0',
    example: '664 123 4567',
  },
  {
    iso2: 'CH',
    dialCode: '+41',
    name: 'İsviçre',
    flag: '🇨🇭',
    nsnLengths: [9],
    mobilePrefixes: ['7'],
    groups: [2, 3, 2, 2],
    trunkPrefix: '0',
    example: '78 123 45 67',
  },
  {
    iso2: 'IT',
    dialCode: '+39',
    name: 'İtalya',
    flag: '🇮🇹',
    nsnLengths: [9, 10],
    mobilePrefixes: ['3'],
    groups: [3, 3, 4],
    example: '312 345 6789',
  },
  {
    iso2: 'ES',
    dialCode: '+34',
    name: 'İspanya',
    flag: '🇪🇸',
    nsnLengths: [9],
    mobilePrefixes: ['6', '7'],
    groups: [3, 3, 3],
    example: '612 345 678',
  },
  {
    iso2: 'GR',
    dialCode: '+30',
    name: 'Yunanistan',
    flag: '🇬🇷',
    nsnLengths: [10],
    mobilePrefixes: ['69'],
    groups: [3, 3, 4],
    example: '691 234 5678',
  },
  {
    iso2: 'BG',
    dialCode: '+359',
    name: 'Bulgaristan',
    flag: '🇧🇬',
    nsnLengths: [8, 9],
    mobilePrefixes: ['8', '9'],
    groups: [3, 3, 3],
    trunkPrefix: '0',
    example: '87 123 4567',
  },
  {
    iso2: 'GE',
    dialCode: '+995',
    name: 'Gürcistan',
    flag: '🇬🇪',
    nsnLengths: [9],
    mobilePrefixes: ['5'],
    groups: [3, 3, 3],
    example: '555 123 456',
  },
  {
    iso2: 'AZ',
    dialCode: '+994',
    name: 'Azerbaycan',
    flag: '🇦🇿',
    nsnLengths: [9],
    mobilePrefixes: ['4', '5', '6', '7'],
    groups: [2, 3, 2, 2],
    trunkPrefix: '0',
    example: '50 123 45 67',
  },
  {
    iso2: 'RU',
    dialCode: '+7',
    name: 'Rusya',
    flag: '🇷🇺',
    nsnLengths: [10],
    mobilePrefixes: ['9'],
    groups: [3, 3, 2, 2],
    trunkPrefix: '8',
    example: '912 345 67 89',
  },
  {
    iso2: 'UA',
    dialCode: '+380',
    name: 'Ukrayna',
    flag: '🇺🇦',
    nsnLengths: [9],
    mobilePrefixes: ['3', '5', '6', '9'],
    groups: [2, 3, 2, 2],
    trunkPrefix: '0',
    example: '67 123 45 67',
  },
  {
    iso2: 'PL',
    dialCode: '+48',
    name: 'Polonya',
    flag: '🇵🇱',
    nsnLengths: [9],
    mobilePrefixes: ['4', '5', '6', '7', '8'],
    groups: [3, 3, 3],
    example: '512 345 678',
  },
  {
    iso2: 'SE',
    dialCode: '+46',
    name: 'İsveç',
    flag: '🇸🇪',
    nsnLengths: [9],
    mobilePrefixes: ['7'],
    groups: [2, 3, 2, 2],
    trunkPrefix: '0',
    example: '70 123 45 67',
  },
  {
    iso2: 'NO',
    dialCode: '+47',
    name: 'Norveç',
    flag: '🇳🇴',
    nsnLengths: [8],
    mobilePrefixes: ['4', '9'],
    groups: [3, 2, 3],
    example: '406 12 345',
  },
  {
    iso2: 'AE',
    dialCode: '+971',
    name: 'BAE',
    flag: '🇦🇪',
    nsnLengths: [9],
    mobilePrefixes: ['5'],
    groups: [2, 3, 4],
    trunkPrefix: '0',
    example: '50 123 4567',
  },
  {
    iso2: 'SA',
    dialCode: '+966',
    name: 'Suudi Arabistan',
    flag: '🇸🇦',
    nsnLengths: [9],
    mobilePrefixes: ['5'],
    groups: [2, 3, 4],
    trunkPrefix: '0',
    example: '51 234 5678',
  },
  {
    iso2: 'IN',
    dialCode: '+91',
    name: 'Hindistan',
    flag: '🇮🇳',
    nsnLengths: [10],
    mobilePrefixes: ['6', '7', '8', '9'],
    groups: [5, 5],
    trunkPrefix: '0',
    example: '98765 43210',
  },
  {
    iso2: 'NP',
    dialCode: '+977',
    name: 'Nepal',
    flag: '🇳🇵',
    nsnLengths: [10],
    mobilePrefixes: ['97', '98'],
    groups: [3, 3, 4],
    trunkPrefix: '0',
    example: '981 234 5678',
  },
  {
    iso2: 'JP',
    dialCode: '+81',
    name: 'Japonya',
    flag: '🇯🇵',
    nsnLengths: [10],
    mobilePrefixes: ['7', '8', '9'],
    groups: [2, 4, 4],
    trunkPrefix: '0',
    example: '90 1234 5678',
  },
] as const;

/** Varsayılan ülke: uygulamanın ana pazarı. */
export const DEFAULT_COUNTRY_ISO2 = 'TR';

/** E.164 üst sınırı (ITU-T): ülke kodu dâhil en fazla 15 hane. */
export const E164_MAX_DIGITS = 15;
/** Ülke kodu dâhil makul alt sınır. */
export const E164_MIN_DIGITS = 8;

export function findCountry(iso2: string): PhoneCountry | null {
  const key = iso2.trim().toUpperCase();
  return PHONE_COUNTRIES.find((c) => c.iso2 === key) ?? null;
}

/** Ülkeyi arama kodundan bulur; `+1` gibi paylaşılan kodlarda listedeki ilk ülke. */
export function countryByDialCode(dialCode: string): PhoneCountry | null {
  const key = dialCode.startsWith('+') ? dialCode : `+${dialCode}`;
  return PHONE_COUNTRIES.find((c) => c.dialCode === key) ?? null;
}

/** Yalnızca rakamları bırakır (boşluk, tire, parantez, nokta atılır). */
export function digitsOnly(input: string): string {
  return input.replace(/\D+/g, '');
}

/**
 * Girilen metnin **rakam gövdesini** çıkarır ve `00` önekini `+`'a çevirir.
 * Dönen değer ya `+` ile başlar ya da yalnızca rakamlardan oluşur.
 */
function canonicalize(input: string): string {
  const trimmed = input.trim();
  const plus = trimmed.startsWith('+') || trimmed.startsWith('00');
  const digits = digitsOnly(trimmed.startsWith('00') ? trimmed.slice(2) : trimmed);
  return plus ? `+${digits}` : digits;
}

/** E.164 numarasından ülkeyi bulur (en uzun eşleşen arama kodu kazanır). */
export function detectPhoneCountry(e164: string): PhoneCountry | null {
  if (!e164.startsWith('+')) return null;
  let best: PhoneCountry | null = null;
  for (const country of PHONE_COUNTRIES) {
    if (!e164.startsWith(country.dialCode)) continue;
    if (!best || country.dialCode.length > best.dialCode.length) best = country;
  }
  return best;
}

/** E.164 numarasının ulusal kısmı (NSN); ülke bilinmiyorsa `null`. */
export function nationalNumber(e164: string): string | null {
  const country = detectPhoneCountry(e164);
  if (!country) return null;
  return e164.slice(country.dialCode.length);
}

/**
 * Serbest girişi E.164'e çevirir.
 *
 * · `+`/`00` ile başlıyorsa uluslararası kabul edilir, `defaultIso2` yok sayılır.
 * · Aksi hâlde `defaultIso2` ülkesinin ulusal numarası varsayılır; varsa trunk
 *   öneki (`0`, `8`, `1`) atılır, ülke kodu eklenir.
 * · Kullanıcı ülke kodunu `+` olmadan yazmışsa (`905321112267`) ve kalan uzunluk
 *   o ülkenin NSN uzunluğuna uyuyorsa ülke kodu olarak yorumlanır.
 *
 * Biçimsel olarak E.164'e çevrilemiyorsa `null` döner (doğrulama ayrı adımdır).
 */
export function normalizePhone(input: string, defaultIso2: string = DEFAULT_COUNTRY_ISO2): string | null {
  const canonical = canonicalize(input);
  if (!canonical) return null;

  if (canonical.startsWith('+')) {
    const digits = canonical.slice(1);
    if (!digits) return null;
    return `+${digits}`;
  }

  const country = findCountry(defaultIso2);
  if (!country) return null;

  let nsn = canonical;
  const dialDigits = country.dialCode.slice(1);

  // '905321112267' → ülke kodu yazılmış.
  if (nsn.startsWith(dialDigits) && country.nsnLengths.includes(nsn.length - dialDigits.length)) {
    nsn = nsn.slice(dialDigits.length);
  } else if (country.trunkPrefix && nsn.startsWith(country.trunkPrefix)) {
    const withoutTrunk = nsn.slice(country.trunkPrefix.length);
    // Trunk önekini yalnızca kalan uzunluk anlamlıysa at (ör. TR '0532…').
    if (country.nsnLengths.includes(withoutTrunk.length)) nsn = withoutTrunk;
  }

  if (!nsn) return null;
  return `${country.dialCode}${nsn}`;
}

export type PhoneErrorCode =
  | 'empty'
  | 'tooShort'
  | 'tooLong'
  | 'notMobile'
  | 'unknownCountry';

export interface PhoneValidation {
  valid: boolean;
  /** Geçerliyse E.164 numara, değilse `null` */
  e164: string | null;
  /** Tanınan ülke (listede yoksa `null` — numara yine geçerli olabilir) */
  country: PhoneCountry | null;
  error: PhoneErrorCode | null;
}

/**
 * Numarayı normalize edip doğrular.
 *
 * Bilinen bir ülkeyse NSN uzunluğu ve mobil öneki denetlenir; bilinmeyen ülke
 * kodlarında yalnızca E.164 uzunluk aralığı (8–15 hane) uygulanır.
 */
export function validatePhone(
  input: string,
  defaultIso2: string = DEFAULT_COUNTRY_ISO2,
): PhoneValidation {
  if (!input.trim()) return { valid: false, e164: null, country: null, error: 'empty' };

  const e164 = normalizePhone(input, defaultIso2);
  if (!e164) return { valid: false, e164: null, country: null, error: 'empty' };

  const digits = e164.slice(1);
  const country = detectPhoneCountry(e164);

  if (!country) {
    if (digits.length < E164_MIN_DIGITS) {
      return { valid: false, e164: null, country: null, error: 'tooShort' };
    }
    if (digits.length > E164_MAX_DIGITS) {
      return { valid: false, e164: null, country: null, error: 'tooLong' };
    }
    // Ülke listede yok ama biçim E.164'e uygun: kabul edilir.
    return { valid: true, e164, country: null, error: null };
  }

  const nsn = digits.slice(country.dialCode.length - 1);
  const min = Math.min(...country.nsnLengths);
  const max = Math.max(...country.nsnLengths);

  if (nsn.length < min) return { valid: false, e164: null, country, error: 'tooShort' };
  if (nsn.length > max) return { valid: false, e164: null, country, error: 'tooLong' };
  if (!country.nsnLengths.includes(nsn.length)) {
    return { valid: false, e164: null, country, error: nsn.length < max ? 'tooShort' : 'tooLong' };
  }
  if (
    country.mobilePrefixes.length > 0 &&
    !country.mobilePrefixes.some((p) => nsn.startsWith(p))
  ) {
    return { valid: false, e164: null, country, error: 'notMobile' };
  }
  if (digits.length > E164_MAX_DIGITS) {
    return { valid: false, e164: null, country, error: 'tooLong' };
  }

  return { valid: true, e164, country, error: null };
}

/** Kısayol: numara geçerli mi? */
export function isValidPhone(input: string, defaultIso2: string = DEFAULT_COUNTRY_ISO2): boolean {
  return validatePhone(input, defaultIso2).valid;
}

/**
 * Ulusal numarayı ülkenin grup şemasına göre boşluklar. Kullanıcı yazarken
 * çağrılır; eksik numarada da bozulmadan çalışır (`532 11` gibi).
 */
export function formatNational(nsn: string, country: PhoneCountry | null): string {
  const digits = digitsOnly(nsn);
  if (!country || !digits) return digits;
  const parts: string[] = [];
  let index = 0;
  for (const size of country.groups) {
    if (index >= digits.length) break;
    parts.push(digits.slice(index, index + size));
    index += size;
  }
  if (index < digits.length) parts.push(digits.slice(index));
  return parts.join(' ');
}

/** Kullanıcı girişini canlı biçimlendirir (yalnızca ulusal kısım). */
export function formatPhoneInput(raw: string, country: PhoneCountry | null): string {
  return formatNational(raw, country);
}

/** E.164 numarasını okunur biçime çevirir: `+90 532 111 22 67`. */
export function formatE164(e164: string): string {
  const country = detectPhoneCountry(e164);
  if (!country) return e164;
  const nsn = e164.slice(country.dialCode.length);
  return `${country.dialCode} ${formatNational(nsn, country)}`.trim();
}

/** Maskeleme karakteri (dolu nokta; tipografik olarak `*`'tan okunaklı). */
const MASK_CHAR = '•';

/**
 * Numarayı gizler ama tanınabilir bırakır: `+90 5•• ••• •• 67`.
 *
 * İlk hane ve son iki hane açık kalır; aradaki rakamlar maskelenir. Gruplama
 * ülke şemasını korur, bilinmeyen ülkelerde ham dizi maskelenir.
 */
export function maskPhone(e164: string): string {
  const country = detectPhoneCountry(e164);
  const digits = e164.startsWith('+') ? e164.slice(1) : digitsOnly(e164);
  if (!digits) return '';

  const nsn = country ? digits.slice(country.dialCode.length - 1) : digits;
  const keepTail = Math.min(2, Math.max(0, nsn.length - 1));
  const masked = nsn
    .split('')
    .map((ch, i) => (i === 0 || i >= nsn.length - keepTail ? ch : MASK_CHAR))
    .join('');

  if (!country) return `+${masked}`;

  // Gruplamayı korumak için maskelenmiş diziyi ülke şemasına böl.
  const parts: string[] = [];
  let index = 0;
  for (const size of country.groups) {
    if (index >= masked.length) break;
    parts.push(masked.slice(index, index + size));
    index += size;
  }
  if (index < masked.length) parts.push(masked.slice(index));
  return `${country.dialCode} ${parts.join(' ')}`.trim();
}

/* ------------------------------------------------------------------ */
/* OTP kodu                                                            */
/* ------------------------------------------------------------------ */

/** Doğrulama kodu hane sayısı. */
export const OTP_LENGTH = 6;
/** Kod ömrü (saniye) — 3 dakika. */
export const OTP_TTL_SEC = 180;
/** Bir kod için izin verilen yanlış deneme sayısı. */
export const OTP_MAX_VERIFY_ATTEMPTS = 5;
/** Deneme hakkı bitince numara bu kadar saniye kilitlenir (15 dk). */
export const OTP_LOCK_SEC = 900;
/** Hız sınırı penceresi (saniye) — 1 saat. */
export const OTP_SEND_WINDOW_SEC = 3600;
/** Pencere başına gönderilebilecek en fazla kod. */
export const OTP_MAX_SENDS_PER_WINDOW = 5;
/**
 * Yeniden gönderme bekleme süreleri (saniye), üstel artış.
 * 1. gönderim anında; sonrakiler sırasıyla 30s, 60s, 120s, 240s ve sonrası 300s.
 */
export const OTP_RESEND_DELAYS_SEC: readonly number[] = [30, 60, 120, 240, 300];

/** Girişten yalnızca rakamları alır ve kod uzunluğuna kırpar. */
export function sanitizeOtpInput(raw: string): string {
  return digitsOnly(raw).slice(0, OTP_LENGTH);
}

/** Kod tam olarak `OTP_LENGTH` haneli rakam mı? */
export function isValidOtpCode(code: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code);
}

/**
 * `sends` kadar kod gönderilmişken bir sonraki gönderim için beklenmesi
 * gereken süre. `sends = 0` → 0 (ilk kod anında gider).
 */
export function resendDelaySec(sends: number): number {
  if (sends <= 0) return 0;
  const index = Math.min(sends - 1, OTP_RESEND_DELAYS_SEC.length - 1);
  return OTP_RESEND_DELAYS_SEC[index] ?? 0;
}

/**
 * Rastgele olmayan, saf kod üretici: verilen 0–1 arası değerden kod türetir.
 * Rastgeleliği çağıran sağlar (mock sağlayıcıda `Math.random`), böylece bu
 * fonksiyon test edilebilir kalır. Baştaki sıfırlar korunur.
 */
export function otpCodeFromSeed(seed: number): string {
  const max = 10 ** OTP_LENGTH;
  const clamped = Number.isFinite(seed) ? Math.min(Math.max(seed, 0), 0.999_999_999) : 0;
  return String(Math.floor(clamped * max)).padStart(OTP_LENGTH, '0');
}

/* ------------------------------------------------------------------ */
/* Hız sınırı politikası                                               */
/* ------------------------------------------------------------------ */

/** Bir numara (ya da IP) için kod gönderim geçmişi. */
export interface OtpSendState {
  /** İçinde bulunulan pencerede gönderilen kod sayısı */
  sends: number;
  /** Son gönderim anı (ms epoch); hiç gönderilmediyse `null` */
  lastSentAt: number | null;
  /** Pencerenin başladığı an (ms epoch); hiç gönderilmediyse `null` */
  windowStartedAt: number | null;
}

export const EMPTY_SEND_STATE: OtpSendState = {
  sends: 0,
  lastSentAt: null,
  windowStartedAt: null,
};

export type OtpSendDecision =
  | {
      allowed: true;
      /** Bu gönderimden sonraki durum (sağlayıcı doğrudan saklar) */
      next: OtpSendState;
      /** Bu gönderimden sonra yeniden göndermek için beklenecek süre */
      nextDelaySec: number;
    }
  | {
      allowed: false;
      reason: 'cooldown' | 'quota';
      /** Kaç saniye sonra tekrar denenebilir */
      retryAfterSec: number;
    };

/**
 * Kod gönderim isteğini politikaya göre değerlendirir.
 *
 * İki kural birlikte uygulanır:
 *  1. **Bekleme (cooldown)**: ardışık gönderimler arası süre üstel artar
 *     (30s → 60s → 120s → 240s → 300s). Numara sıralama saldırısını yavaşlatır.
 *  2. **Kota**: 1 saatlik pencerede en fazla 5 kod. Pencere ilk gönderimle
 *     başlar ve dolduğunda sayaç sıfırlanır.
 */
export function evaluateOtpSend(
  state: OtpSendState,
  now: number,
  policy: { windowSec?: number; maxSends?: number } = {},
): OtpSendDecision {
  const windowSec = policy.windowSec ?? OTP_SEND_WINDOW_SEC;
  const maxSends = policy.maxSends ?? OTP_MAX_SENDS_PER_WINDOW;

  // Pencere dolduysa sayaçlar sıfırlanır.
  const windowExpired =
    state.windowStartedAt === null || now - state.windowStartedAt >= windowSec * 1000;
  const sends = windowExpired ? 0 : state.sends;
  const windowStartedAt = windowExpired ? now : state.windowStartedAt;

  if (!windowExpired && state.lastSentAt !== null) {
    const waitSec = resendDelaySec(sends);
    const elapsedSec = (now - state.lastSentAt) / 1000;
    if (elapsedSec < waitSec) {
      return {
        allowed: false,
        reason: 'cooldown',
        retryAfterSec: Math.ceil(waitSec - elapsedSec),
      };
    }
  }

  if (sends >= maxSends) {
    const resetAt = (windowStartedAt ?? now) + windowSec * 1000;
    return {
      allowed: false,
      reason: 'quota',
      retryAfterSec: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    };
  }

  const nextSends = sends + 1;
  return {
    allowed: true,
    next: { sends: nextSends, lastSentAt: now, windowStartedAt: windowStartedAt ?? now },
    nextDelaySec: resendDelaySec(nextSends),
  };
}

/** Bekleyen bir doğrulama isteğinin durumu. */
export interface OtpChallengeState {
  /** Beklenen kod */
  code: string;
  /** Kodun üretildiği an (ms epoch) */
  createdAt: number;
  /** Yapılmış yanlış deneme sayısı */
  attempts: number;
  /** Kod kullanıldıysa kullanım anı (tek kullanımlık kural) */
  consumedAt: number | null;
  /** Kaba kuvvet kilidi bitiş anı (ms epoch) */
  lockedUntil: number | null;
}

export type OtpVerifyDecision =
  | { status: 'ok'; next: OtpChallengeState }
  | { status: 'expired' }
  | { status: 'consumed' }
  | { status: 'malformed' }
  | { status: 'locked'; retryAfterSec: number }
  | { status: 'invalid'; attemptsRemaining: number; next: OtpChallengeState };

/**
 * Girilen kodu değerlendirir. Sıra önemlidir: önce kilit, sonra tek kullanımlık,
 * sonra ömür, sonra biçim, en sonda eşitlik. Böylece kilitli bir numarada
 * saldırgan kodun süresi hakkında bilgi edinemez.
 *
 * Yanlış denemede sayaç artar; hak bitince numara `OTP_LOCK_SEC` kadar kilitlenir.
 * Doğru kod tek kullanımlıktır: `consumedAt` işaretlenir, tekrar kullanılamaz.
 */
export function evaluateOtpVerify(
  state: OtpChallengeState,
  input: string,
  now: number,
  policy: { ttlSec?: number; maxAttempts?: number; lockSec?: number } = {},
): OtpVerifyDecision {
  const ttlSec = policy.ttlSec ?? OTP_TTL_SEC;
  const maxAttempts = policy.maxAttempts ?? OTP_MAX_VERIFY_ATTEMPTS;
  const lockSec = policy.lockSec ?? OTP_LOCK_SEC;

  if (state.lockedUntil !== null && now < state.lockedUntil) {
    return { status: 'locked', retryAfterSec: Math.ceil((state.lockedUntil - now) / 1000) };
  }
  if (state.consumedAt !== null) return { status: 'consumed' };
  if (now - state.createdAt >= ttlSec * 1000) return { status: 'expired' };
  if (!isValidOtpCode(input)) return { status: 'malformed' };

  if (input === state.code) {
    return { status: 'ok', next: { ...state, consumedAt: now, lockedUntil: null } };
  }

  const attempts = state.attempts + 1;
  const remaining = Math.max(0, maxAttempts - attempts);
  return {
    status: 'invalid',
    attemptsRemaining: remaining,
    next: {
      ...state,
      attempts,
      lockedUntil: remaining === 0 ? now + lockSec * 1000 : state.lockedUntil,
    },
  };
}

/** Kodun bitmesine kalan saniye (bitmişse 0). */
export function otpSecondsLeft(createdAt: number, now: number, ttlSec = OTP_TTL_SEC): number {
  return Math.max(0, Math.ceil((createdAt + ttlSec * 1000 - now) / 1000));
}

/** `95` → `01:35`; geri sayım göstergelerinde kullanılır. */
export function formatOtpCountdown(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/* Kayıt tamamlama alanları                                            */
/* ------------------------------------------------------------------ */

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 24;
export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 40;

/** Sistem yollarıyla çakışan, kullanıcıya verilemeyecek adlar. */
const RESERVED_USERNAMES = new Set([
  'admin',
  'zirtan',
  'root',
  'support',
  'destek',
  'api',
  'settings',
  'ayarlar',
  'me',
  'ben',
  'null',
  'undefined',
]);

/** Kullanıcı adını kanonik biçime getirir: küçük harf, yalnızca `[a-z0-9._]`. */
export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, USERNAME_MAX_LENGTH);
}

export type UsernameErrorCode =
  | 'tooShort'
  | 'tooLong'
  | 'invalidChars'
  | 'edgePunctuation'
  | 'reserved';

/** Kullanıcı adını doğrular; sorun yoksa `null`. */
export function validateUsername(raw: string): UsernameErrorCode | null {
  const value = raw.trim().toLowerCase();
  if (value.length < USERNAME_MIN_LENGTH) return 'tooShort';
  if (value.length > USERNAME_MAX_LENGTH) return 'tooLong';
  if (!/^[a-z0-9._]+$/.test(value)) return 'invalidChars';
  if (/^[._]/.test(value) || /[._]$/.test(value)) return 'edgePunctuation';
  if (RESERVED_USERNAMES.has(value)) return 'reserved';
  return null;
}

export type DisplayNameErrorCode = 'tooShort' | 'tooLong';

/** Görünen adı doğrular; sorun yoksa `null`. */
export function validateDisplayName(raw: string): DisplayNameErrorCode | null {
  const value = raw.trim();
  if (value.length < DISPLAY_NAME_MIN_LENGTH) return 'tooShort';
  if (value.length > DISPLAY_NAME_MAX_LENGTH) return 'tooLong';
  return null;
}

/** Telefon numarasından kullanıcı adı önerisi: `gezgin1267` gibi. */
export function suggestUsernameFromPhone(e164: string): string {
  const digits = digitsOnly(e164);
  return `gezgin${digits.slice(-4)}`;
}

/* ------------------------------------------------------------------ */
/* Hata sözleşmesi                                                     */
/* ------------------------------------------------------------------ */

/**
 * Telefon/OTP akışının ekranlara taşınan hata kodları.
 * Metinler i18n'den geldiği için hata **kod** taşır, cümle taşımaz.
 */
export type OtpErrorCode =
  /** Numara E.164'e çevrilemedi ya da ülke kuralına uymuyor */
  | 'invalidPhone'
  /** Ardışık gönderim beklemesi dolmadı */
  | 'cooldown'
  /** Saatlik kota doldu */
  | 'quota'
  /** Kodun ömrü doldu */
  | 'expired'
  /** Kod zaten kullanıldı (tek kullanımlık) */
  | 'consumed'
  /** Kod 6 haneli rakam değil */
  | 'malformed'
  /** Çok fazla yanlış deneme; numara kilitli */
  | 'locked'
  /** Kod yanlış */
  | 'invalidCode'
  /** Bekleyen bir doğrulama isteği yok */
  | 'noChallenge'
  /** Kullanıcı adı başkasında */
  | 'usernameTaken'
  /** Profil adımı doğrulanmamış numarayla çağrıldı */
  | 'notVerified';

export class OtpError extends Error {
  readonly code: OtpErrorCode;
  /** Tekrar denemek için beklenecek saniye (varsa) */
  readonly retryAfterSec: number | null;
  /** Kalan yanlış deneme hakkı (varsa) */
  readonly attemptsRemaining: number | null;

  constructor(
    code: OtpErrorCode,
    options: { retryAfterSec?: number | null; attemptsRemaining?: number | null } = {},
  ) {
    super(`OTP hatası: ${code}`);
    this.name = 'OtpError';
    this.code = code;
    this.retryAfterSec = options.retryAfterSec ?? null;
    this.attemptsRemaining = options.attemptsRemaining ?? null;
  }
}

/** Bilinmeyen bir hatayı `OtpError` olarak yorumlamaya çalışır. */
export function asOtpError(error: unknown): OtpError | null {
  return error instanceof OtpError ? error : null;
}
