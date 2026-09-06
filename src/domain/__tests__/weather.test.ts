import {
  alertLabelKey,
  avalancheMeta,
  avalancheProblemKey,
  bestWindow,
  compassDirection,
  computeAlerts,
  eawsRegionFor,
  forecastAgeMin,
  freezingLevel,
  highestAlert,
  hourRisk,
  lapseRateAdjust,
  mockAvalanche,
  mockForecast,
  summarizeDay,
  WEATHER_THRESHOLDS,
  windChill,
  wmoCodeMeta,
  type WeatherDay,
  type WeatherHour,
} from '..';

const NOW = new Date('2026-01-15T09:30:00Z');
const ULUDAG = { latitude: 40.07, longitude: 29.22 };
const KACKAR = { latitude: 40.83, longitude: 41.16 };
const INNSBRUCK = { latitude: 47.27, longitude: 11.39 };

function hour(overrides: Partial<WeatherHour> = {}, idx = 0): WeatherHour {
  return {
    time: new Date(Date.UTC(2026, 0, 15, 6 + idx)).toISOString(),
    temperatureC: 5,
    apparentC: 3,
    precipitationMm: 0,
    precipitationProbability: 10,
    windKmh: 12,
    windGustKmh: 20,
    windDirectionDeg: 270,
    cloudCoverPct: 30,
    weatherCode: 1,
    snowfallCm: 0,
    freezingLevelM: 2500,
    ...overrides,
  };
}

function day(overrides: Partial<WeatherDay> = {}): WeatherDay {
  return {
    date: '2026-01-15T00:00:00.000Z',
    minC: -2,
    maxC: 6,
    precipitationMm: 2,
    precipitationProbability: 30,
    windMaxKmh: 30,
    weatherCode: 2,
    sunrise: '2026-01-15T05:20:00.000Z',
    sunset: '2026-01-15T14:50:00.000Z',
    uvIndex: 3,
    ...overrides,
  };
}

const calm = (n = 12) => Array.from({ length: n }, (_, i) => hour({}, i));

describe('wmoCodeMeta', () => {
  it('kod gruplarını ikon ve i18n anahtarına eşler', () => {
    expect(wmoCodeMeta(0)).toMatchObject({ group: 'clear', icon: 'sun', wet: false });
    expect(wmoCodeMeta(2).icon).toBe('cloud-sun');
    expect(wmoCodeMeta(3).icon).toBe('cloud');
    expect(wmoCodeMeta(45).labelKey).toBe('weather.wmo.fog');
    expect(wmoCodeMeta(53)).toMatchObject({ group: 'drizzle', icon: 'cloud-rain', wet: true });
    expect(wmoCodeMeta(63).group).toBe('rain');
    expect(wmoCodeMeta(66).group).toBe('freezingRain');
    expect(wmoCodeMeta(73)).toMatchObject({ group: 'snow', icon: 'snowflake' });
    expect(wmoCodeMeta(81).group).toBe('showers');
    expect(wmoCodeMeta(86)).toMatchObject({ group: 'snowShowers', icon: 'snowflake' });
    expect(wmoCodeMeta(95)).toMatchObject({ group: 'thunderstorm', icon: 'cloud-lightning' });
    expect(wmoCodeMeta(99).group).toBe('hail');
    expect(wmoCodeMeta(123).group).toBe('cloudy');
  });
});

describe('fizik yardımcıları', () => {
  it('lapseRateAdjust −6,5 °C/1000 m uygular', () => {
    expect(lapseRateAdjust(20, 0, 1000)).toBeCloseTo(13.5);
    expect(lapseRateAdjust(-3, 2500, 500)).toBeCloseTo(10);
    expect(lapseRateAdjust(7, 1200, 1200)).toBe(7);
  });

  it('windChill 10 °C üstü/hafif rüzgârda değişmez, soğukta düşer', () => {
    expect(windChill(15, 40)).toBe(15);
    expect(windChill(0, 3)).toBe(0);
    expect(windChill(-5, 40)).toBeLessThan(-12);
    expect(windChill(0, 20)).toBeCloseTo(-5.3, 0);
  });

  it('freezingLevel önce veriyi, yoksa lapse-rate türetmesini kullanır', () => {
    expect(freezingLevel([hour({ freezingLevelM: 1840 })])).toBe(1840);
    expect(freezingLevel([hour({ freezingLevelM: null, temperatureC: 6.5 })], 1000)).toBe(2000);
    expect(freezingLevel([hour({ freezingLevelM: null })])).toBeNull();
    expect(freezingLevel([])).toBeNull();
  });

  it('compassDirection 8 yön', () => {
    expect(compassDirection(0)).toBe('N');
    expect(compassDirection(44)).toBe('NE');
    expect(compassDirection(90)).toBe('E');
    expect(compassDirection(225)).toBe('SW');
    expect(compassDirection(359)).toBe('N');
    expect(compassDirection(-90)).toBe('W');
  });

  it('forecastAgeMin', () => {
    expect(forecastAgeMin('2026-01-15T09:00:00Z', NOW)).toBe(30);
    expect(forecastAgeMin('2026-01-15T10:00:00Z', NOW)).toBe(0);
  });
});

describe('computeAlerts', () => {
  it('sakin tahminde uyarı üretmez', () => {
    expect(computeAlerts({ hourly: calm(), daily: [day()] })).toEqual([]);
  });

  it('rüzgâr eşikleri: > 50 uyarı, > 80 tehlike; ardışık saatler birleşir', () => {
    const hourly = [
      hour({}, 0),
      hour({ windGustKmh: 55 }, 1),
      hour({ windGustKmh: 62 }, 2),
      hour({}, 3),
      hour({ windKmh: 85, windGustKmh: 95 }, 4),
    ];
    const alerts = computeAlerts({ hourly, daily: [] });
    expect(alerts.map((a) => [a.kind, a.level])).toEqual([
      ['wind', 'danger'],
      ['wind', 'warning'],
    ]);
    const warning = alerts.find((a) => a.level === 'warning')!;
    expect(warning.from).toBe(hourly[1]!.time);
    expect(warning.to).toBe(hourly[3]!.time);
    expect(warning.value).toBe(62);
    expect(alerts[0]!.value).toBe(95);
    // tam eşik değeri uyarı vermez
    expect(
      computeAlerts({
        hourly: [hour({ windGustKmh: WEATHER_THRESHOLDS.windWarningKmh })],
        daily: [],
      }),
    ).toEqual([]);
  });

  it('yıldırım kodları tehlike; rüzgârla birleşince storm', () => {
    const a = computeAlerts({ hourly: [hour({ weatherCode: 95 })], daily: [] });
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ kind: 'lightning', level: 'danger' });
    const b = computeAlerts({
      hourly: [hour({ weatherCode: 96, windGustKmh: 70 })],
      daily: [],
    });
    expect(b.map((x) => x.kind)).toEqual(['storm']);
    expect(alertLabelKey(b[0]!)).toBe('weather.alerts.storm.danger');
  });

  it('soğuk ve sıcak eşikleri hissedilene de bakar', () => {
    expect(
      computeAlerts({ hourly: [hour({ temperatureC: -11, apparentC: -11 })], daily: [] })[0],
    ).toMatchObject({ kind: 'cold', level: 'warning', value: -11 });
    expect(
      computeAlerts({ hourly: [hour({ temperatureC: -5, apparentC: -21 })], daily: [] })[0],
    ).toMatchObject({ kind: 'cold', level: 'danger' });
    expect(
      computeAlerts({ hourly: [hour({ temperatureC: 36, apparentC: 36 })], daily: [] })[0],
    ).toMatchObject({ kind: 'heat', level: 'warning' });
    expect(
      computeAlerts({ hourly: [hour({ temperatureC: 41, apparentC: 44 })], daily: [] })[0],
    ).toMatchObject({ kind: 'heat', level: 'danger' });
    expect(
      computeAlerts({ hourly: [hour({ temperatureC: -10, apparentC: -10 })], daily: [] }),
    ).toEqual([]);
  });

  it('günlük kar > 10 cm, yağış > 20 mm, UV ≥ 8', () => {
    const snowy = Array.from({ length: 6 }, (_, i) => hour({ snowfallCm: 2, weatherCode: 73 }, i));
    const alerts = computeAlerts({
      hourly: snowy,
      daily: [
        day({ precipitationMm: 25 }),
        day({ date: '2026-01-16T00:00:00.000Z', precipitationMm: 60, uvIndex: 8 }),
        day({ date: '2026-01-17T00:00:00.000Z', uvIndex: 11.2 }),
      ],
    });
    const kinds = alerts.map((a) => `${a.kind}:${a.level}`);
    expect(kinds).toContain('snow:warning');
    // 15 Ocak yağışı kar olarak zaten uyarıldı → rain yok; 16 Ocak yağmur tehlike
    expect(kinds.filter((k) => k.startsWith('rain'))).toEqual(['rain:danger']);
    expect(kinds).toContain('uv:warning');
    expect(kinds).toContain('uv:danger');
    // tehlike önce gelir
    expect(alerts[0]!.level).toBe('danger');
    expect(highestAlert(alerts)?.level).toBe('danger');
    expect(highestAlert([])).toBeNull();
  });
});

describe('bestWindow', () => {
  it('en düşük riskli ardışık pencereyi seçer ve yıldırımlı saatleri eler', () => {
    const hourly = Array.from({ length: 24 }, (_, i) =>
      hour(
        {
          windKmh: i >= 8 && i < 14 ? 5 : 40,
          windGustKmh: i >= 8 && i < 14 ? 8 : 60,
          precipitationProbability: i >= 8 && i < 14 ? 5 : 70,
          weatherCode: i === 20 ? 95 : 1,
        },
        i,
      ),
    );
    const win = bestWindow(hourly, 6);
    expect(win).not.toBeNull();
    expect(win!.from).toBe(hourly[8]!.time);
    expect(win!.to).toBe(hourly[14]!.time);
    expect(win!.hours).toHaveLength(6);
    expect(win!.score).toBeLessThan(hourRisk(hourly[0]!));
  });

  it('yetersiz veri ya da her pencerede yıldırım → null', () => {
    expect(bestWindow(calm(3), 6)).toBeNull();
    const stormy = Array.from({ length: 8 }, (_, i) => hour({ weatherCode: 95 }, i));
    expect(bestWindow(stormy, 4)).toBeNull();
  });

  it('hourRisk gece ve yıldırımı cezalandırır', () => {
    const dayHour = hour({ time: '2026-01-15T10:00:00.000Z' });
    const nightHour = hour({ time: '2026-01-15T02:00:00.000Z' });
    expect(hourRisk(nightHour)).toBeGreaterThan(hourRisk(dayHour));
    expect(hourRisk(hour({ weatherCode: 96 }))).toBeGreaterThan(2);
  });
});

describe('özetler', () => {
  it('summarizeDay tr/en', () => {
    expect(summarizeDay(day({ date: '2026-01-17T00:00:00.000Z' }), 'tr')).toBe(
      'Cts · -2°/6° · yağış %30 · 30 km/sa',
    );
    expect(summarizeDay(day({ date: '2026-01-17T00:00:00.000Z' }), 'en')).toBe(
      'Sat · -2°/6° · rain 30% · 30 km/h',
    );
  });
});

describe('çığ meta', () => {
  it('seviye renkleri ve anahtarları', () => {
    expect(avalancheMeta(1).color).toBe('#3CB44B');
    expect(avalancheMeta(2).color).toBe('#F5D000');
    expect(avalancheMeta(3).color).toBe('#F28C28');
    expect(avalancheMeta(4)).toMatchObject({ color: '#E02020', accentColor: null });
    expect(avalancheMeta(5)).toMatchObject({ color: '#E02020', accentColor: '#111111' });
    expect(avalancheMeta(3).labelKey).toBe('weather.avalanche.level3');
    expect(avalancheMeta(3).descriptionKey).toBe('weather.avalanche.level3Description');
    expect(avalancheProblemKey('wind_slab')).toBe('weather.avalanche.problem.wind_slab');
    expect(avalancheProblemKey('unknown')).toBeNull();
  });
});

describe('eawsRegionFor', () => {
  it('kaba kutular: Alpler, Pireneler, Norveç, İskoçya, İzlanda, Türkiye', () => {
    expect(eawsRegionFor(INNSBRUCK)?.code).toBe('EUREGIO');
    expect(eawsRegionFor({ latitude: 46.0, longitude: 7.75 })?.code).toBe('CH'); // Zermatt
    expect(eawsRegionFor({ latitude: 45.92, longitude: 6.87 })?.code).toBe('FR'); // Chamonix
    expect(eawsRegionFor({ latitude: 42.6, longitude: 0.9 })?.code).toBe('PYR');
    expect(eawsRegionFor({ latitude: 61.6, longitude: 8.3 })?.code).toBe('NO');
    expect(eawsRegionFor({ latitude: 56.8, longitude: -5.0 })?.code).toBe('SCT');
    expect(eawsRegionFor({ latitude: 64.1, longitude: -21.9 })?.code).toBe('IS');
    const tr = eawsRegionFor(KACKAR);
    expect(tr).toMatchObject({ code: 'TR-unofficial', official: false });
    expect(eawsRegionFor({ latitude: 27.98, longitude: 86.92 })).toBeNull(); // Everest
    expect(eawsRegionFor({ latitude: 40.7, longitude: -74.0 })).toBeNull(); // New York
  });
});

describe('mockForecast', () => {
  it('deterministik: aynı girdiler aynı çıktı, farklı tohum farklı', () => {
    const a = mockForecast(ULUDAG, 'seed-1', NOW, 1900);
    const b = mockForecast(ULUDAG, 'seed-1', NOW, 1900);
    const c = mockForecast(ULUDAG, 'seed-2', NOW, 1900);
    expect(a).toEqual(b);
    expect(JSON.stringify(a.hourly)).not.toBe(JSON.stringify(c.hourly));
  });

  it('72 saat + 7 gün, kaynağı mock, saatler şimdiki saatten başlar', () => {
    const f = mockForecast(ULUDAG, 'x', NOW, 1900);
    expect(f.hourly).toHaveLength(72);
    expect(f.daily).toHaveLength(7);
    expect(f.source).toBe('mock');
    expect(f.elevationM).toBe(1900);
    expect(f.hourly[0]!.time).toBe('2026-01-15T09:00:00.000Z');
    expect(f.daily[0]!.date).toBe('2026-01-15T00:00:00.000Z');
    expect(f.fetchedAt).toBe(NOW.toISOString());
    for (const h of f.hourly) {
      expect(h.precipitationProbability).toBeGreaterThanOrEqual(0);
      expect(h.precipitationProbability).toBeLessThanOrEqual(100);
      expect(h.cloudCoverPct).toBeLessThanOrEqual(100);
      expect(h.windGustKmh).toBeGreaterThanOrEqual(h.windKmh);
      if (h.snowfallCm > 0) expect(h.temperatureC).toBeLessThan(1);
    }
    for (const d of f.daily) {
      expect(d.maxC).toBeGreaterThanOrEqual(d.minC);
      expect(new Date(d.sunset).getTime()).toBeGreaterThan(new Date(d.sunrise).getTime());
    }
  });

  it('mevsim ve rakım sıcaklığı belirler', () => {
    const winterHigh = mockForecast(ULUDAG, 's', NOW, 2400);
    const winterLow = mockForecast(ULUDAG, 's', NOW, 100);
    const summerHigh = mockForecast(ULUDAG, 's', new Date('2026-07-20T09:30:00Z'), 2400);
    const mean = (hs: WeatherHour[]) => hs.reduce((a, h) => a + h.temperatureC, 0) / hs.length;
    expect(mean(winterHigh.hourly)).toBeLessThan(mean(winterLow.hourly) - 10);
    expect(mean(summerHigh.hourly)).toBeGreaterThan(mean(winterHigh.hourly) + 10);
    expect(mean(winterHigh.hourly)).toBeLessThan(0);
  });

  it('rakım verilmezse tahmin eder ve uyarıları hesaplar', () => {
    const f = mockForecast(KACKAR, 's', NOW);
    expect(f.elevationM).not.toBeNull();
    expect(Array.isArray(f.alerts)).toBe(true);
  });
});

describe('mockAvalanche', () => {
  it('bölge yoksa null; Türkiye için resmi olmayan mock; deterministik', () => {
    expect(mockAvalanche({ latitude: 27.98, longitude: 86.92 }, NOW)).toBeNull();
    const a = mockAvalanche(KACKAR, NOW);
    const b = mockAvalanche(KACKAR, NOW);
    expect(a).toEqual(b);
    expect(a).toMatchObject({ regionCode: 'TR-unofficial', source: 'mock', url: null });
    expect(a!.dangerLevel).toBeGreaterThanOrEqual(1);
    expect(a!.dangerLevel).toBeLessThanOrEqual(5);
    expect(new Date(a!.validTo).getTime() - new Date(a!.validFrom).getTime()).toBe(86_400_000);
    expect(a!.problems.length).toBeGreaterThan(0);
  });

  it('yazın seviye 1, kışın daha yüksek; yoğun kar seviyeyi artırır', () => {
    const summer = mockAvalanche(INNSBRUCK, new Date('2026-07-20T09:00:00Z'));
    expect(summer?.dangerLevel).toBe(1);
    const winter = mockAvalanche(INNSBRUCK, NOW);
    expect(winter!.dangerLevel).toBeGreaterThanOrEqual(2);
    const heavy = mockAvalanche(INNSBRUCK, NOW, {
      elevationM: 2000,
      hourly: Array.from({ length: 72 }, (_, i) => hour({ snowfallCm: 0.6, windGustKmh: 70 }, i)),
    });
    expect(heavy!.dangerLevel).toBeGreaterThanOrEqual(winter!.dangerLevel);
  });
});
