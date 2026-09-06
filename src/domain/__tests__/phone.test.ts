import {
  DEFAULT_COUNTRY_ISO2,
  EMPTY_SEND_STATE,
  OTP_LENGTH,
  OTP_LOCK_SEC,
  OTP_MAX_SENDS_PER_WINDOW,
  OTP_MAX_VERIFY_ATTEMPTS,
  OTP_TTL_SEC,
  PHONE_COUNTRIES,
  countryByDialCode,
  detectPhoneCountry,
  digitsOnly,
  evaluateOtpSend,
  evaluateOtpVerify,
  findCountry,
  formatE164,
  formatNational,
  formatOtpCountdown,
  formatPhoneInput,
  isValidOtpCode,
  isValidPhone,
  maskPhone,
  nationalNumber,
  normalizePhone,
  normalizeUsername,
  otpCodeFromSeed,
  otpSecondsLeft,
  resendDelaySec,
  sanitizeOtpInput,
  suggestUsernameFromPhone,
  validateDisplayName,
  validatePhone,
  validateUsername,
  type OtpChallengeState,
  type OtpSendState,
} from '@/domain';

const T0 = Date.UTC(2026, 0, 15, 10, 0, 0);
const sec = (n: number) => n * 1000;

describe('ülke listesi', () => {
  it('varsayılan ülke listede ve ilk sırada', () => {
    expect(PHONE_COUNTRIES[0]?.iso2).toBe(DEFAULT_COUNTRY_ISO2);
    expect(findCountry('tr')?.dialCode).toBe('+90');
    expect(findCountry('XX')).toBeNull();
  });

  it('arama kodundan ülke bulur', () => {
    expect(countryByDialCode('+49')?.iso2).toBe('DE');
    expect(countryByDialCode('90')?.iso2).toBe('TR');
    expect(countryByDialCode('+999')).toBeNull();
  });

  it('her ülkenin grup şeması NSN uzunluğunu karşılar', () => {
    for (const country of PHONE_COUNTRIES) {
      const groupTotal = country.groups.reduce((a, b) => a + b, 0);
      expect(groupTotal).toBeGreaterThanOrEqual(Math.min(...country.nsnLengths));
      expect(country.dialCode.startsWith('+')).toBe(true);
    }
  });
});

describe('normalizePhone', () => {
  it('Türkiye ulusal biçimlerini E.164 yapar', () => {
    expect(normalizePhone('0532 111 22 67')).toBe('+905321112267');
    expect(normalizePhone('532 111 22 67')).toBe('+905321112267');
    expect(normalizePhone('905321112267')).toBe('+905321112267');
    expect(normalizePhone('+90 532 111 22 67')).toBe('+905321112267');
    expect(normalizePhone('0090-532-111-22-67')).toBe('+905321112267');
  });

  it('ayırıcıları ve parantezleri yok sayar', () => {
    expect(normalizePhone('(0532) 111.22.67')).toBe('+905321112267');
  });

  it('uluslararası girişte varsayılan ülkeyi yok sayar', () => {
    expect(normalizePhone('+49 151 2345 6789', 'TR')).toBe('+4915123456789');
  });

  it('seçili ülkenin trunk önekini kullanır', () => {
    expect(normalizePhone('0151 2345 6789', 'DE')).toBe('+4915123456789');
    expect(normalizePhone('06 1234 5678', 'NL')).toBe('+31612345678');
  });

  it('boş girişte null döner', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
    expect(normalizePhone('+')).toBeNull();
  });

  it('bilinmeyen varsayılan ülkede null döner', () => {
    expect(normalizePhone('5321112267', 'XX')).toBeNull();
  });
});

describe('detectPhoneCountry / nationalNumber', () => {
  it('en uzun eşleşen arama kodunu seçer', () => {
    expect(detectPhoneCountry('+905321112267')?.iso2).toBe('TR');
    expect(detectPhoneCountry('+995555123456')?.iso2).toBe('GE');
    expect(detectPhoneCountry('+79123456789')?.iso2).toBe('RU');
  });

  it('bilinmeyen ülkede null döner', () => {
    expect(detectPhoneCountry('+2991234567')).toBeNull();
    expect(detectPhoneCountry('905321112267')).toBeNull();
  });

  it('ulusal kısmı ayırır', () => {
    expect(nationalNumber('+905321112267')).toBe('5321112267');
    expect(nationalNumber('+2991234567')).toBeNull();
  });
});

describe('validatePhone', () => {
  it('geçerli Türk cep numarasını kabul eder', () => {
    const result = validatePhone('0532 111 22 67');
    expect(result.valid).toBe(true);
    expect(result.e164).toBe('+905321112267');
    expect(result.country?.iso2).toBe('TR');
    expect(result.error).toBeNull();
  });

  it('eksik ve fazla haneyi ayırt eder', () => {
    expect(validatePhone('0532 111 22').error).toBe('tooShort');
    expect(validatePhone('0532 111 22 67 99').error).toBe('tooLong');
  });

  it('sabit hat önekini mobil değil diye reddeder', () => {
    const result = validatePhone('0212 111 22 67');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('notMobile');
    expect(result.country?.iso2).toBe('TR');
  });

  it('boş girişi işaretler', () => {
    expect(validatePhone('').error).toBe('empty');
  });

  it('listede olmayan ülkeyi uzunluk kuralıyla değerlendirir', () => {
    expect(validatePhone('+299 123456').valid).toBe(true);
    expect(validatePhone('+299 12').error).toBe('tooShort');
    expect(validatePhone('+2991234567890123456').error).toBe('tooLong');
  });

  it('birden çok ülkede doğru çalışır', () => {
    expect(isValidPhone('151 2345 6789', 'DE')).toBe(true);
    expect(isValidPhone('7400 123456', 'GB')).toBe(true);
    expect(isValidPhone('6 12 34 56 78', 'FR')).toBe(true);
    expect(isValidPhone('415 555 0132', 'US')).toBe(true);
    expect(isValidPhone('98765 43210', 'IN')).toBe(true);
    // Fransa'da 1 ile başlayan numara mobil değildir.
    expect(isValidPhone('1 12 34 56 78', 'FR')).toBe(false);
  });
});

describe('biçimlendirme ve maskeleme', () => {
  it('ulusal numarayı gruplar', () => {
    const tr = findCountry('TR');
    expect(formatNational('5321112267', tr)).toBe('532 111 22 67');
    expect(formatNational('53211', tr)).toBe('532 11');
    expect(formatNational('', tr)).toBe('');
  });

  it('şemadan uzun numarada artan haneyi sona ekler', () => {
    expect(formatNational('53211122679999', findCountry('TR'))).toBe('532 111 22 67 9999');
  });

  it('canlı girişte ülke yoksa ham rakamları döner', () => {
    expect(formatPhoneInput('532abc111', null)).toBe('532111');
  });

  it('E.164 numarasını okunur biçime çevirir', () => {
    expect(formatE164('+905321112267')).toBe('+90 532 111 22 67');
    expect(formatE164('+2991234567')).toBe('+2991234567');
  });

  it('numarayı maskeler ama tanınır bırakır', () => {
    expect(maskPhone('+905321112267')).toBe('+90 5•• ••• •• 67');
    expect(maskPhone('+4915123456789')).toBe('+49 1•• •••• ••89');
  });

  it('bilinmeyen ülkeyi de maskeler', () => {
    expect(maskPhone('+2991234567')).toBe('+2•••••••67');
    expect(maskPhone('')).toBe('');
  });

  it('rakam süzer', () => {
    expect(digitsOnly(' +90 (532) 111-22.67 ')).toBe('905321112267');
  });
});

describe('OTP kodu kuralları', () => {
  it('kod uzunluğu 6 hanedir', () => {
    expect(OTP_LENGTH).toBe(6);
    expect(isValidOtpCode('123456')).toBe(true);
    expect(isValidOtpCode('12345')).toBe(false);
    expect(isValidOtpCode('1234567')).toBe(false);
    expect(isValidOtpCode('12345a')).toBe(false);
    expect(isValidOtpCode('')).toBe(false);
  });

  it('girişi temizler ve kırpar', () => {
    expect(sanitizeOtpInput('12 34-56')).toBe('123456');
    expect(sanitizeOtpInput('1234567890')).toBe('123456');
    expect(sanitizeOtpInput('abc')).toBe('');
  });

  it('tohumdan 6 haneli kod üretir, baştaki sıfırları korur', () => {
    expect(otpCodeFromSeed(0)).toBe('000000');
    expect(otpCodeFromSeed(0.000123)).toBe('000123');
    expect(otpCodeFromSeed(0.999999999)).toHaveLength(6);
    expect(isValidOtpCode(otpCodeFromSeed(0.42))).toBe(true);
    expect(isValidOtpCode(otpCodeFromSeed(Number.NaN))).toBe(true);
  });

  it('kalan süreyi ve geri sayımı hesaplar', () => {
    expect(otpSecondsLeft(T0, T0)).toBe(OTP_TTL_SEC);
    expect(otpSecondsLeft(T0, T0 + sec(60))).toBe(OTP_TTL_SEC - 60);
    expect(otpSecondsLeft(T0, T0 + sec(9999))).toBe(0);
    expect(formatOtpCountdown(95)).toBe('01:35');
    expect(formatOtpCountdown(0)).toBe('00:00');
    expect(formatOtpCountdown(-5)).toBe('00:00');
  });
});

describe('hız sınırı · kod gönderimi', () => {
  it('ilk kod anında gider', () => {
    const decision = evaluateOtpSend(EMPTY_SEND_STATE, T0);
    expect(decision.allowed).toBe(true);
    if (!decision.allowed) throw new Error('beklenmedik');
    expect(decision.next.sends).toBe(1);
    expect(decision.nextDelaySec).toBe(30);
  });

  it('bekleme süresi üstel artar', () => {
    expect(resendDelaySec(0)).toBe(0);
    expect(resendDelaySec(1)).toBe(30);
    expect(resendDelaySec(2)).toBe(60);
    expect(resendDelaySec(3)).toBe(120);
    expect(resendDelaySec(4)).toBe(240);
    expect(resendDelaySec(9)).toBe(300);
  });

  it('bekleme dolmadan ikinci kodu reddeder', () => {
    const state: OtpSendState = { sends: 1, lastSentAt: T0, windowStartedAt: T0 };
    const decision = evaluateOtpSend(state, T0 + sec(10));
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error('beklenmedik');
    expect(decision.reason).toBe('cooldown');
    expect(decision.retryAfterSec).toBe(20);
  });

  it('bekleme dolunca izin verir', () => {
    const state: OtpSendState = { sends: 1, lastSentAt: T0, windowStartedAt: T0 };
    const decision = evaluateOtpSend(state, T0 + sec(30));
    expect(decision.allowed).toBe(true);
  });

  it('saatlik kota dolunca reddeder', () => {
    let state = EMPTY_SEND_STATE;
    let now = T0;
    for (let i = 0; i < OTP_MAX_SENDS_PER_WINDOW; i += 1) {
      const decision = evaluateOtpSend(state, now);
      expect(decision.allowed).toBe(true);
      if (!decision.allowed) throw new Error('beklenmedik');
      state = decision.next;
      now += sec(decision.nextDelaySec);
    }
    const blocked = evaluateOtpSend(state, now);
    expect(blocked.allowed).toBe(false);
    if (blocked.allowed) throw new Error('beklenmedik');
    expect(blocked.reason).toBe('quota');
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('pencere dolunca sayaç sıfırlanır', () => {
    const state: OtpSendState = {
      sends: OTP_MAX_SENDS_PER_WINDOW,
      lastSentAt: T0,
      windowStartedAt: T0,
    };
    const decision = evaluateOtpSend(state, T0 + sec(3601));
    expect(decision.allowed).toBe(true);
    if (!decision.allowed) throw new Error('beklenmedik');
    expect(decision.next.sends).toBe(1);
  });

  it('politika dışarıdan sıkılaştırılabilir', () => {
    const state: OtpSendState = { sends: 2, lastSentAt: T0 - sec(600), windowStartedAt: T0 - sec(600) };
    const decision = evaluateOtpSend(state, T0, { maxSends: 2 });
    expect(decision.allowed).toBe(false);
  });
});

describe('hız sınırı · kod doğrulama', () => {
  const base: OtpChallengeState = {
    code: '123456',
    createdAt: T0,
    attempts: 0,
    consumedAt: null,
    lockedUntil: null,
  };

  it('doğru kodu kabul eder ve tek kullanımlık yapar', () => {
    const decision = evaluateOtpVerify(base, '123456', T0 + sec(5));
    expect(decision.status).toBe('ok');
    if (decision.status !== 'ok') throw new Error('beklenmedik');
    expect(decision.next.consumedAt).toBe(T0 + sec(5));

    const reuse = evaluateOtpVerify(decision.next, '123456', T0 + sec(6));
    expect(reuse.status).toBe('consumed');
  });

  it('süresi dolmuş kodu reddeder', () => {
    const decision = evaluateOtpVerify(base, '123456', T0 + sec(OTP_TTL_SEC));
    expect(decision.status).toBe('expired');
  });

  it('biçimsiz kodu deneme saymadan reddeder', () => {
    const decision = evaluateOtpVerify(base, '12', T0 + sec(1));
    expect(decision.status).toBe('malformed');
  });

  it('yanlış kodda kalan hakkı bildirir', () => {
    const decision = evaluateOtpVerify(base, '000000', T0 + sec(1));
    expect(decision.status).toBe('invalid');
    if (decision.status !== 'invalid') throw new Error('beklenmedik');
    expect(decision.attemptsRemaining).toBe(OTP_MAX_VERIFY_ATTEMPTS - 1);
    expect(decision.next.attempts).toBe(1);
    expect(decision.next.lockedUntil).toBeNull();
  });

  it('hak bitince numarayı kilitler', () => {
    let state = base;
    let last = evaluateOtpVerify(state, '000000', T0 + sec(1));
    for (let i = 1; i < OTP_MAX_VERIFY_ATTEMPTS; i += 1) {
      if (last.status !== 'invalid') throw new Error('beklenmedik');
      state = last.next;
      last = evaluateOtpVerify(state, '000000', T0 + sec(1 + i));
    }
    if (last.status !== 'invalid') throw new Error('beklenmedik');
    expect(last.attemptsRemaining).toBe(0);
    expect(last.next.lockedUntil).toBe(T0 + sec(1 + OTP_MAX_VERIFY_ATTEMPTS - 1) + sec(OTP_LOCK_SEC));

    const locked = evaluateOtpVerify(last.next, '123456', T0 + sec(10));
    expect(locked.status).toBe('locked');
    if (locked.status !== 'locked') throw new Error('beklenmedik');
    expect(locked.retryAfterSec).toBeGreaterThan(0);
  });

  it('kilit bitince doğru kod yine çalışır (kod ömrü içindeyse)', () => {
    const locked: OtpChallengeState = {
      ...base,
      createdAt: T0,
      attempts: OTP_MAX_VERIFY_ATTEMPTS,
      lockedUntil: T0 + sec(30),
    };
    const decision = evaluateOtpVerify(locked, '123456', T0 + sec(31));
    // Kilit bitti ama kodun ömrü de dolmuş olabilir; burada ömür içinde.
    expect(decision.status).toBe('ok');
  });

  it('kilitliyken kodun süresi hakkında bilgi sızdırmaz', () => {
    const locked: OtpChallengeState = { ...base, lockedUntil: T0 + sec(600) };
    const decision = evaluateOtpVerify(locked, '123456', T0 + sec(OTP_TTL_SEC + 10));
    expect(decision.status).toBe('locked');
  });
});

describe('kayıt tamamlama alanları', () => {
  it('kullanıcı adını kanonikleştirir', () => {
    expect(normalizeUsername('  Deniz KAYA ')).toBe('denizkaya');
    expect(normalizeUsername('deniz.kaya_01')).toBe('deniz.kaya_01');
    expect(normalizeUsername('çğüöşi')).toBe('i');
    expect(normalizeUsername('a'.repeat(50))).toHaveLength(24);
  });

  it('kullanıcı adını doğrular', () => {
    expect(validateUsername('deniz.kaya')).toBeNull();
    expect(validateUsername('ab')).toBe('tooShort');
    expect(validateUsername('a'.repeat(25))).toBe('tooLong');
    expect(validateUsername('deniz kaya')).toBe('invalidChars');
    expect(validateUsername('.deniz')).toBe('edgePunctuation');
    expect(validateUsername('deniz.')).toBe('edgePunctuation');
    expect(validateUsername('admin')).toBe('reserved');
  });

  it('görünen adı doğrular', () => {
    expect(validateDisplayName('Deniz Kaya')).toBeNull();
    expect(validateDisplayName(' D ')).toBe('tooShort');
    expect(validateDisplayName('x'.repeat(41))).toBe('tooLong');
  });

  it('numaradan kullanıcı adı önerir', () => {
    expect(suggestUsernameFromPhone('+905321112267')).toBe('gezgin2267');
    expect(validateUsername(suggestUsernameFromPhone('+905321112267'))).toBeNull();
  });
});
