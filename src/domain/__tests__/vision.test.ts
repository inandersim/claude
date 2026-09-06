import { VISION_SITUATIONS } from '../enums';
import type { EmergencyCenter, HazardZone, VisionRequest } from '../types';
import {
  imageSizeGuard,
  localVisionAdvice,
  parseVisionResponse,
  riskFromKeywords,
  sanitizeVisionActions,
  situationPrompt,
  stripDataUrl,
  visionQuickQuestions,
  type VisionKnowledge,
} from '../vision';

const NOON = new Date('2026-09-05T12:00:00.000Z');

const hazard: HazardZone = {
  id: 'hz_test',
  type: 'rockfall',
  severity: 'high',
  status: 'active',
  title: 'Kaya düşmesi — Sivri Tepe',
  description: '',
  locationName: 'Kaçkar',
  coords: { latitude: 40.83, longitude: 41.15 },
  radiusM: 1500,
  reporterId: 'u_elif',
  confirmations: 3,
  createdAt: '2026-09-01T00:00:00.000Z',
  expiresAt: null,
  resolvedAt: null,
};

const center: EmergencyCenter = {
  id: 'ec_test',
  name: 'Ayder Sağlık Ocağı',
  type: 'hospital',
  coords: { latitude: 40.95, longitude: 41.1 },
  locationName: 'Ayder',
  phone: '+90 464 000 00 00',
  open24h: true,
  countryCode: 'TR',
};

const kb: VisionKnowledge = {
  hazards: [hazard],
  emergencyCenters: [center],
  firstAidSlugs: [
    'cpr',
    'bleeding',
    'fracture',
    'snakebite',
    'lightning',
    'altitude',
    'anaphylaxis',
  ],
  altitudeM: null,
};

const base: VisionRequest = {
  imageUri: 'file:///tmp/photo.jpg',
  imageBase64: null,
  situation: 'terrain',
  question: '',
  coords: null,
  altitudeM: null,
  locale: 'tr',
};

describe('localVisionAdvice', () => {
  it('her durum için en az 3 tavsiye ve en az 1 aksiyon üretir (tr ve en)', () => {
    for (const situation of VISION_SITUATIONS) {
      for (const locale of ['tr', 'en']) {
        const advice = localVisionAdvice({ ...base, situation, locale }, kb, NOON);
        expect(advice.situation).toBe(situation);
        expect(advice.source).toBe('local');
        expect(advice.advice.length).toBeGreaterThanOrEqual(3);
        expect(advice.actions.length).toBeGreaterThanOrEqual(1);
        expect(advice.observations.length).toBeGreaterThanOrEqual(1);
        expect(advice.confidence).toBeGreaterThanOrEqual(0.3);
        expect(advice.confidence).toBeLessThanOrEqual(0.5);
        expect(advice.actions.every((a) => a.href.startsWith('/'))).toBe(true);
        expect(advice.createdAt).toBe(NOON.toISOString());
      }
    }
  });

  it('injury → ilk yardım aksiyonu, SOS ve en yakın acil merkez gözlemi', () => {
    const advice = localVisionAdvice(
      {
        ...base,
        situation: 'injury',
        question: 'Bacakta kırık olabilir',
        coords: { latitude: 40.9, longitude: 41.12 },
      },
      kb,
      NOON,
    );
    expect(advice.actions[0]?.href).toBe('/first-aid/fracture');
    expect(advice.actions.some((a) => a.href.startsWith('/first-aid/'))).toBe(true);
    expect(advice.actions.some((a) => a.href === '/satellite/sos')).toBe(true);
    expect(advice.observations.some((o) => o.includes('Ayder Sağlık Ocağı'))).toBe(true);
    expect(advice.risk).toBe('high');
  });

  it('yakın aktif tehlike gözleme ve aksiyona eklenir, riski yükseltir', () => {
    const near = localVisionAdvice(
      { ...base, situation: 'camp', coords: { latitude: 40.835, longitude: 41.155 } },
      kb,
      NOON,
    );
    expect(near.observations.some((o) => o.includes('Kaya düşmesi — Sivri Tepe'))).toBe(true);
    expect(near.actions.some((a) => a.href === '/hazards/hz_test')).toBe(true);
    expect(near.risk).toBe('moderate'); // camp tabanı low + kritik tehlike → moderate

    const far = localVisionAdvice(
      { ...base, situation: 'camp', coords: { latitude: 38.0, longitude: 27.0 } },
      kb,
      NOON,
    );
    expect(far.actions.some((a) => a.href === '/hazards/hz_test')).toBe(false);
    expect(far.risk).toBe('low');
  });

  it('yüksek irtifa AMS aksiyonu ekler ve terrain riskini yükseltir', () => {
    const advice = localVisionAdvice({ ...base, situation: 'terrain', altitudeM: 3800 }, kb, NOON);
    expect(advice.actions.some((a) => a.href === '/destinations/ams')).toBe(true);
    expect(advice.observations.some((o) => o.includes('3800 m'))).toBe(true);
    expect(advice.risk).toBe('high'); // moderate taban + irtifa → high
    const low = localVisionAdvice({ ...base, situation: 'terrain', altitudeM: 900 }, kb, NOON);
    expect(low.actions.some((a) => a.href === '/destinations/ams')).toBe(false);
  });

  it('akşam saatlerinde kafa lambası uyarısı ekler', () => {
    const evening = new Date(NOON);
    evening.setHours(19, 0, 0, 0);
    const advice = localVisionAdvice({ ...base, situation: 'map', locale: 'en' }, kb, evening);
    expect(advice.advice.some((a) => a.toLowerCase().includes('headlamp'))).toBe(true);
    const day = new Date(NOON);
    day.setHours(11, 0, 0, 0);
    const noon = localVisionAdvice({ ...base, situation: 'map', locale: 'en' }, kb, day);
    expect(noon.advice.some((a) => a.toLowerCase().includes('headlamp'))).toBe(false);
  });

  it('soru anahtar kelimeleri riski yükseltir; plant her zaman "yemeyin" içerir', () => {
    const calm = localVisionAdvice({ ...base, situation: 'weather' }, kb, NOON);
    const storm = localVisionAdvice(
      { ...base, situation: 'weather', question: 'Yıldırım düşüyor' },
      kb,
      NOON,
    );
    expect(calm.risk).toBe('moderate');
    expect(storm.risk).toBe('extreme');
    const plant = localVisionAdvice({ ...base, situation: 'plant', locale: 'tr' }, kb, NOON);
    expect(plant.advice.some((a) => a.includes('YEMEYİN'))).toBe(true);
  });

  it('bilinmeyen durum other olarak ele alınır', () => {
    const advice = localVisionAdvice(
      { ...base, situation: 'x' as VisionRequest['situation'] },
      kb,
      NOON,
    );
    expect(advice.situation).toBe('other');
  });
});

describe('riskFromKeywords', () => {
  it('seviyeleri anahtar kelimeden çıkarır', () => {
    expect(riskFromKeywords('çığ tehlikesi var')).toBe('extreme');
    expect(riskFromKeywords('Severe bleeding on the leg')).toBe('extreme');
    expect(riskFromKeywords('kaya düşmesi olabilir')).toBe('high');
    expect(riskFromKeywords('bulutlar kararıyor')).toBe('moderate');
    expect(riskFromKeywords('güzel manzara')).toBe('low');
    expect(riskFromKeywords('')).toBe('low');
  });
});

describe('parseVisionResponse', () => {
  it('tam yanıtı çevirir', () => {
    const advice = parseVisionResponse(
      {
        observations: ['35° kar yamacı'],
        risk: 'high',
        advice: ['Tek tek geç'],
        avoid: ['Altında durma'],
        actions: [
          { label: 'Tehlike bölgeleri', href: '/hazards', icon: 'triangle-alert' },
          { label: 'Kötü', href: 'https://evil.example', icon: 'x' },
          { label: 'Kopya', href: '/hazards', icon: 'triangle-alert' },
        ],
        confidence: 0.72,
      },
      'terrain',
      NOON,
    );
    expect(advice.source).toBe('remote');
    expect(advice.situation).toBe('terrain');
    expect(advice.risk).toBe('high');
    expect(advice.actions).toEqual([
      { label: 'Tehlike bölgeleri', href: '/hazards', icon: 'triangle-alert' },
    ]);
    expect(advice.confidence).toBe(0.72);
    expect(advice.createdAt).toBe(NOON.toISOString());
  });

  it('eksik alanları tolere eder; risk metinden türetilir, confidence sıkıştırılır', () => {
    const advice = parseVisionResponse(
      { advice: ['Çığ yamacından uzak dur'], confidence: 7 },
      'camp',
      NOON,
    );
    expect(advice.observations).toEqual([]);
    expect(advice.avoid).toEqual([]);
    expect(advice.actions).toEqual([]);
    expect(advice.risk).toBe('extreme');
    expect(advice.confidence).toBe(1);
    expect(advice.situation).toBe('camp');

    const empty = parseVisionResponse(null);
    expect(empty.situation).toBe('other');
    expect(empty.risk).toBe('low');
    expect(empty.advice).toEqual([]);
    expect(typeof empty.id).toBe('string');

    const junk = parseVisionResponse({
      observations: [1, null, ' ok '],
      risk: 'kritik',
      confidence: 'x',
    });
    expect(junk.observations).toEqual(['ok']);
    expect(junk.confidence).toBe(0.6);
  });

  it('sanitizeVisionActions izinli rotaları süzer ve 6 ile sınırlar', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      label: `A${i}`,
      href: `/first-aid/slug${i}`,
      icon: 'heart-pulse',
    }));
    expect(sanitizeVisionActions(many)).toHaveLength(6);
    expect(sanitizeVisionActions([{ label: 'x', href: '/first-aidx' }])).toEqual([]);
    expect(sanitizeVisionActions([{ label: 'x', href: '/maps/planner' }])[0]?.icon).toBe(
      'arrow-up-right',
    );
    expect(sanitizeVisionActions('nope')).toEqual([]);
  });
});

describe('imageSizeGuard', () => {
  it('base64 boyutunu hesaplar ve sınırla karşılaştırır', () => {
    const small = Buffer.alloc(1024, 1).toString('base64');
    expect(imageSizeGuard(small)).toEqual({ bytes: 1024, ok: true, needsResize: false });
    const withPrefix = `data:image/png;base64,${small}`;
    expect(imageSizeGuard(withPrefix).bytes).toBe(1024);
    expect(stripDataUrl(withPrefix).mediaType).toBe('image/png');
    expect(stripDataUrl(small).mediaType).toBeNull();

    const big = 'A'.repeat(4 * 1024 * 1024 + 8); // 3 MB + birkaç bayt ham
    const guard = imageSizeGuard(big);
    expect(guard.ok).toBe(false);
    expect(guard.needsResize).toBe(true);
    expect(guard.bytes).toBeGreaterThan(3 * 1024 * 1024 - 10);

    expect(imageSizeGuard(big, 10 * 1024 * 1024).ok).toBe(true);
    expect(imageSizeGuard(null)).toEqual({ bytes: 0, ok: false, needsResize: false });
    expect(imageSizeGuard('')).toEqual({ bytes: 0, ok: false, needsResize: false });
  });
});

describe('situationPrompt / visionQuickQuestions', () => {
  it('dile göre metin üretir', () => {
    expect(situationPrompt('weather', 'tr')).toMatch(/bulut/i);
    expect(situationPrompt('weather', 'en-US')).toMatch(/cloud/i);
    for (const s of VISION_SITUATIONS) {
      expect(visionQuickQuestions(s, 'tr')).toHaveLength(3);
      expect(visionQuickQuestions(s, 'en')).toHaveLength(3);
    }
    expect(visionQuickQuestions('water', 'tr')[0]).not.toBe(visionQuickQuestions('water', 'en')[0]);
  });
});
