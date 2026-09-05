import {
  advanceSosStage,
  buildSosPayload,
  CHECKIN_PRESETS,
  checkinPresetBody,
  checkinPresetFromText,
  chooseLink,
  compressText,
  countryFromCoords,
  coverageLabel,
  decodeSatMessage,
  decompressText,
  encodeSatMessage,
  estimatedRescueEtaMin,
  isSosActive,
  messageCostEstimate,
  nextRetryDelayS,
  prioritize,
  queuePolicy,
  SAT_MAX_ATTEMPTS,
  SAT_MESSAGE_MAX_LEN,
  satelliteCoverage,
  signalBars,
  simplifyTurkish,
  sosTimelineNote,
  summarizeQueue,
} from '../satellite';
import type { SatDevice, SatMessage } from '../types';

const KACKAR = { latitude: 40.8321, longitude: 41.1594 };
const NOW = new Date(2026, 8, 5, 14, 7);

const device = (over: Partial<SatDevice> = {}): SatDevice => ({
  id: 'd1',
  userId: 'u_me',
  type: 'inreach',
  name: 'inReach',
  imei: null,
  batteryPct: 80,
  pairedAt: '2026-01-01T00:00:00.000Z',
  lastSeenAt: null,
  monthlyQuota: 40,
  usedThisMonth: 12,
  ...over,
});

const msg = (over: Partial<SatMessage> = {}): SatMessage => ({
  id: 'm',
  userId: 'u_me',
  deviceId: null,
  kind: 'text',
  body: '',
  coords: null,
  toContacts: [],
  status: 'queued',
  link: 'satellite',
  createdAt: '2026-09-01T10:00:00.000Z',
  deliveredAt: null,
  attempts: 0,
  ...over,
});

describe('chooseLink', () => {
  it('önceliği hücresel → wifi → uydu → yok sırasıyla uygular', () => {
    expect(chooseLink({ cellular: 60, wifi: true, satellite: 4 })).toBe('cellular');
    expect(chooseLink({ cellular: 10, wifi: true, satellite: 4 })).toBe('wifi');
    expect(chooseLink({ cellular: 0, wifi: false, satellite: 2 })).toBe('satellite');
    expect(chooseLink({ cellular: 0, wifi: false, satellite: 0 })).toBe('none');
  });

  it('eşik değerinde hücreseli kabul eder, altında reddeder', () => {
    expect(chooseLink({ cellular: 15, wifi: false, satellite: 0 })).toBe('cellular');
    expect(chooseLink({ cellular: 14, wifi: false, satellite: 0 })).toBe('none');
  });

  it('sinyal çubukları 0..4 arasında', () => {
    expect(signalBars(0)).toBe(0);
    expect(signalBars(20)).toBe(1);
    expect(signalBars(49)).toBe(2);
    expect(signalBars(74)).toBe(3);
    expect(signalBars(100)).toBe(4);
  });
});

describe('encode / decode', () => {
  it('Türkçe karakterleri sadeleştirir ve sözlük kelimelerini kısaltır', () => {
    expect(simplifyTurkish('Güvendeyim, ışık şart çöğü')).toBe('Guvendeyim, isik sart cogu');
    expect(compressText('güvendeyim  konum ekli')).toBe('gv kn ekli');
    expect(decompressText('gv kn ekli')).toBe('güvendeyim konum ekli');
  });

  it('kodlanan mesaj 160 karakteri aşmaz ve gidiş-dönüş bilgileri korur', () => {
    const body = encodeSatMessage(
      { kind: 'checkin', body: 'güvendeyim plan devam', coords: KACKAR, toContacts: [] },
      NOW,
    );
    expect(body.length).toBeLessThanOrEqual(SAT_MESSAGE_MAX_LEN);
    expect(body).toBe('k:C;t:1407;g:40.83210,41.15940;m:gv pl dv');
    const decoded = decodeSatMessage(body);
    expect(decoded.kind).toBe('checkin');
    expect(decoded.time).toBe('14:07');
    expect(decoded.coords).toEqual({ latitude: 40.8321, longitude: 41.1594 });
    expect(decoded.text).toBe('güvendeyim plan devam');
  });

  it('çok uzun metni kırpar ama sınırı korur', () => {
    const long = 'yardım '.repeat(80);
    const body = encodeSatMessage(
      { kind: 'text', body: long, coords: KACKAR, toContacts: [] },
      NOW,
    );
    expect(body.length).toBe(SAT_MESSAGE_MAX_LEN);
    expect(decodeSatMessage(body).kind).toBe('text');
  });

  it('konum ve metin yoksa yalnızca başlık üretir; noktalı virgül gövdede güvenli', () => {
    expect(
      encodeSatMessage({ kind: 'location', body: '', coords: null, toContacts: [] }, NOW),
    ).toBe('k:L;t:1407');
    const body = encodeSatMessage(
      { kind: 'text', body: 'a;b;c', coords: null, toContacts: [] },
      NOW,
    );
    expect(decodeSatMessage(body).text).toBe('a,b,c');
  });

  it('biçim tanınmazsa serbest metin olarak çözer', () => {
    const d = decodeSatMessage('SOS;n:Deniz;g:40.1,29.2');
    expect(d.kind).toBe('text');
    expect(d.coords).toBeNull();
  });

  it('maliyet: kota dahilinde ücretsiz, aşımda kredi başı ücret', () => {
    const body = 'x'.repeat(100);
    expect(messageCostEstimate(body, device())).toEqual({
      credits: 1,
      priceTry: 0,
      overQuota: false,
    });
    expect(messageCostEstimate(body, device({ usedThisMonth: 40 }))).toEqual({
      credits: 1,
      priceTry: 18,
      overQuota: true,
    });
    expect(messageCostEstimate(body, device({ type: 'phone_satellite', monthlyQuota: 0 }))).toEqual(
      { credits: 1, priceTry: 0, overQuota: false },
    );
    expect(messageCostEstimate(body, null).credits).toBe(1);
  });
});

describe('kuyruk politikası', () => {
  it('bağlantı yoksa bekler, hücreselde gönderir, 5 denemede başarısız', () => {
    expect(queuePolicy(msg(), 'none', 0)).toBe('wait');
    expect(queuePolicy(msg(), 'cellular', 0)).toBe('send');
    expect(queuePolicy(msg(), 'wifi', 3)).toBe('send');
    expect(queuePolicy(msg(), 'cellular', SAT_MAX_ATTEMPTS)).toBe('fail');
  });

  it('uyduda öncelikli türler hemen gider, serbest metin ilk turda bekler', () => {
    expect(queuePolicy(msg({ kind: 'sos' }), 'satellite', 0)).toBe('send');
    expect(queuePolicy(msg({ kind: 'checkin' }), 'satellite', 0)).toBe('send');
    expect(queuePolicy(msg({ kind: 'location' }), 'satellite', 0)).toBe('send');
    expect(queuePolicy(msg({ kind: 'text' }), 'satellite', 0)).toBe('wait');
    expect(queuePolicy(msg({ kind: 'text' }), 'satellite', 1)).toBe('send');
  });

  it('üstel geri çekilme 300 sn ile sınırlı', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(nextRetryDelayS)).toEqual([15, 30, 60, 120, 240, 300, 300]);
  });

  it('prioritize: sos > checkin > location > text, sonra eski → yeni', () => {
    const list = [
      msg({ id: 't2', kind: 'text', createdAt: '2026-09-01T12:00:00.000Z' }),
      msg({ id: 'l1', kind: 'location', createdAt: '2026-09-01T11:00:00.000Z' }),
      msg({ id: 't1', kind: 'text', createdAt: '2026-09-01T10:00:00.000Z' }),
      msg({ id: 's1', kind: 'sos', createdAt: '2026-09-01T13:00:00.000Z' }),
      msg({ id: 'c1', kind: 'checkin', createdAt: '2026-09-01T09:00:00.000Z' }),
    ];
    expect(prioritize(list).map((m) => m.id)).toEqual(['s1', 'c1', 'l1', 't1', 't2']);
    // girdi değişmez
    expect(list[0]?.id).toBe('t2');
  });

  it('kuyruk özeti durumları sayar', () => {
    expect(
      summarizeQueue([
        msg({ status: 'queued' }),
        msg({ status: 'sending' }),
        msg({ status: 'failed' }),
        msg({ status: 'sent' }),
        msg({ status: 'delivered' }),
      ]),
    ).toEqual({ queued: 2, failed: 1, sent: 1, delivered: 1 });
  });
});

describe('SOS aşama makinesi', () => {
  it('sırayı takip eder ve resolved sabit kalır', () => {
    expect(advanceSosStage('idle')).toBe('armed');
    expect(advanceSosStage('armed')).toBe('sent');
    expect(advanceSosStage('sent')).toBe('acknowledged');
    expect(advanceSosStage('acknowledged')).toBe('dispatched');
    expect(advanceSosStage('dispatched')).toBe('resolved');
    expect(advanceSosStage('resolved')).toBe('resolved');
    expect(isSosActive('idle')).toBe(false);
    expect(isSosActive('sent')).toBe(true);
    expect(isSosActive('resolved')).toBe(false);
  });

  it('zaman çizelgesi notu yerelleştirilir', () => {
    expect(sosTimelineNote('dispatched', 'tr')).toMatch(/ekibi/);
    expect(sosTimelineNote('dispatched', 'en')).toMatch(/dispatched/);
  });

  it('ETA en az 15 dk ve mesafeyle artar', () => {
    expect(estimatedRescueEtaMin(KACKAR, KACKAR)).toBe(20);
    const far = estimatedRescueEtaMin(KACKAR, { latitude: 41.0, longitude: 41.5 });
    expect(far).toBeGreaterThan(40);
  });

  it('SOS yükü 160 karakteri aşmaz; kan grubu yoksa atlanır', () => {
    const contacts = [{ name: 'Elif', phone: '+90 532 000 00 02', userId: 'u_elif' }];
    const payload = buildSosPayload({ displayName: 'Deniz Kaya' }, KACKAR, contacts, NOW);
    expect(payload).toBe('SOS;n:Deniz Kaya;g:40.83210,41.15940;t:1407;ct:+905320000002');
    expect(payload.length).toBeLessThanOrEqual(SAT_MESSAGE_MAX_LEN);
    const withBlood = buildSosPayload(
      { displayName: 'Deniz', bloodType: 'A Rh+' },
      KACKAR,
      [],
      NOW,
    );
    expect(withBlood).toContain('kb:ARh+');
    expect(withBlood).not.toContain('ct:');
    const longName = buildSosPayload({ displayName: 'x'.repeat(300) }, KACKAR, contacts, NOW);
    expect(longName.length).toBeLessThanOrEqual(SAT_MESSAGE_MAX_LEN);
  });
});

describe('kapsama', () => {
  it('Iridium cihazlar küresel, kutuplarda düşer', () => {
    expect(satelliteCoverage(KACKAR, 'inreach')).toBe(1);
    expect(satelliteCoverage({ latitude: 78, longitude: 15 }, 'zoleo')).toBe(0.75);
  });

  it('telefon uydu yalnızca desteklenen ülkelerde', () => {
    expect(countryFromCoords(KACKAR)).toBe('TR');
    expect(satelliteCoverage(KACKAR, 'phone_satellite')).toBe(0.9);
    // Nepal — liste dışı
    expect(countryFromCoords({ latitude: 27.98, longitude: 86.92 })).toBeNull();
    expect(satelliteCoverage({ latitude: 27.98, longitude: 86.92 }, 'phone_satellite')).toBe(0.1);
  });

  it('SPOT kutuplarda sıfır, orta enlemde iyi', () => {
    expect(satelliteCoverage({ latitude: 72, longitude: 20 }, 'spot')).toBe(0);
    expect(satelliteCoverage(KACKAR, 'spot')).toBe(0.85);
  });

  it('etiketler eşiklere göre', () => {
    expect(coverageLabel(0)).toBe('none');
    expect(coverageLabel(0.2)).toBe('poor');
    expect(coverageLabel(0.5)).toBe('fair');
    expect(coverageLabel(0.85)).toBe('good');
    expect(coverageLabel(1)).toBe('excellent');
  });
});

describe('check-in şablonları', () => {
  it('4 şablon; kod önekli gövde tanınır', () => {
    expect(CHECKIN_PRESETS.map((p) => p.id)).toEqual(['ok', 'delayed', 'camping', 'need_pickup']);
    const body = checkinPresetBody('need_pickup');
    expect(body.startsWith('PCK ')).toBe(true);
    expect(checkinPresetFromText(body)?.id).toBe('need_pickup');
    const encoded = encodeSatMessage(
      { kind: 'checkin', body, coords: KACKAR, toContacts: [] },
      NOW,
    );
    expect(checkinPresetFromText(decodeSatMessage(encoded).text)?.id).toBe('need_pickup');
    expect(checkinPresetFromText('merhaba')).toBeNull();
  });
});
