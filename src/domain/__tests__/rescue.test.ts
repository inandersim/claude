import { EMERGENCY_NUMBERS, emergencyNumber } from '../emergency';
import {
  COUNTRY_BBOXES,
  rescueCountryFlag,
  countryName,
  detectCountry,
  dialUrl,
  FALLBACK_PROFILE,
  mountainNumber,
  nearbyCountries,
  primaryNumber,
  RESCUE_COUNTRY_CODES,
  RESCUE_DIRECTORY,
  rescueProfileFor,
  rescueSummary,
} from '../rescue';

const KATHMANDU = { latitude: 27.7172, longitude: 85.324 };
const CHAMONIX = { latitude: 45.9237, longitude: 6.8694 };
const ISTANBUL = { latitude: 41.0082, longitude: 28.9784 };
const ZERMATT = { latitude: 46.0207, longitude: 7.7491 };
const PACIFIC = { latitude: 0, longitude: -150 };

describe('detectCountry', () => {
  it('Kathmandu → NP (Hindistan/Çin kutularının içinde ama küçük kutu kazanır)', () => {
    expect(detectCountry(KATHMANDU)).toBe('NP');
  });
  it('Chamonix → FR (İsviçre/İtalya Alp şeritleriyle çakışmaz)', () => {
    expect(detectCountry(CHAMONIX)).toBe('FR');
  });
  it('İstanbul → TR', () => {
    expect(detectCountry(ISTANBUL)).toBe('TR');
  });
  it('Zermatt → CH, Ankara → TR, Sydney → AU', () => {
    expect(detectCountry(ZERMATT)).toBe('CH');
    expect(detectCountry({ latitude: 39.93, longitude: 32.85 })).toBe('TR');
    expect(detectCountry({ latitude: -33.87, longitude: 151.21 })).toBe('AU');
  });
  it('okyanus → null', () => {
    expect(detectCountry(PACIFIC)).toBeNull();
  });
  it('kutular alanı küçükten büyüğe sıralı ve en az 60 ülke içerir', () => {
    const codes = new Set(COUNTRY_BBOXES.map((b) => b.code));
    expect(codes.size).toBeGreaterThanOrEqual(60);
    for (let i = 1; i < COUNTRY_BBOXES.length; i += 1) {
      const a = COUNTRY_BBOXES[i - 1]!;
      const b = COUNTRY_BBOXES[i]!;
      expect((a.maxLat - a.minLat) * (a.maxLng - a.minLng)).toBeLessThanOrEqual(
        (b.maxLat - b.minLat) * (b.maxLng - b.minLng),
      );
    }
  });
});

describe('rescueProfileFor', () => {
  it('bilinmeyen/boş kod → 112 tabanlı genel profil', () => {
    expect(rescueProfileFor(null)).toBe(FALLBACK_PROFILE);
    expect(rescueProfileFor('ZZ').emergency.general).toBe('112');
    expect(rescueProfileFor(undefined).countryCode).toBe('XX');
  });
  it('küçük harf kodu da bulur', () => {
    expect(rescueProfileFor('np').countryCode).toBe('NP');
  });
  it('dizin en az 40 ülke içerir ve her profil tutarlı', () => {
    expect(RESCUE_COUNTRY_CODES.length).toBeGreaterThanOrEqual(40);
    for (const code of RESCUE_COUNTRY_CODES) {
      const p = RESCUE_DIRECTORY[code]!;
      expect(p.countryCode).toBe(code);
      expect(p.emergency.general).toMatch(/^[+*\d][\d\s]*$/);
      expect(p.languages.length).toBeGreaterThan(0);
      expect(p.notes.length).toBeGreaterThan(0);
      for (const org of p.organizations) {
        expect(org.name.length).toBeGreaterThan(0);
        expect(org.note.tr.length).toBeGreaterThan(0);
        expect(org.note.en.length).toBeGreaterThan(0);
      }
    }
  });
  it('bilinen numaralar doğru', () => {
    expect(RESCUE_DIRECTORY.TR!.emergency.general).toBe('112');
    expect(RESCUE_DIRECTORY.NP!.emergency.tourist).toBe('1144');
    expect(RESCUE_DIRECTORY.NP!.emergency.police).toBe('100');
    expect(RESCUE_DIRECTORY.AU!.emergency.general).toBe('000');
    expect(RESCUE_DIRECTORY.CH!.emergency.mountain).toBe('1414');
    expect(RESCUE_DIRECTORY.AT!.emergency.mountain).toBe('140');
    expect(RESCUE_DIRECTORY.PL!.emergency.mountain).toBe('601 100 300');
    expect(RESCUE_DIRECTORY.NP!.helicopterRescue).toBe('insurance_required');
  });
});

describe('primaryNumber', () => {
  it('özel hat > örgüt telefonu > genel numara önceliği', () => {
    const at = rescueProfileFor('AT');
    expect(primaryNumber(at, 'mountain')).toBe('140');
    expect(primaryNumber(at, 'medical')).toBe('144');
    expect(primaryNumber(at, 'sea')).toBe('112'); // deniz hattı yok → genel
    expect(primaryNumber(at, 'general')).toBe('112');

    const pk = rescueProfileFor('PK');
    expect(primaryNumber(pk, 'medical')).toBe('1122');
    expect(primaryNumber(pk, 'mountain')).toBe('1122'); // Alpine Club telefonsuz → genel

    const za = rescueProfileFor('ZA');
    expect(primaryNumber(za, 'mountain')).toBe('+27 21 937 0300'); // yalnızca örgüt telefonu
  });
  it('mountainNumber genel numarayla aynıysa null', () => {
    expect(mountainNumber(rescueProfileFor('TR'))).toBeNull();
    expect(mountainNumber(rescueProfileFor('FR'))).toBe('+33 4 50 53 16 89');
    expect(mountainNumber(FALLBACK_PROFILE)).toBeNull();
  });
});

describe('dialUrl', () => {
  it('boşluk, tire, parantez ve noktaları temizler; + ve * korunur', () => {
    expect(dialUrl('+977 1 4440292')).toBe('tel:+97714440292');
    expect(dialUrl('04 50 53 16 89')).toBe('tel:0450531689');
    expect(dialUrl('(0212) 217-04.10')).toBe('tel:02122170410');
    expect(dialUrl('*500')).toBe('tel:*500');
    expect(dialUrl('112')).toBe('tel:112');
  });
});

describe('nearbyCountries', () => {
  it('Chamonix: CH ve IT kutu kenarlarına < 30 km', () => {
    const codes = nearbyCountries(CHAMONIX).map((n) => n.countryCode);
    expect(codes).toContain('CH');
    expect(codes).toContain('IT');
    expect(codes).not.toContain('FR');
    for (const n of nearbyCountries(CHAMONIX)) {
      expect(n.distanceKm).toBeLessThan(30);
      expect(n.profile.countryCode).toBe(n.countryCode);
    }
  });
  it('iç bölgede (Ankara) komşu yok; okyanusta boş', () => {
    expect(nearbyCountries({ latitude: 39.93, longitude: 32.85 })).toEqual([]);
    expect(nearbyCountries(PACIFIC)).toEqual([]);
  });
  it('Kathmandu: Hindistan kutusunun içinde ama kenara uzak → listelenmez', () => {
    expect(nearbyCountries(KATHMANDU).map((n) => n.countryCode)).not.toContain('IN');
  });
  it('eşik parametresi uygulanır ve en fazla 3 sonuç döner', () => {
    expect(nearbyCountries(CHAMONIX, 1)).toEqual([]);
    expect(nearbyCountries(CHAMONIX, 500).length).toBeLessThanOrEqual(3);
  });
});

describe('yardımcılar', () => {
  it('rescueSummary yalnızca farklı numaraları listeler', () => {
    expect(rescueSummary(rescueProfileFor('TR'), 'tr')).toBe('Acil 112 · Polis 155');
    expect(rescueSummary(rescueProfileFor('NP'), 'en')).toBe(
      'Emergency 102 · Police 100 · Mountain +977 1 4440292 · Tourist police 1144',
    );
  });
  it('rescueCountryFlag ve countryName', () => {
    expect(rescueCountryFlag('TR')).toBe('🇹🇷');
    expect(rescueCountryFlag('XX')).toBe('🏳️');
    expect(rescueCountryFlag(null)).toBe('🏳️');
    expect(countryName('NP', 'tr')).toBe('Nepal');
    expect(countryName('DE', 'tr')).toBe('Almanya');
    expect(countryName('DE', 'en')).toBe('Germany');
    expect(countryName(null, 'tr')).toBe('Bilinmeyen ülke');
  });
});

describe('EMERGENCY_NUMBERS dizinden türetilir', () => {
  it('mevcut çağrılar kırılmaz', () => {
    expect(emergencyNumber('TR').general).toBe('112');
    expect(emergencyNumber('US').general).toBe('911');
    expect(emergencyNumber('NP').general).toBe('102');
    expect(emergencyNumber('XX').general).toBe('112');
    expect(emergencyNumber(null).general).toBe('112');
    expect(EMERGENCY_NUMBERS.TR!.label).toBe('Acil Çağrı Merkezi (112)');
    expect(Object.keys(EMERGENCY_NUMBERS).length).toBe(RESCUE_COUNTRY_CODES.length);
  });
});
