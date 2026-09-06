import type {
  AmsCheck,
  Destination,
  DestinationStage,
  EmergencyCenter,
  ReturnPlan,
  StageKind,
} from '@/domain';

import { CURRENT_USER_ID } from './seed';

/**
 * Destinasyon arşivi demo verisi. Koordinatlar, irtifalar, izin ücretleri ve süreler
 * resmi kaynaklardan (Nepal Tourism Board, KINAPA, CONAF, SERNANP, Wikivoyage) derlenip
 * 2026 kuruyla ₺'ye çevrilmiştir; kesin ücretler için `sources` bağlantılarına bakın.
 */

const unsplash = (id: string, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

const now = Date.now();
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();
const hoursAgo = (h: number) => minutesAgo(h * 60);
const daysAgo = (d: number) => hoursAgo(d * 24);
const hoursAhead = (h: number) => new Date(now + h * 3_600_000).toISOString();

type StageInput = {
  name: string;
  kind: StageKind;
  lat: number;
  lon: number;
  elev: number;
  km: number;
  min: number;
  sleep?: boolean;
  facilities?: string[];
  water?: boolean;
  net?: DestinationStage['connectivity'];
  note?: string;
  rest?: boolean;
};

/** Etap listesini kısa girdilerden üretir; id = `<destId>_s<sıra>`. */
function stagesOf(destinationId: string, inputs: StageInput[]): DestinationStage[] {
  return inputs.map((s, i) => ({
    id: `${destinationId}_s${i + 1}`,
    destinationId,
    order: i + 1,
    name: s.name,
    kind: s.kind,
    coords: { latitude: s.lat, longitude: s.lon },
    elevationM: s.elev,
    distanceKm: s.km,
    durationMin: s.min,
    sleeping: s.sleep ?? false,
    facilities: s.facilities ?? [],
    waterAvailable: s.water ?? true,
    connectivity: s.net ?? 'none',
    note: s.note ?? '',
    restDayRecommended: s.rest ?? false,
  }));
}

/* ------------------------------------------------------------------ */
/* NEPAL                                                               */
/* ------------------------------------------------------------------ */

const EBC_ID = 'dest_ebc';
const ebcStages = stagesOf(EBC_ID, [
  {
    name: 'Lukla (Tenzing-Hillary Havalimanı)',
    kind: 'trailhead',
    lat: 27.6875,
    lon: 86.7314,
    elev: 2860,
    km: 0,
    min: 0,
    sleep: true,
    facilities: ['teahouse', 'wifi', 'charging', 'ATM', 'helipad', 'hospital'],
    net: '4g',
    note: 'Sabah uçuşları hava kapanmadan iner; öğleden sonra iptaller sık. İlk gün Phakding’e yürünür.',
  },
  {
    name: 'Phakding',
    kind: 'teahouse',
    lat: 27.7419,
    lon: 86.7128,
    elev: 2610,
    km: 8,
    min: 210,
    sleep: true,
    facilities: ['teahouse', 'hot shower', 'wifi', 'charging'],
    net: '4g',
    note: 'Dudh Koshi boyunca iniş ağırlıklı kısa gün; asma köprüler ve mani taşları.',
  },
  {
    name: 'Namche Bazaar',
    kind: 'village',
    lat: 27.8069,
    lon: 86.714,
    elev: 3440,
    km: 11,
    min: 360,
    sleep: true,
    rest: true,
    facilities: [
      'teahouse',
      'hot shower',
      'wifi',
      'charging',
      'ATM',
      'bakery',
      'pharmacy',
      'gear shops',
    ],
    net: '4g',
    note: 'Sagarmatha NP girişi Monjo’da. Aklimatizasyon günü: Everest View Hotel (3880 m) ya da Khumjung turu.',
  },
  {
    name: 'Tengboche Manastırı',
    kind: 'teahouse',
    lat: 27.8364,
    lon: 86.7647,
    elev: 3860,
    km: 10,
    min: 330,
    sleep: true,
    facilities: ['teahouse', 'charging', 'bakery'],
    net: '2g',
    note: 'Phunki Tenga’dan (3250 m) 600 m dik tırmanış. Ama Dablam ve Everest manzarası, sabah puja.',
  },
  {
    name: 'Dingboche',
    kind: 'teahouse',
    lat: 27.8925,
    lon: 86.8314,
    elev: 4410,
    km: 11,
    min: 330,
    sleep: true,
    rest: true,
    facilities: ['teahouse', 'charging', 'wifi (Everest Link)', 'bakery'],
    net: 'wifi',
    note: 'İkinci aklimatizasyon günü: Nangkartshang (5083 m) tırmanışı, akşam Dingboche’ye dönüş.',
  },
  {
    name: 'Lobuche',
    kind: 'teahouse',
    lat: 27.9503,
    lon: 86.8064,
    elev: 4940,
    km: 8,
    min: 300,
    sleep: true,
    facilities: ['teahouse', 'charging'],
    net: 'sat_only',
    note: 'Thukla geçidinde (4830 m) Everest şehitleri anıtları. Geceleri -15 °C olağan.',
  },
  {
    name: 'Gorak Shep',
    kind: 'teahouse',
    lat: 27.9811,
    lon: 86.8281,
    elev: 5164,
    km: 5,
    min: 180,
    sleep: true,
    facilities: ['teahouse'],
    water: false,
    net: 'sat_only',
    note: 'Son yerleşim; su parayla satılır. Aynı gün EBC’ye gidip dönülür, ertesi sabah Kala Patthar.',
  },
  {
    name: 'Everest Ana Kampı (EBC)',
    kind: 'base_camp',
    lat: 28.0025,
    lon: 86.8528,
    elev: 5364,
    km: 4,
    min: 150,
    facilities: [],
    water: false,
    net: 'none',
    note: 'Khumbu Buzulu üzerinde moren yolu; nisan-mayıs sezonunda ekspedisyon çadırları. Konaklama yok.',
  },
  {
    name: 'Kala Patthar',
    kind: 'viewpoint',
    lat: 27.9958,
    lon: 86.8283,
    elev: 5545,
    km: 2,
    min: 150,
    facilities: [],
    water: false,
    net: 'none',
    note: 'Gün doğumunda Everest, Nuptse, Pumori panoraması; rotanın en yüksek noktası. Aynı gün Pheriche’ye iniş.',
  },
  {
    name: 'Pheriche (HRA kliniği)',
    kind: 'teahouse',
    lat: 27.8956,
    lon: 86.8194,
    elev: 4371,
    km: 13,
    min: 420,
    sleep: true,
    facilities: ['teahouse', 'HRA clinic', 'charging', 'helipad'],
    net: '2g',
    note: 'Himalayan Rescue Association kliniği (Mart-Mayıs, Eylül-Kasım açık); ücretsiz günlük AMS semineri.',
  },
  {
    name: 'Namche Bazaar (dönüş)',
    kind: 'village',
    lat: 27.8069,
    lon: 86.714,
    elev: 3440,
    km: 20,
    min: 420,
    sleep: true,
    facilities: ['teahouse', 'hot shower', 'wifi', 'charging', 'ATM'],
    net: '4g',
  },
  {
    name: 'Lukla (dönüş)',
    kind: 'trailhead',
    lat: 27.6875,
    lon: 86.7314,
    elev: 2860,
    km: 19,
    min: 420,
    sleep: true,
    facilities: ['teahouse', 'wifi', 'charging', 'helipad'],
    net: '4g',
    note: 'Ertesi sabah Kathmandu/Ramechhap uçuşu; hava riskine karşı 1–2 gün tampon bırak.',
  },
]);

const ANNAPURNA_ID = 'dest_annapurna_circuit';
const annapurnaStages = stagesOf(ANNAPURNA_ID, [
  {
    name: 'Besisahar',
    kind: 'trailhead',
    lat: 28.2306,
    lon: 84.3753,
    elev: 760,
    km: 0,
    min: 0,
    facilities: ['hotel', 'ATM', 'jeep stand', 'ACAP checkpost'],
    net: '4g',
    note: 'Kathmandu’dan 6–8 saat otobüs. Çoğu grup buradan jeep ile Chame/Manang’a atlar.',
  },
  {
    name: 'Chame',
    kind: 'village',
    lat: 28.5559,
    lon: 84.2412,
    elev: 2670,
    km: 63,
    min: 300,
    sleep: true,
    facilities: ['teahouse', 'hot spring', 'charging', 'ATM', 'pharmacy'],
    net: '4g',
    note: 'Manang bölgesi merkezi; jeep yolunun sonuna yakın. Kaplıca havuzu nehir kenarında.',
  },
  {
    name: 'Upper Pisang',
    kind: 'village',
    lat: 28.6208,
    lon: 84.1572,
    elev: 3300,
    km: 15,
    min: 300,
    sleep: true,
    facilities: ['teahouse', 'charging', 'gompa'],
    net: '2g',
    note: 'Annapurna II karşıda. Üst rota (Ghyaru–Ngawal) manzara ve aklimatizasyon için alt yoldan iyidir.',
  },
  {
    name: 'Manang',
    kind: 'village',
    lat: 28.6667,
    lon: 84.0167,
    elev: 3540,
    km: 20,
    min: 420,
    sleep: true,
    rest: true,
    facilities: ['teahouse', 'HRA clinic', 'wifi', 'charging', 'bakery', 'cinema', 'gear rental'],
    net: 'wifi',
    note: 'Aklimatizasyon günü: Ice Lake (4600 m) ya da Gangapurna gölü; HRA’nın 15:00 AMS semineri.',
  },
  {
    name: 'Yak Kharka',
    kind: 'teahouse',
    lat: 28.7194,
    lon: 83.9583,
    elev: 4050,
    km: 10,
    min: 240,
    sleep: true,
    facilities: ['teahouse', 'charging'],
    net: 'none',
    note: 'Kısa gün; Manang’dan sonra günde 500 m kuralı için ideal ara durak.',
  },
  {
    name: 'Thorong Phedi',
    kind: 'teahouse',
    lat: 28.7597,
    lon: 83.9427,
    elev: 4450,
    km: 7,
    min: 210,
    sleep: true,
    facilities: ['teahouse', 'bakery'],
    net: 'none',
    note: 'High Camp (4850 m) geçidi kısaltır ama uyku irtifası riskli; AMS belirtisi varsa Phedi’de kal.',
  },
  {
    name: 'Thorong La',
    kind: 'pass',
    lat: 28.7908,
    lon: 83.9358,
    elev: 5416,
    km: 6,
    min: 300,
    facilities: ['tea shack (sezonluk)'],
    water: false,
    net: 'none',
    note: '04:00 çıkış; rüzgâr öğleden önce artar. Kar sonrası 2014 fırtınası anısına; hava kötüyse bekle.',
  },
  {
    name: 'Muktinath',
    kind: 'village',
    lat: 28.8167,
    lon: 83.8717,
    elev: 3760,
    km: 10,
    min: 240,
    sleep: true,
    facilities: ['hotel', 'hot shower', 'wifi', 'charging', 'temple', 'jeep stand'],
    net: '4g',
    note: '1.650 m iniş; dizleri koru. Hindu-Budist tapınağı; Jomsom’a jeep 1,5 saat.',
  },
  {
    name: 'Jomsom',
    kind: 'village',
    lat: 28.7806,
    lon: 83.7228,
    elev: 2720,
    km: 20,
    min: 90,
    sleep: true,
    facilities: ['hotel', 'airport', 'ATM', 'wifi'],
    net: '4g',
    note: 'Pokhara’ya sabah uçuşu (20 dk) ya da 8–10 saat jeep/otobüs. Kali Gandaki rüzgârı öğleden sonra.',
  },
]);

const ABC_ID = 'dest_abc';
const abcStages = stagesOf(ABC_ID, [
  {
    name: 'Nayapul / Jhinu Danda',
    kind: 'trailhead',
    lat: 28.3675,
    lon: 83.7433,
    elev: 1780,
    km: 0,
    min: 0,
    facilities: ['jeep stand', 'hot spring'],
    net: '4g',
    note: 'Pokhara’dan jeep 3 saat. Jhinu kaplıcaları rotanın sonunda ödül.',
  },
  {
    name: 'Chhomrong',
    kind: 'village',
    lat: 28.4106,
    lon: 83.8203,
    elev: 2170,
    km: 6,
    min: 240,
    sleep: true,
    facilities: ['teahouse', 'hot shower', 'wifi', 'charging', 'bakery'],
    net: '4g',
    note: 'Modi Khola vadisine giriş; son ATM/telefon sinyali burada.',
  },
  {
    name: 'Dovan',
    kind: 'teahouse',
    lat: 28.4636,
    lon: 83.8483,
    elev: 2500,
    km: 10,
    min: 330,
    sleep: true,
    facilities: ['teahouse', 'charging'],
    net: 'none',
    note: 'Bambu ve rododendron ormanı; sülük mevsimi (muson) dikkat.',
  },
  {
    name: 'Deurali',
    kind: 'teahouse',
    lat: 28.4972,
    lon: 83.8639,
    elev: 3230,
    km: 7,
    min: 240,
    sleep: true,
    facilities: ['teahouse'],
    net: 'none',
    note: 'Hinku Mağarası geçilir; kış/ilkbaharda çığ kanalı — sabah erken geç.',
  },
  {
    name: 'Machapuchare Base Camp (MBC)',
    kind: 'teahouse',
    lat: 28.5192,
    lon: 83.8814,
    elev: 3700,
    km: 5,
    min: 180,
    sleep: true,
    facilities: ['teahouse'],
    net: 'none',
    note: 'Aklimatizasyon için ABC’ye çıkmadan bir gece burada; gün doğumu Balık Kuyruğu’nda.',
  },
  {
    name: 'Annapurna Base Camp',
    kind: 'base_camp',
    lat: 28.5306,
    lon: 83.8781,
    elev: 4130,
    km: 4,
    min: 150,
    sleep: true,
    facilities: ['teahouse', 'memorial'],
    net: 'none',
    note: '360° buzul amfisi: Annapurna I güney duvarı, Hiunchuli, Tent Peak. Anatoli Boukreev anıtı.',
  },
  {
    name: 'Bamboo',
    kind: 'teahouse',
    lat: 28.4497,
    lon: 83.8447,
    elev: 2310,
    km: 17,
    min: 420,
    sleep: true,
    facilities: ['teahouse', 'charging'],
    net: 'none',
  },
  {
    name: 'Jhinu Danda (kaplıca)',
    kind: 'village',
    lat: 28.3947,
    lon: 83.8258,
    elev: 1780,
    km: 12,
    min: 330,
    sleep: true,
    facilities: ['teahouse', 'hot spring', 'wifi', 'charging'],
    net: '4g',
    note: 'Nehir kenarı kaplıca havuzları; ertesi gün jeep ile Pokhara.',
  },
]);

const LANGTANG_ID = 'dest_langtang';
const langtangStages = stagesOf(LANGTANG_ID, [
  {
    name: 'Syabrubesi',
    kind: 'trailhead',
    lat: 28.16,
    lon: 85.3436,
    elev: 1460,
    km: 0,
    min: 0,
    sleep: true,
    facilities: ['hotel', 'hot shower', 'wifi', 'charging', 'checkpost'],
    net: '4g',
    note: 'Kathmandu’dan 7–9 saat otobüs/jeep (Trishuli yolu heyelan sezonunda yavaş).',
  },
  {
    name: 'Lama Hotel',
    kind: 'teahouse',
    lat: 28.1928,
    lon: 85.4331,
    elev: 2470,
    km: 11,
    min: 360,
    sleep: true,
    facilities: ['teahouse', 'charging'],
    net: 'none',
    note: 'Langtang Khola boyunca orman; kırmızı panda bölgesi.',
  },
  {
    name: 'Langtang Köyü',
    kind: 'village',
    lat: 28.2139,
    lon: 85.5153,
    elev: 3430,
    km: 15,
    min: 360,
    sleep: true,
    facilities: ['teahouse', 'charging', 'memorial'],
    net: '2g',
    note: '2015 depreminde tamamen yıkıldı; yeni köy 1 km ilerde. Anıt duvarı ziyaret edilir.',
  },
  {
    name: 'Kyanjin Gompa',
    kind: 'village',
    lat: 28.2103,
    lon: 85.5652,
    elev: 3870,
    km: 7,
    min: 210,
    sleep: true,
    rest: true,
    facilities: ['teahouse', 'wifi', 'charging', 'bakery', 'cheese factory', 'gompa'],
    net: 'wifi',
    note: 'Aklimatizasyon ve keşif merkezi: Kyanjin Ri (4773 m) yarım gün, Tserko Ri tam gün.',
  },
  {
    name: 'Tserko Ri',
    kind: 'viewpoint',
    lat: 28.2286,
    lon: 85.6017,
    elev: 4984,
    km: 6,
    min: 360,
    facilities: [],
    water: false,
    net: 'none',
    note: 'Langtang Lirung (7227 m), Shishapangma ve Tibet sınırı manzarası; 03:30 çıkış.',
  },
  {
    name: 'Lama Hotel (dönüş)',
    kind: 'teahouse',
    lat: 28.1928,
    lon: 85.4331,
    elev: 2470,
    km: 22,
    min: 420,
    sleep: true,
    facilities: ['teahouse', 'charging'],
    net: 'none',
  },
  {
    name: 'Syabrubesi (dönüş)',
    kind: 'trailhead',
    lat: 28.16,
    lon: 85.3436,
    elev: 1460,
    km: 11,
    min: 300,
    sleep: true,
    facilities: ['hotel', 'hot shower', 'wifi'],
    net: '4g',
  },
]);

const MANASLU_ID = 'dest_manaslu';
const manasluStages = stagesOf(MANASLU_ID, [
  {
    name: 'Machha Khola',
    kind: 'trailhead',
    lat: 28.2822,
    lon: 84.8631,
    elev: 900,
    km: 0,
    min: 0,
    sleep: true,
    facilities: ['teahouse', 'charging'],
    net: '4g',
    note: 'Kathmandu → Arughat/Soti Khola jeep 8–9 saat; kısıtlı bölge izni Jagat’ta kontrol edilir.',
  },
  {
    name: 'Jagat',
    kind: 'village',
    lat: 28.3553,
    lon: 84.8933,
    elev: 1340,
    km: 22,
    min: 420,
    sleep: true,
    facilities: ['teahouse', 'checkpost', 'charging'],
    net: '2g',
    note: 'Manaslu Kısıtlı Bölge (MRAP) girişi; izin ve rehber kontrolü.',
  },
  {
    name: 'Deng',
    kind: 'village',
    lat: 28.4614,
    lon: 84.8636,
    elev: 1860,
    km: 20,
    min: 420,
    sleep: true,
    facilities: ['teahouse'],
    net: 'none',
  },
  {
    name: 'Namrung',
    kind: 'village',
    lat: 28.5453,
    lon: 84.7378,
    elev: 2630,
    km: 19,
    min: 390,
    sleep: true,
    facilities: ['teahouse', 'hot shower', 'wifi', 'charging'],
    net: 'wifi',
    note: 'Nubri Tibet kültürüne giriş; buradan sonra manastırlar ve mani duvarları.',
  },
  {
    name: 'Lho',
    kind: 'village',
    lat: 28.5875,
    lon: 84.6817,
    elev: 3180,
    km: 10,
    min: 240,
    sleep: true,
    facilities: ['teahouse', 'gompa'],
    net: 'none',
    note: 'Ribung Gompa’dan Manaslu (8163 m) gün doğumu.',
  },
  {
    name: 'Samagaon',
    kind: 'village',
    lat: 28.5994,
    lon: 84.6244,
    elev: 3530,
    km: 8,
    min: 210,
    sleep: true,
    rest: true,
    facilities: ['teahouse', 'charging', 'health post', 'gompa'],
    net: '2g',
    note: 'Aklimatizasyon günü: Birendra Gölü ya da Manaslu Ana Kampı (4800 m) gidiş-dönüş.',
  },
  {
    name: 'Samdo',
    kind: 'village',
    lat: 28.6444,
    lon: 84.6469,
    elev: 3860,
    km: 8,
    min: 180,
    sleep: true,
    facilities: ['teahouse', 'charging'],
    net: 'none',
    note: 'Tibet sınırına 10 km; yak kervanları. Ek aklimatizasyon: Samdo Ri (5000 m).',
  },
  {
    name: 'Dharamsala (Larkya Phedi)',
    kind: 'camp',
    lat: 28.6614,
    lon: 84.6108,
    elev: 4460,
    km: 7,
    min: 210,
    sleep: true,
    facilities: ['basic lodge', 'tents'],
    net: 'none',
    note: 'Tek ve kalabalık lodge; erken rezervasyon. Geçit günü 03:30 çıkış.',
  },
  {
    name: 'Larkya La',
    kind: 'pass',
    lat: 28.6428,
    lon: 84.5586,
    elev: 5106,
    km: 7,
    min: 300,
    facilities: [],
    water: false,
    net: 'none',
    note: 'Himlung, Cheo Himal, Annapurna II panoraması. Batı inişi buzlu; mikro krampon işe yarar.',
  },
  {
    name: 'Bimthang',
    kind: 'village',
    lat: 28.6203,
    lon: 84.4992,
    elev: 3720,
    km: 9,
    min: 300,
    sleep: true,
    facilities: ['teahouse', 'charging'],
    net: 'none',
    note: 'Buzul göl ve Manaslu batı yüzü; 1.400 m iniş sonrası sıcak yemek.',
  },
  {
    name: 'Dharapani',
    kind: 'village',
    lat: 28.5228,
    lon: 84.3728,
    elev: 1860,
    km: 26,
    min: 480,
    sleep: true,
    facilities: ['teahouse', 'wifi', 'jeep stand', 'ACAP checkpost'],
    net: '4g',
    note: 'Annapurna Circuit ile birleşir; Besisahar’a jeep 4–5 saat.',
  },
]);

/* ------------------------------------------------------------------ */
/* AFRİKA / GÜNEY AMERİKA                                              */
/* ------------------------------------------------------------------ */

const KILI_ID = 'dest_kilimanjaro';
const kiliStages = stagesOf(KILI_ID, [
  {
    name: 'Machame Gate',
    kind: 'trailhead',
    lat: -3.1706,
    lon: 37.2419,
    elev: 1800,
    km: 0,
    min: 0,
    facilities: ['ranger post', 'toilets', 'porter weighing'],
    net: '4g',
    note: 'Kayıt ve porter yük tartısı (maks. 20 kg). Moshi’den 1 saat.',
  },
  {
    name: 'Machame Camp',
    kind: 'camp',
    lat: -3.1244,
    lon: 37.2803,
    elev: 3010,
    km: 11,
    min: 360,
    sleep: true,
    facilities: ['tents', 'ranger hut', 'toilets'],
    net: '2g',
    note: 'Yağmur ormanı içinde tırmanış; öğleden sonra sis ve yağmur olağan.',
  },
  {
    name: 'Shira Camp',
    kind: 'camp',
    lat: -3.0872,
    lon: 37.2528,
    elev: 3840,
    km: 5,
    min: 300,
    sleep: true,
    facilities: ['tents', 'ranger hut'],
    net: '2g',
    note: 'Shira platosuna çıkış; Kibo ilk kez görünür. Geceleri 0 °C altı.',
  },
  {
    name: 'Lava Tower → Barranco Camp',
    kind: 'camp',
    lat: -3.0872,
    lon: 37.3131,
    elev: 3960,
    km: 10,
    min: 420,
    sleep: true,
    rest: true,
    facilities: ['tents', 'ranger hut', 'stream'],
    net: 'none',
    note: '“Yüksek tırman, alçak uyu”: Lava Tower 4630 m’ye çıkılıp Barranco’ya inilir. En önemli aklimatizasyon günü.',
  },
  {
    name: 'Karanga Camp',
    kind: 'camp',
    lat: -3.0964,
    lon: 37.3453,
    elev: 3995,
    km: 5,
    min: 240,
    sleep: true,
    facilities: ['tents', 'last water point'],
    net: 'none',
    note: 'Barranco Duvarı (tırmanış sınıfı 2) sabah aşılır. Son su kaynağı; porterler yukarıya taşır.',
  },
  {
    name: 'Barafu Camp',
    kind: 'base_camp',
    lat: -3.0847,
    lon: 37.3703,
    elev: 4673,
    km: 4,
    min: 210,
    sleep: true,
    facilities: ['tents', 'ranger hut', 'helipad (acil)'],
    water: false,
    net: 'sat_only',
    note: 'Zirve kampı; 18:00 uyku, 23:30 çıkış. Su yok (Karanga’dan taşınır).',
  },
  {
    name: 'Stella Point',
    kind: 'pass',
    lat: -3.0731,
    lon: 37.3603,
    elev: 5756,
    km: 5,
    min: 390,
    facilities: [],
    water: false,
    net: 'none',
    note: 'Krater kenarı; buradan Uhuru’ya 45 dk düz yürüyüş. Gün doğumu genelde burada.',
  },
  {
    name: 'Uhuru Peak',
    kind: 'summit',
    lat: -3.0758,
    lon: 37.3533,
    elev: 5895,
    km: 1.5,
    min: 45,
    facilities: [],
    water: false,
    net: 'none',
    note: 'Afrika’nın çatısı. Zirvede 15 dk’dan fazla kalma; buzul kalıntıları (Furtwängler) yanı başında.',
  },
  {
    name: 'Mweka Camp',
    kind: 'camp',
    lat: -3.1583,
    lon: 37.3542,
    elev: 3100,
    km: 13,
    min: 420,
    sleep: true,
    facilities: ['tents', 'ranger hut', 'beer (!)'],
    net: '2g',
    note: 'Aynı gün Barafu’ya inip öğle yemeği, ardından 1.500 m daha iniş. Uzun gün: 12–14 saat.',
  },
  {
    name: 'Mweka Gate',
    kind: 'trailhead',
    lat: -3.2306,
    lon: 37.3736,
    elev: 1640,
    km: 10,
    min: 210,
    facilities: ['ranger post', 'certificate', 'transport'],
    net: '4g',
    note: 'Zirtan sertifikası (Uhuru altın, Stella yeşil). Bahşiş töreni genelde burada.',
  },
]);

const TORRES_ID = 'dest_torres';
const torresStages = stagesOf(TORRES_ID, [
  {
    name: 'Paine Grande (katamaran iskelesi)',
    kind: 'trailhead',
    lat: -51.0667,
    lon: -73.0833,
    elev: 40,
    km: 0,
    min: 0,
    sleep: true,
    facilities: ['refugio', 'camping', 'hot shower', 'restaurant', 'wifi (ücretli)'],
    net: 'wifi',
    note: 'Pudeto’dan katamaran 30 dk (Pehoé gölü). Vertice Patagonia rezervasyonu şart.',
  },
  {
    name: 'Refugio Grey',
    kind: 'hut',
    lat: -50.9878,
    lon: -73.2103,
    elev: 120,
    km: 11,
    min: 240,
    sleep: true,
    facilities: ['refugio', 'camping', 'hot shower', 'restaurant', 'kayak/ice trek'],
    net: 'none',
    note: 'Grey Buzulu ve asma köprüler; ertesi gün Paine Grande’ye dönüş.',
  },
  {
    name: 'Campamento Italiano',
    kind: 'camp',
    lat: -51.0083,
    lon: -73.0417,
    elev: 200,
    km: 19,
    min: 360,
    facilities: ['basic camping (kapalı olabilir)', 'ranger'],
    net: 'none',
    note: 'Francés Vadisi girişi; çantalar burada bırakılıp Británico seyir noktasına çıkılır.',
  },
  {
    name: 'Mirador Británico',
    kind: 'viewpoint',
    lat: -50.9614,
    lon: -73.0342,
    elev: 780,
    km: 6,
    min: 180,
    facilities: [],
    net: 'none',
    note: 'Cuernos ve Paine Grande buzul çığları sesi. Rüzgâr 100 km/s’yi aşabilir.',
  },
  {
    name: 'Refugio Los Cuernos / Francés',
    kind: 'hut',
    lat: -51.0261,
    lon: -72.9856,
    elev: 130,
    km: 12,
    min: 240,
    sleep: true,
    facilities: ['refugio', 'camping', 'domes', 'hot shower', 'restaurant'],
    net: 'none',
    note: 'Nordenskjöld gölü kıyısı; Las Torres Patagonia işletmesi.',
  },
  {
    name: 'Refugio Chileno',
    kind: 'hut',
    lat: -50.9575,
    lon: -72.9069,
    elev: 410,
    km: 16,
    min: 360,
    sleep: true,
    facilities: ['refugio', 'camping', 'restaurant', 'lockers'],
    net: 'none',
    note: 'Ascencio vadisi; gün doğumu için 04:00’te kulelere çıkış (1,5–2 saat).',
  },
  {
    name: 'Mirador Base de las Torres',
    kind: 'viewpoint',
    lat: -50.9414,
    lon: -72.9614,
    elev: 900,
    km: 4,
    min: 120,
    facilities: [],
    net: 'none',
    note: 'Üç granit kule ve turkuaz göl; son 45 dk moren kayaları. Kar/buz mevsiminde mikro krampon.',
  },
  {
    name: 'Hotel Las Torres / Welcome Center',
    kind: 'trailhead',
    lat: -50.9744,
    lon: -72.8322,
    elev: 150,
    km: 12,
    min: 240,
    sleep: true,
    facilities: ['hotel', 'camping central', 'restaurant', 'wifi', 'bus stop'],
    net: 'wifi',
    note: 'Laguna Amarga’ya shuttle, oradan Puerto Natales otobüsü 2,5 saat.',
  },
]);

const INCA_ID = 'dest_inca';
const incaStages = stagesOf(INCA_ID, [
  {
    name: 'Km 82 (Piscacucho)',
    kind: 'trailhead',
    lat: -13.2264,
    lon: -72.4247,
    elev: 2720,
    km: 0,
    min: 0,
    facilities: ['checkpoint', 'toilets', 'porter weighing'],
    net: '4g',
    note: 'Cusco’dan otobüs 3 saat; pasaport + permi kontrolü. Porter yükü maks. 20 kg (yasal).',
  },
  {
    name: 'Wayllabamba',
    kind: 'camp',
    lat: -13.2717,
    lon: -72.4467,
    elev: 3000,
    km: 12,
    min: 360,
    sleep: true,
    facilities: ['tents', 'toilets', 'last shop'],
    net: '2g',
    note: 'Llactapata harabeleri yolda; son köy ve son bira.',
  },
  {
    name: 'Dead Woman’s Pass (Warmiwañusca)',
    kind: 'pass',
    lat: -13.3025,
    lon: -72.4911,
    elev: 4215,
    km: 7,
    min: 300,
    facilities: [],
    water: false,
    net: 'none',
    note: 'Rotanın en yüksek ve en zor noktası; 1.200 m tırmanış tek sabahta. Koka çayı ve yavaş tempo.',
  },
  {
    name: 'Pacaymayo',
    kind: 'camp',
    lat: -13.3164,
    lon: -72.5011,
    elev: 3600,
    km: 4,
    min: 120,
    sleep: true,
    facilities: ['tents', 'toilets'],
    net: 'none',
    note: 'Geçit sonrası 600 m iniş; en soğuk gece (0 °C civarı).',
  },
  {
    name: 'Runkurakay Geçidi',
    kind: 'pass',
    lat: -13.3269,
    lon: -72.5147,
    elev: 3950,
    km: 4,
    min: 150,
    facilities: [],
    net: 'none',
    note: 'Runkurakay yuvarlak kalesi ve Sayacmarca harabeleri; İnka taş döşeme yolu başlar.',
  },
  {
    name: 'Wiñay Wayna',
    kind: 'camp',
    lat: -13.1883,
    lon: -72.5342,
    elev: 2650,
    km: 12,
    min: 360,
    sleep: true,
    facilities: ['tents', 'toilets', 'restaurant (kapalı olabilir)'],
    net: 'none',
    note: '“Sonsuz Genç” terasları kampın hemen altında; son gece, 03:30 uyanış.',
  },
  {
    name: 'Inti Punku (Güneş Kapısı)',
    kind: 'viewpoint',
    lat: -13.1672,
    lon: -72.5297,
    elev: 2720,
    km: 5,
    min: 90,
    facilities: [],
    net: 'none',
    note: 'Machu Picchu ilk kez buradan görünür; gün doğumu için kontrol noktası 05:30 açılır.',
  },
  {
    name: 'Machu Picchu',
    kind: 'viewpoint',
    lat: -13.1631,
    lon: -72.545,
    elev: 2430,
    km: 2,
    min: 60,
    facilities: ['toilets', 'restaurant', 'bus to Aguas Calientes'],
    net: '4g',
    note: 'Rehberli tur ~2 saat; sonra otobüsle Aguas Calientes, trenle Ollantaytambo/Cusco.',
  },
]);

/* ------------------------------------------------------------------ */
/* ALPLER                                                              */
/* ------------------------------------------------------------------ */

const TMB_ID = 'dest_tmb';
const tmbStages = stagesOf(TMB_ID, [
  {
    name: 'Les Houches',
    kind: 'trailhead',
    lat: 45.8906,
    lon: 6.7989,
    elev: 1010,
    km: 0,
    min: 0,
    sleep: true,
    facilities: ['hotel', 'gîte', 'supermarket', 'train', 'wifi'],
    net: '4g',
    note: 'Chamonix’den tren 10 dk. Klasik saat yönünün tersi başlangıç.',
  },
  {
    name: 'Les Contamines',
    kind: 'village',
    lat: 45.8228,
    lon: 6.7267,
    elev: 1170,
    km: 16,
    min: 360,
    sleep: true,
    facilities: ['gîte', 'refuge', 'hot shower', 'supermarket', 'wifi'],
    net: '4g',
    note: 'Col de Voza (1653 m) üzerinden; Bellevue teleferiği kısaltma seçeneği.',
  },
  {
    name: 'Refuge de la Croix du Bonhomme',
    kind: 'hut',
    lat: 45.7267,
    lon: 6.7189,
    elev: 2443,
    km: 18,
    min: 420,
    sleep: true,
    facilities: ['refuge', 'half board', 'dorm', 'charging (sınırlı)'],
    net: 'none',
    note: 'Col du Bonhomme (2329 m) ve Croix du Bonhomme (2483 m); haziranda kar yamaları.',
  },
  {
    name: 'Les Chapieux → Refuge Elisabetta',
    kind: 'hut',
    lat: 45.7767,
    lon: 6.8483,
    elev: 2195,
    km: 20,
    min: 420,
    sleep: true,
    facilities: ['refuge', 'half board', 'dorm'],
    net: 'none',
    note: 'Col de la Seigne (2516 m) ile İtalya’ya geçiş; Mont Blanc’ın güney yüzü.',
  },
  {
    name: 'Courmayeur',
    kind: 'village',
    lat: 45.7967,
    lon: 6.9689,
    elev: 1224,
    km: 18,
    min: 360,
    sleep: true,
    rest: true,
    facilities: ['hotel', 'restaurant', 'supermarket', 'gear shops', 'wifi', 'bus'],
    net: '4g',
    note: 'İtalyan yarısı; dinlenme günü ve Skyway Monte Bianco teleferiği için ideal.',
  },
  {
    name: 'Rifugio Bonatti',
    kind: 'hut',
    lat: 45.8386,
    lon: 7.0331,
    elev: 2025,
    km: 12,
    min: 300,
    sleep: true,
    facilities: ['refuge', 'half board', 'dorm', 'hot shower'],
    net: 'none',
    note: 'Grandes Jorasses karşıda; rotanın en sevilen refuge’ü, erken doldurur.',
  },
  {
    name: 'La Fouly',
    kind: 'village',
    lat: 45.9333,
    lon: 7.0947,
    elev: 1600,
    km: 20,
    min: 420,
    sleep: true,
    facilities: ['hotel', 'camping', 'supermarket', 'wifi', 'bus'],
    net: '4g',
    note: 'Grand Col Ferret (2537 m) ile İsviçre. Fiyatlar CHF; kart geçer.',
  },
  {
    name: 'Champex-Lac',
    kind: 'village',
    lat: 45.8319,
    lon: 7.1153,
    elev: 1466,
    km: 15,
    min: 300,
    sleep: true,
    facilities: ['hotel', 'camping', 'lake', 'supermarket'],
    net: '4g',
    note: 'Göl kenarı köyü; Bovine rotası (kolay) ya da Fenêtre d’Arpette (2665 m, zor) seçimi.',
  },
  {
    name: 'Trient',
    kind: 'village',
    lat: 46.0567,
    lon: 7.0006,
    elev: 1300,
    km: 16,
    min: 360,
    sleep: true,
    facilities: ['gîte', 'refuge', 'hot shower'],
    net: '4g',
  },
  {
    name: 'Tré-le-Champ / Argentière',
    kind: 'village',
    lat: 46.0203,
    lon: 6.9389,
    elev: 1417,
    km: 12,
    min: 300,
    sleep: true,
    facilities: ['gîte', 'hotel', 'supermarket', 'train'],
    net: '4g',
    note: 'Col de Balme (2191 m) ile Fransa’ya dönüş; Chamonix vadisi görünür.',
  },
  {
    name: 'Lac Blanc → Chamonix',
    kind: 'viewpoint',
    lat: 45.9822,
    lon: 6.8878,
    elev: 2352,
    km: 18,
    min: 420,
    facilities: ['refuge (Lac Blanc)', 'cable car (Flégère)'],
    net: '4g',
    note: 'Aiguilles Rouges merdivenleri; Mont Blanc masifi tam karşıda. Flégère teleferiği ile Chamonix.',
  },
]);

const HAUTE_ID = 'dest_haute_route';
const hauteStages = stagesOf(HAUTE_ID, [
  {
    name: 'Chamonix',
    kind: 'trailhead',
    lat: 45.9237,
    lon: 6.8694,
    elev: 1035,
    km: 0,
    min: 0,
    sleep: true,
    facilities: ['hotel', 'gear shops', 'train', 'wifi', 'PGHM'],
    net: '4g',
  },
  {
    name: 'Trient',
    kind: 'village',
    lat: 46.0567,
    lon: 7.0006,
    elev: 1300,
    km: 18,
    min: 420,
    sleep: true,
    facilities: ['gîte', 'refuge'],
    net: '4g',
    note: 'Col de Balme üzerinden İsviçre’ye.',
  },
  {
    name: 'Champex-Lac',
    kind: 'village',
    lat: 45.8319,
    lon: 7.1153,
    elev: 1466,
    km: 16,
    min: 360,
    sleep: true,
    facilities: ['hotel', 'camping', 'supermarket'],
    net: '4g',
  },
  {
    name: 'Cabane du Mont Fort',
    kind: 'hut',
    lat: 46.0844,
    lon: 7.2761,
    elev: 2457,
    km: 24,
    min: 480,
    sleep: true,
    facilities: ['hut', 'half board', 'dorm'],
    net: '2g',
    note: 'Le Châble → Verbier teleferiği ile kısaltılabilir. Grand Combin manzarası.',
  },
  {
    name: 'Cabane de Prafleuri',
    kind: 'hut',
    lat: 46.0578,
    lon: 7.3689,
    elev: 2624,
    km: 14,
    min: 420,
    sleep: true,
    facilities: ['hut', 'half board'],
    net: 'none',
    note: 'Üç geçit (Termin, Louvie, Prafleuri 2965 m); rotanın en teknik günü, dağ keçileri.',
  },
  {
    name: 'Arolla',
    kind: 'village',
    lat: 46.0261,
    lon: 7.4839,
    elev: 2006,
    km: 18,
    min: 420,
    sleep: true,
    facilities: ['hotel', 'camping', 'supermarket'],
    net: '4g',
    note: 'Col de Riedmatten (2919 m) ya da Pas de Chèvres merdivenleri.',
  },
  {
    name: 'Cabane de Moiry',
    kind: 'hut',
    lat: 46.1089,
    lon: 7.5836,
    elev: 2825,
    km: 22,
    min: 480,
    sleep: true,
    facilities: ['hut', 'half board', 'glacier view'],
    net: 'none',
    note: 'Moiry Buzulu kenarında modern kulübe; Col de Torrent (2919 m).',
  },
  {
    name: 'Zinal',
    kind: 'village',
    lat: 46.1375,
    lon: 7.6261,
    elev: 1675,
    km: 15,
    min: 360,
    sleep: true,
    facilities: ['hotel', 'supermarket', 'bus'],
    net: '4g',
    note: 'Col de Sorebois (2835 m); teleferikle kısaltma seçeneği.',
  },
  {
    name: 'Europahütte',
    kind: 'hut',
    lat: 46.1372,
    lon: 7.8114,
    elev: 2220,
    km: 30,
    min: 540,
    sleep: true,
    facilities: ['hut', 'half board'],
    net: '2g',
    note: 'Gruben ve Augstbordpass (2894 m) üzerinden St. Niklaus; Europaweg’in kaya düşmesi kapalı kesimleri için güncel durumu sor.',
  },
  {
    name: 'Zermatt',
    kind: 'village',
    lat: 46.0207,
    lon: 7.7491,
    elev: 1608,
    km: 18,
    min: 360,
    sleep: true,
    facilities: ['hotel', 'train', 'Air Zermatt', 'wifi'],
    net: '4g',
    note: 'Charles Kuonen asma köprüsü (494 m) ve Matterhorn ile bitiş.',
  },
]);

/* ------------------------------------------------------------------ */
/* EKSPEDİSYON                                                         */
/* ------------------------------------------------------------------ */

const ACONCAGUA_ID = 'dest_aconcagua';
const aconcaguaStages = stagesOf(ACONCAGUA_ID, [
  {
    name: 'Penitentes / Horcones girişi',
    kind: 'trailhead',
    lat: -32.8167,
    lon: -69.9333,
    elev: 2950,
    km: 0,
    min: 0,
    sleep: true,
    facilities: ['hotel', 'mule service', 'ranger post'],
    net: '4g',
    note: 'Mendoza’dan 3,5 saat; permi Mendoza’da alınır, Horcones’te kontrol edilir.',
  },
  {
    name: 'Confluencia',
    kind: 'camp',
    lat: -32.7333,
    lon: -69.9667,
    elev: 3400,
    km: 8,
    min: 240,
    sleep: true,
    rest: true,
    facilities: ['tents', 'medical post', 'toilets', 'meals'],
    net: 'none',
    note: 'Zorunlu tıbbi kontrol. Aklimatizasyon: Plaza Francia (4200 m, güney duvarı) gidiş-dönüş.',
  },
  {
    name: 'Plaza de Mulas (Ana Kamp)',
    kind: 'base_camp',
    lat: -32.6544,
    lon: -70.0592,
    elev: 4370,
    km: 18,
    min: 540,
    sleep: true,
    rest: true,
    facilities: ['tents', 'medical post', 'wifi (ücretli)', 'hot shower', 'restaurant', 'helipad'],
    net: 'wifi',
    note: 'Dünyanın en büyük ana kamplarından; 2 dinlenme günü, doktor SpO₂ kontrolü. Bonete (5004 m) aklimatizasyon.',
  },
  {
    name: 'Plaza Canadá',
    kind: 'camp',
    lat: -32.6483,
    lon: -70.0347,
    elev: 4910,
    km: 3,
    min: 240,
    sleep: true,
    facilities: ['tents'],
    water: false,
    net: 'none',
    note: 'Kamp 1; yük taşıyıp ana kampa dönüş (carry), sonra yerleşme.',
  },
  {
    name: 'Nido de Cóndores',
    kind: 'camp',
    lat: -32.6467,
    lon: -70.0264,
    elev: 5560,
    km: 3,
    min: 300,
    sleep: true,
    rest: true,
    facilities: ['tents', 'ranger tent'],
    water: false,
    net: 'sat_only',
    note: 'Kamp 2; rüzgâr 80 km/s üstü sık. Buradan zirve denemesi de yapılır.',
  },
  {
    name: 'Cólera (Kamp 3)',
    kind: 'camp',
    lat: -32.6486,
    lon: -70.0181,
    elev: 5970,
    km: 2,
    min: 240,
    sleep: true,
    facilities: ['tents'],
    water: false,
    net: 'none',
    note: 'Zirve günü 04:00 çıkış; Independencia kulübesi (6400 m), Gran Acarreo, Canaleta.',
  },
  {
    name: 'Aconcagua Zirvesi',
    kind: 'summit',
    lat: -32.6532,
    lon: -70.0109,
    elev: 6961,
    km: 3,
    min: 540,
    facilities: [],
    water: false,
    net: 'none',
    note: 'Amerika kıtasının çatısı. 14:00 dönüş saatini geçme; Canaleta’da kaya düşmesi.',
  },
  {
    name: 'Plaza de Mulas (dönüş)',
    kind: 'base_camp',
    lat: -32.6544,
    lon: -70.0592,
    elev: 4370,
    km: 8,
    min: 420,
    sleep: true,
    facilities: ['tents', 'medical post', 'restaurant'],
    net: 'wifi',
  },
  {
    name: 'Horcones (çıkış)',
    kind: 'trailhead',
    lat: -32.8167,
    lon: -69.9333,
    elev: 2950,
    km: 26,
    min: 540,
    facilities: ['ranger post', 'transport'],
    net: '4g',
    note: 'Tek günde ana kamptan çıkış (26 km); katırlar ekipmanı taşır.',
  },
]);

const ELBRUS_ID = 'dest_elbrus';
const elbrusStages = stagesOf(ELBRUS_ID, [
  {
    name: 'Terskol',
    kind: 'trailhead',
    lat: 43.2556,
    lon: 42.5139,
    elev: 2100,
    km: 0,
    min: 0,
    sleep: true,
    facilities: ['hotel', 'gear rental', 'MChS rescue', 'wifi'],
    net: '4g',
    note: 'Mineralnye Vody havalimanından 3 saat. Cheget (3000 m) aklimatizasyon yürüyüşü.',
  },
  {
    name: 'Azau → Garabashi (Barrels)',
    kind: 'hut',
    lat: 43.3011,
    lon: 42.4736,
    elev: 3850,
    km: 5,
    min: 60,
    sleep: true,
    rest: true,
    facilities: ['barrel huts', 'kitchen', 'toilets', 'charging'],
    net: '2g',
    note: 'Üç teleferik + snowcat; “Bochki” varilleri. Aklimatizasyon: Priyut 11’e (4100 m) yürüyüş.',
  },
  {
    name: 'Pastukhov Kayaları',
    kind: 'viewpoint',
    lat: 43.3239,
    lon: 42.4661,
    elev: 4700,
    km: 4,
    min: 240,
    facilities: [],
    water: false,
    net: 'none',
    note: 'Aklimatizasyon günü hedefi; zirve gecesi snowcat ile buraya çıkılır (ücretli).',
  },
  {
    name: 'Elbrus Batı Zirvesi',
    kind: 'summit',
    lat: 43.3499,
    lon: 42.4453,
    elev: 5642,
    km: 6,
    min: 480,
    facilities: [],
    water: false,
    net: 'none',
    note: 'Sedlovina (5300 m) eyer, ardından batı zirveye traverse; sabit ip kesimi. Avrupa’nın çatısı.',
  },
  {
    name: 'Garabashi (dönüş)',
    kind: 'hut',
    lat: 43.3011,
    lon: 42.4736,
    elev: 3850,
    km: 10,
    min: 240,
    sleep: true,
    facilities: ['barrel huts', 'kitchen'],
    net: '2g',
  },
  {
    name: 'Terskol (dönüş)',
    kind: 'trailhead',
    lat: 43.2556,
    lon: 42.5139,
    elev: 2100,
    km: 5,
    min: 60,
    sleep: true,
    facilities: ['hotel', 'wifi'],
    net: '4g',
  },
]);

/* ------------------------------------------------------------------ */
/* TÜRKİYE                                                             */
/* ------------------------------------------------------------------ */

const AGRI_ID = 'dest_agri';
const agriStages = stagesOf(AGRI_ID, [
  {
    name: 'Doğubayazıt',
    kind: 'trailhead',
    lat: 39.5472,
    lon: 44.0847,
    elev: 1650,
    km: 0,
    min: 0,
    sleep: true,
    facilities: ['hotel', 'market', 'hospital', 'ATM', 'wifi'],
    net: '4g',
    note: 'İshak Paşa Sarayı ziyareti. İzin belgesi ve rehber acentesi burada.',
  },
  {
    name: 'Eli Köyü',
    kind: 'village',
    lat: 39.6367,
    lon: 44.2367,
    elev: 2200,
    km: 22,
    min: 60,
    facilities: ['minibus/jeep stand', 'mules', 'tea'],
    net: '4g',
    note: 'Jeep ile 1 saat; katır yükleme (kişi başı ~15 kg). Yürüyüş buradan başlar.',
  },
  {
    name: '1. Kamp (Yeşil Kamp)',
    kind: 'camp',
    lat: 39.6667,
    lon: 44.2667,
    elev: 3200,
    km: 7,
    min: 240,
    sleep: true,
    rest: true,
    facilities: ['tents', 'spring water', 'mule station'],
    net: '2g',
    note: 'Çimenlik plato, kaynak suyu. Aklimatizasyon: 2. kampa yük taşıyıp dönüş.',
  },
  {
    name: '2. Kamp (Mıhtepe)',
    kind: 'camp',
    lat: 39.6861,
    lon: 44.2833,
    elev: 4200,
    km: 4,
    min: 240,
    sleep: true,
    facilities: ['tents', 'melt water'],
    water: false,
    net: 'none',
    note: 'Taşlık kamp, rüzgârlı; su kar eritilerek. 18:00 uyku, 02:00 çıkış.',
  },
  {
    name: 'Ağrı Dağı Zirvesi',
    kind: 'summit',
    lat: 39.7019,
    lon: 44.2983,
    elev: 5137,
    km: 3.5,
    min: 360,
    facilities: [],
    water: false,
    net: 'none',
    note: '4.800 m’den itibaren buzul; krampon-kazma zorunlu. Türkiye’nin çatısı, İran ve Ermenistan ovaları.',
  },
  {
    name: '1. Kamp (dönüş)',
    kind: 'camp',
    lat: 39.6667,
    lon: 44.2667,
    elev: 3200,
    km: 7.5,
    min: 300,
    sleep: true,
    facilities: ['tents', 'spring water'],
    net: '2g',
    note: 'Aynı gün zirveden 2. kampa iniş, toplanıp 1. kampa devam. Ertesi gün Eli Köyü + Doğubayazıt.',
  },
]);

const KACKAR_ID = 'dest_kackar';
const kackarStages = stagesOf(KACKAR_ID, [
  {
    name: 'Ayder Yaylası',
    kind: 'trailhead',
    lat: 40.9506,
    lon: 41.1024,
    elev: 1350,
    km: 0,
    min: 0,
    sleep: true,
    facilities: ['pension', 'hot spring', 'restaurant', 'market', 'wifi'],
    net: '4g',
    note: 'Pazar/Çamlıhemşin’den minibüs. Kaplıca ve Rize çayı; dolmuş ile Yukarı Kavrun.',
  },
  {
    name: 'Yukarı Kavrun Yaylası',
    kind: 'village',
    lat: 40.8886,
    lon: 41.1494,
    elev: 2300,
    km: 14,
    min: 60,
    sleep: true,
    facilities: ['pension', 'tea house', 'mule/porter', 'charging'],
    net: '2g',
    note: 'Jeep/dolmuş 45 dk. Yayla evlerinde konaklama; son sinyal ve son sıcak yemek.',
  },
  {
    name: 'Dilberdüzü',
    kind: 'camp',
    lat: 40.8462,
    lon: 41.1589,
    elev: 3050,
    km: 6,
    min: 210,
    sleep: true,
    facilities: ['tents', 'stream', 'ranger (yaz)'],
    net: 'none',
    note: 'Geniş çimen kamp alanı, dere suyu. Ağustos hafta sonları kalabalık; sabah sisi.',
  },
  {
    name: 'Deniz Gölü',
    kind: 'camp',
    lat: 40.8325,
    lon: 41.1653,
    elev: 3400,
    km: 2,
    min: 120,
    sleep: true,
    facilities: ['tents (sınırlı)', 'lake water'],
    net: 'none',
    note: 'Zirve gecesi kampı; buzul gölü. 03:00 çıkış, kar-kaya karışık.',
  },
  {
    name: 'Kaçkar Zirvesi',
    kind: 'summit',
    lat: 40.8321,
    lon: 41.1594,
    elev: 3937,
    km: 2.5,
    min: 240,
    facilities: [],
    water: false,
    net: 'none',
    note: 'Son bölüm kolay tırmanış (UIAA I–II); Karadeniz ve Verçenik manzarası. Öğle bulutu gelmeden in.',
  },
  {
    name: 'Dilberdüzü (dönüş)',
    kind: 'camp',
    lat: 40.8462,
    lon: 41.1589,
    elev: 3050,
    km: 4.5,
    min: 180,
    sleep: true,
    facilities: ['tents', 'stream'],
    net: 'none',
  },
  {
    name: 'Yukarı Kavrun (dönüş)',
    kind: 'village',
    lat: 40.8886,
    lon: 41.1494,
    elev: 2300,
    km: 6,
    min: 150,
    facilities: ['pension', 'tea house'],
    net: '2g',
    note: 'Aynı gün Ayder kaplıcaları. Alternatif: Olgunlar tarafına geçiş (Kaçkar traversi).',
  },
]);

const LIKYA_ID = 'dest_likya';
const likyaStages = stagesOf(LIKYA_ID, [
  {
    name: 'Ovacık (Fethiye)',
    kind: 'trailhead',
    lat: 36.5522,
    lon: 29.1153,
    elev: 300,
    km: 0,
    min: 0,
    sleep: true,
    facilities: ['pension', 'market', 'ATM', 'wifi'],
    net: '4g',
    note: 'Klasik başlangıç; Babadağ ve Ölüdeniz manzarasıyla açılış.',
  },
  {
    name: 'Faralya',
    kind: 'village',
    lat: 36.4936,
    lon: 29.1364,
    elev: 400,
    km: 15,
    min: 330,
    sleep: true,
    facilities: ['pension', 'restaurant', 'wifi'],
    net: '4g',
    note: 'Kelebekler Vadisi üstü; iniş dik ve halatlı, deneyimsizsen inme.',
  },
  {
    name: 'Kabak Koyu',
    kind: 'village',
    lat: 36.4589,
    lon: 29.1369,
    elev: 120,
    km: 7,
    min: 180,
    sleep: true,
    facilities: ['camping', 'bungalow', 'beach', 'restaurant'],
    net: '4g',
  },
  {
    name: 'Alınca',
    kind: 'village',
    lat: 36.4189,
    lon: 29.1928,
    elev: 800,
    km: 9,
    min: 270,
    sleep: true,
    facilities: ['pension', 'home food'],
    net: '2g',
    note: 'Kabak’tan 700 m dik tırmanış; köy evinde konaklama, yıldızlı gece.',
  },
  {
    name: 'Patara',
    kind: 'village',
    lat: 36.2661,
    lon: 29.3161,
    elev: 20,
    km: 30,
    min: 600,
    sleep: true,
    facilities: ['pension', 'beach', 'ruins', 'market'],
    net: '4g',
    note: '18 km plaj ve Likya Birliği meclis binası; Xanthos-Letoon UNESCO alanları yakında.',
  },
  {
    name: 'Kalkan → Kaş',
    kind: 'village',
    lat: 36.2019,
    lon: 29.6392,
    elev: 30,
    km: 28,
    min: 540,
    sleep: true,
    facilities: ['hotel', 'restaurant', 'diving', 'ATM', 'wifi'],
    net: '4g',
    note: 'Bezirgan yaylası üzerinden Kalkan, kıyı boyunca Kaş. Dinlenme günü ve dalış için ideal.',
  },
  {
    name: 'Üçağız / Simena (Kekova)',
    kind: 'village',
    lat: 36.1953,
    lon: 29.8564,
    elev: 10,
    km: 26,
    min: 480,
    sleep: true,
    facilities: ['pension', 'boat tours', 'restaurant'],
    net: '4g',
    note: 'Aperlai ve batık şehir; kayıkla Kekova turu.',
  },
  {
    name: 'Demre (Myra)',
    kind: 'village',
    lat: 36.2444,
    lon: 29.9856,
    elev: 30,
    km: 22,
    min: 420,
    sleep: true,
    facilities: ['hotel', 'market', 'bus'],
    net: '4g',
    note: 'Kaya mezarları ve Aziz Nikolaos Kilisesi; rota Finike üzerinden Adrasan’a devam eder.',
  },
  {
    name: 'Adrasan',
    kind: 'village',
    lat: 36.3111,
    lon: 30.4747,
    elev: 10,
    km: 45,
    min: 900,
    sleep: true,
    facilities: ['pension', 'beach', 'camping'],
    net: '4g',
    note: 'Finike–Karaöz sahil ve Gelidonya feneri; Adrasan koyu.',
  },
  {
    name: 'Olimpos / Çıralı',
    kind: 'village',
    lat: 36.4136,
    lon: 30.4756,
    elev: 20,
    km: 14,
    min: 360,
    sleep: true,
    facilities: ['bungalow', 'beach', 'ruins', 'restaurant'],
    net: '4g',
    note: 'Musa Dağı geçişi; Olimpos antik kenti ve Yanartaş (Chimaera) gece ateşleri.',
  },
  {
    name: 'Tahtalı (Olimpos) Dağı',
    kind: 'summit',
    lat: 36.5433,
    lon: 30.4433,
    elev: 2366,
    km: 24,
    min: 660,
    facilities: ['cable car', 'cafe'],
    water: false,
    net: '4g',
    note: 'Rotanın en yüksek noktası (isteğe bağlı); Beycik üzerinden tırmanış, teleferikle iniş mümkün.',
  },
  {
    name: 'Göynük Kanyonu → Hisarçandır (Antalya)',
    kind: 'trailhead',
    lat: 36.6744,
    lon: 30.5347,
    elev: 400,
    km: 30,
    min: 600,
    facilities: ['bus', 'canyon park'],
    net: '4g',
    note: 'Resmî bitiş Antalya Hisarçandır; Göynük’ten Kemer/Antalya otobüsü.',
  },
]);

const KAPADOKYA_ID = 'dest_kapadokya';
const kapadokyaStages = stagesOf(KAPADOKYA_ID, [
  {
    name: 'Göreme',
    kind: 'trailhead',
    lat: 38.6431,
    lon: 34.8289,
    elev: 1100,
    km: 0,
    min: 0,
    sleep: true,
    facilities: ['cave hotel', 'restaurant', 'ATM', 'balloon companies', 'wifi', 'bus'],
    net: '4g',
    note: 'Merkez üs; Nevşehir/Kayseri havalimanından shuttle 1 saat.',
  },
  {
    name: 'Kızılçukur (Rose) & Meskendir Vadisi',
    kind: 'viewpoint',
    lat: 38.6553,
    lon: 34.8508,
    elev: 1200,
    km: 6,
    min: 180,
    facilities: ['cafe', 'tea garden'],
    net: '4g',
    note: 'Gün batımı kırmızı-pembe kayalar; Kolonlu Kilise ve Haçlı Kilise.',
  },
  {
    name: 'Çavuşin',
    kind: 'village',
    lat: 38.6686,
    lon: 34.8397,
    elev: 1150,
    km: 3,
    min: 60,
    sleep: true,
    facilities: ['pension', 'cafe', 'church'],
    net: '4g',
    note: 'Terkedilmiş kaya köyü; Vaftizci Yahya Kilisesi.',
  },
  {
    name: 'Paşabağı & Zelve',
    kind: 'viewpoint',
    lat: 38.6786,
    lon: 34.8536,
    elev: 1180,
    km: 5,
    min: 150,
    facilities: ['museum', 'toilets', 'cafe'],
    net: '4g',
    note: 'Peri bacaları ve Zelve açık hava müzesi (ücretli).',
  },
  {
    name: 'Ihlara Vadisi (Belisırma)',
    kind: 'village',
    lat: 38.2469,
    lon: 34.2953,
    elev: 1150,
    km: 80,
    min: 240,
    sleep: true,
    facilities: ['pension', 'riverside restaurant', 'museum entrance'],
    net: '4g',
    note: 'Melendiz Çayı boyunca 14 km; Ihlara→Belisırma→Selime. Araçla 1,5 saat.',
  },
  {
    name: 'Güvercinlik Vadisi → Uçhisar',
    kind: 'viewpoint',
    lat: 38.6286,
    lon: 34.8069,
    elev: 1350,
    km: 5,
    min: 120,
    facilities: ['castle', 'cafe', 'viewpoint'],
    net: '4g',
    note: 'Göreme’den Uçhisar Kalesi’ne yumuşak tırmanış; en yüksek doğal seyir noktası.',
  },
  {
    name: 'Aşıklar Tepesi (balon seyri)',
    kind: 'viewpoint',
    lat: 38.6386,
    lon: 34.8256,
    elev: 1180,
    km: 3,
    min: 45,
    facilities: ['sunrise viewpoint'],
    net: '4g',
    note: '05:00 balon kalkışı; balonla uçuş ~1 saat (~€200–260), rüzgâr iptalleri sık.',
  },
  {
    name: 'Ortahisar Kalesi',
    kind: 'viewpoint',
    lat: 38.6222,
    lon: 34.8631,
    elev: 1200,
    km: 6,
    min: 150,
    facilities: ['castle', 'cafe'],
    net: '4g',
    note: 'Kaya tırmanışı (sport, 5b–7a) için Ortahisar ve Kızılçukur sektörleri; kask şart.',
  },
]);

/* ------------------------------------------------------------------ */
/* EK: PATAGONYA / KAŞ                                                 */
/* ------------------------------------------------------------------ */

const CHALTEN_ID = 'dest_el_chalten';
const chaltenStages = stagesOf(CHALTEN_ID, [
  {
    name: 'El Chaltén',
    kind: 'trailhead',
    lat: -49.3315,
    lon: -72.8864,
    elev: 400,
    km: 0,
    min: 0,
    sleep: true,
    facilities: ['hostel', 'camping', 'restaurant', 'ATM (sınırlı)', 'ranger office', 'wifi'],
    net: '4g',
    note: 'El Calafate’den otobüs 3 saat. Kayıt ve hava durumu için ranger ofisi.',
  },
  {
    name: 'Laguna Capri',
    kind: 'camp',
    lat: -49.3019,
    lon: -72.9411,
    elev: 780,
    km: 5,
    min: 120,
    sleep: true,
    facilities: ['free camping', 'toilets', 'lake water'],
    net: 'none',
    note: 'Fitz Roy gün doğumu kampı; rüzgârdan korunaklı ağaçlık alan.',
  },
  {
    name: 'Campamento Poincenot',
    kind: 'camp',
    lat: -49.2933,
    lon: -72.9647,
    elev: 730,
    km: 5,
    min: 90,
    sleep: true,
    facilities: ['free camping', 'toilets', 'river water'],
    net: 'none',
    note: 'Laguna de los Tres’e 1 saat; 04:30 çıkış.',
  },
  {
    name: 'Laguna de los Tres',
    kind: 'viewpoint',
    lat: -49.2917,
    lon: -73.0022,
    elev: 1170,
    km: 2,
    min: 75,
    facilities: [],
    net: 'none',
    note: 'Fitz Roy ana yüzü 400 m dik tırmanışla; kar/buzda kapatılabilir.',
  },
  {
    name: 'Campamento De Agostini',
    kind: 'camp',
    lat: -49.3283,
    lon: -73.0086,
    elev: 690,
    km: 10,
    min: 240,
    sleep: true,
    facilities: ['free camping', 'toilets'],
    net: 'none',
    note: 'Laguna Madre e Hija üzerinden; Cerro Torre karşıda.',
  },
  {
    name: 'Laguna Torre & Mirador Maestri',
    kind: 'viewpoint',
    lat: -49.3211,
    lon: -73.0369,
    elev: 720,
    km: 4,
    min: 120,
    facilities: [],
    net: 'none',
    note: 'Buzdağlı göl; Cerro Torre (3128 m) rüzgârı bulutlara sarmışsa sabır.',
  },
  {
    name: 'El Chaltén (dönüş)',
    kind: 'trailhead',
    lat: -49.3315,
    lon: -72.8864,
    elev: 400,
    km: 9,
    min: 180,
    sleep: true,
    facilities: ['hostel', 'restaurant', 'wifi'],
    net: '4g',
  },
]);

const KAS_ID = 'dest_kas';
const kasStages = stagesOf(KAS_ID, [
  {
    name: 'Kaş Limanı',
    kind: 'trailhead',
    lat: 36.1994,
    lon: 29.6386,
    elev: 0,
    km: 0,
    min: 0,
    sleep: true,
    facilities: ['dive centers', 'hotel', 'restaurant', 'ATM', 'hyperbaric chamber (Antalya)'],
    net: '4g',
    note: '25+ dalış merkezi; SSI/PADI kursları. Antalya havalimanından 3 saat.',
  },
  {
    name: 'Flying Fish batığı',
    kind: 'viewpoint',
    lat: 36.1783,
    lon: 29.6189,
    elev: -60,
    km: 3,
    min: 45,
    facilities: ['wreck (Bristol Beaufighter, 1943)'],
    net: 'none',
    note: 'İkinci Dünya Savaşı uçak batığı; 60 m, teknik dalış (trimix) gerektirir.',
  },
  {
    name: 'Dimitri batığı',
    kind: 'viewpoint',
    lat: 36.1903,
    lon: 29.6297,
    elev: -18,
    km: 2,
    min: 40,
    facilities: ['wreck', 'shallow'],
    net: 'none',
    note: '1968 yük gemisi; 5–30 m, başlangıç ve wreck dalışları için ideal.',
  },
  {
    name: 'Uluburun Batığı replikası',
    kind: 'viewpoint',
    lat: 36.1614,
    lon: 29.6836,
    elev: -25,
    km: 6,
    min: 45,
    facilities: ['replica wreck (bronz çağı)'],
    net: 'none',
    note: 'Tunç Çağı gemisi replikası; 16–30 m.',
  },
  {
    name: 'Kanyon (Canyon) & Neptün',
    kind: 'viewpoint',
    lat: 36.1697,
    lon: 29.6511,
    elev: -35,
    km: 4,
    min: 50,
    facilities: ['canyon', 'caves'],
    net: 'none',
    note: 'Duvar dalışı, 18–40 m; deniz kaplumbağası ve orfoz.',
  },
  {
    name: 'Kalkan Mavi Mağara & Sıçan Adası',
    kind: 'viewpoint',
    lat: 36.2325,
    lon: 29.4139,
    elev: -20,
    km: 22,
    min: 60,
    facilities: ['cave', 'boat'],
    net: 'none',
    note: 'Tekneyle 1 saat; mağara girişi 5–20 m, kalkan ve mürenler.',
  },
]);

/* ------------------------------------------------------------------ */
/* DESTİNASYONLAR                                                      */
/* ------------------------------------------------------------------ */

const UPDATED = daysAgo(12);

export const seedDestinations: Destination[] = [
  {
    id: EBC_ID,
    slug: 'everest-base-camp-trek',
    name: 'Everest Base Camp Trek',
    region: 'Khumbu, Solukhumbu',
    countryCode: 'NP',
    type: 'trek',
    adventureTypes: ['hiking'],
    coords: { latitude: 27.9881, longitude: 86.8253 },
    imageUrl: unsplash('1544735716-392fe2489ffa'),
    summary:
      'Lukla’dan Khumbu vadisi boyunca Sherpa köyleri, manastırlar ve buzul morenleri üzerinden Everest Ana Kampı (5364 m) ve Kala Patthar (5545 m). Dünyanın en ünlü teahouse treki.',
    guide: `Nasıl gidilir
İstanbul’dan Kathmandu’ya aktarmalı uçuşlar (Doha, Dubai ya da Delhi üzerinden) 9–12 saat sürer. Kathmandu’dan Lukla’ya 35 dakikalık uçuş rotanın kapısıdır; ancak yoğun sezonda (Mart–Mayıs ve Ekim–Kasım) hava trafiğini azaltmak için uçuşlar Ramechhap/Manthali havalimanından kalkar. Manthali Kathmandu’ya 4–5 saat karayolu mesafesindedir ve uçuşlar sabah 06:00–09:00 arasında toplanır; bu yüzden gece 02:00’de yola çıkan jeep transferleri normaldir. Hava kapanınca Lukla uçuşları günlerce iptal olabilir: dönüş için mutlaka 2 gün tampon bırakın, helikopter paylaşımı (kişi başı ~500 USD) acil planınız olsun.

Ne zaman
Ekim–Kasım en berrak gökyüzü ve en kalabalık dönemdir; Mart–Mayıs rododendron çiçekleri ve ekspedisyon sezonuyla ikinci tercih. Aralık–Şubat çok soğuk (Gorak Shep’te -20 °C) ama sakin; Haziran–Eylül muson nedeniyle uçuş iptalleri ve sülük. Kasım başı ideal denge.

İzinler
Sagarmatha Milli Parkı giriş ücreti (Monjo’da, ~3.000 NPR) ve Khumbu Pasang Lhamu Kırsal Belediyesi izni (Lukla’da, ~3.000 NPR). TIMS kartı bu bölgede istenmez. Pasaport fotokopisi ve iki fotoğraf yanınızda olsun. 2023’ten beri yalnız yürüyüş resmen yasak olsa da Khumbu’da uygulama esnektir; yine de rehber ya da porter tutmak hem güvenlik hem yerel ekonomi için doğru seçim.

Konaklama
Tüm rota teahouse’lardan oluşur: odalar 2 kişilik, tahta yatak, ince yastık; yemek yediğiniz sürece oda neredeyse bedava (Gorak Shep’te 500–1.000 NPR). Namche’de sıcak duş, fırın, Wi-Fi ve ATM var; yukarı çıktıkça şarj ve sıcak su ücretli olur (300–500 NPR). Dingboche ve üstünde Everest Link Wi-Fi kartı (10 GB ~3.000 NPR) tek internet seçeneğidir. Yüksek sezonda Lobuche ve Gorak Shep’te yer bulmak için rehberler sabah telefon eder; tek başınaysanız 13:00’ten önce varın.

Aklimatizasyon
Standart 12 günlük plan iki dinlenme günü içerir: Namche (3440 m) ve Dingboche (4410 m). Bu günlerde “yüksek tırman, alçak uyu” kuralıyla Everest View Hotel ya da Nangkartshang tepesine çıkılır. Uyku irtifasını günde 500 m’den fazla artırmayın; Tengboche–Dingboche (550 m) ve Dingboche–Lobuche (530 m) sınırdadır. Pheriche HRA kliniği her öğleden sonra 15:00’te ücretsiz AMS semineri verir ve pulse oksimetreyle ölçüm yapar. Diamox (asetazolamid) profilaksisi için doktorunuza danışın.

Bütçe
Lukla uçuşu gidiş-dönüş ~360 USD, teahouse + yemek günde 30–45 USD (yukarıda pahalı: dal bhat 900 NPR, su 400 NPR). Rehber günde 30–40 USD, porter 20–25 USD. Toplam 12 gün için ekonomik 60.000 ₺, konforlu (lodge upgrade, helikopter dönüş) 150.000 ₺ civarı; uluslararası uçuş hariç.

Riskler
AMS her yıl helikopter tahliyesinin ana nedenidir; HAPE/HACE belirtilerinde (dinlenirken nefes darlığı, denge kaybı) hemen inin. Kasım sonrası patikalarda buz, Thukla geçidi rüzgârı, yak kervanlarına dağ tarafından yol verme kuralı. Khumbu öksürüğü (kuru hava) için buff ve pastil. Hırsızlık nadirdir ama teahouse odaları kilitlenmez.

Bağlantı & para
Namche ve Lukla’da ATM (sık bozulur, Kathmandu’dan nakit NPR alın). NCell 4G Namche’ye kadar, sonrası noktasal. Sigortanızın 6.000 m’ye kadar helikopter kurtarma kapsadığını yazılı doğrulayın; tahliye faturası 5.000 USD’ye ulaşır.`,
    maxElevationM: 5545,
    typicalDays: 12,
    totalDistanceKm: 130,
    difficulty: 'hard',
    bestMonths: [3, 4, 5, 10, 11],
    transports: [
      {
        mode: 'flight',
        from: 'İstanbul (IST)',
        to: 'Kathmandu (KTM)',
        durationMin: 660,
        costTry: 34000,
        note: 'Aktarmalı (DOH/DXB/DEL). Gidiş-dönüş, ekonomi.',
      },
      {
        mode: 'jeep',
        from: 'Kathmandu',
        to: 'Ramechhap / Manthali',
        durationMin: 270,
        costTry: 1200,
        note: 'Yoğun sezonda Lukla uçuşları buradan kalkar; gece 02:00 çıkış.',
      },
      {
        mode: 'flight',
        from: 'Manthali / Kathmandu',
        to: 'Lukla (LUA)',
        durationMin: 25,
        costTry: 7800,
        note: 'Tek yön, Tara/Summit Air; 15 kg bagaj sınırı. Hava iptali sık.',
      },
      {
        mode: 'trek',
        from: 'Lukla',
        to: 'Everest Base Camp',
        durationMin: 4200,
        costTry: null,
        note: '8 gün çıkış, 3 gün iniş.',
      },
    ],
    permits: [
      {
        name: 'Sagarmatha Milli Parkı giriş',
        costTry: 900,
        where: 'Monjo kontrol noktası ya da Kathmandu NTB ofisi',
        note: '3.000 NPR; pasaport gerekli.',
      },
      {
        name: 'Khumbu Pasang Lhamu Kırsal Belediyesi izni',
        costTry: 900,
        where: 'Lukla giriş kapısı',
        note: '3.000 NPR (ilk 4 hafta). TIMS istenmez.',
      },
    ],
    budgetTry: { low: 60000, high: 150000 },
    risks: [
      'Akut dağ hastalığı (AMS) — Lobuche/Gorak Shep’te en sık',
      'HAPE/HACE: dinlenirken nefes darlığı, ataksi → hemen iniş',
      'Lukla uçuş iptalleri ve hava kaynaklı program kayması',
      'Kasım sonrası buzlu patika; Thukla geçidinde şiddetli rüzgâr',
      'Khumbu öksürüğü ve mide enfeksiyonları (su arıtımı şart)',
      'Yalnız yürüyüş kısıtı (Nepal 2023 rehber kuralı)',
    ],
    gear: [
      '-15 °C uyku tulumu (teahouse battaniyesi yetmez)',
      'Kaz tüyü mont + hardshell',
      'Kategori 4 güneş gözlüğü, 50+ krem',
      'Su arıtma tableti / filtre, 2 L kapasite',
      'Baş lambası + yedek pil (soğukta çabuk biter)',
      'Power bank 20.000 mAh',
      'Buff (Khumbu öksürüğü için)',
      'Mikro krampon (Kasım–Mart)',
      'Pulse oksimetre, kişisel ilaçlar',
    ],
    rescueNote:
      'HRA Pheriche kliniği (4371 m) Mart–Mayıs ve Ekim–Kasım açıktır; Kunde Hastanesi (3840 m) yıl boyu. Helikopter tahliyesi sigorta ön onayıyla Lukla/Kathmandu’ya yapılır (CIWEC Klinik). Acil: Nepal 100/102, rehber şirketi veya HRA Kathmandu +977 1 4440292.',
    insuranceRequired: true,
    stageCount: ebcStages.length,
    rating: 4.9,
    reviewCount: 1840,
    sources: [
      'https://en.wikivoyage.org/wiki/Everest_Base_Camp_Trek',
      'https://ntb.gov.np',
      'https://www.himalayanrescue.org.np',
      'https://www.nepalimmigration.gov.np/page/trekking-permit',
    ],
    updatedAt: UPDATED,
  },
  {
    id: ANNAPURNA_ID,
    slug: 'annapurna-circuit',
    name: 'Annapurna Circuit',
    region: 'Manang – Mustang',
    countryCode: 'NP',
    type: 'trek',
    adventureTypes: ['hiking'],
    coords: { latitude: 28.7908, longitude: 83.9358 },
    imageUrl: unsplash('1585409677983-0f6c41ca9c3b'),
    summary:
      'Subtropik Marsyangdi vadisinden Tibet platosu benzeri Manang’a, Thorong La (5416 m) üzerinden Muktinath ve Kali Gandaki’ye. Dünyanın en çeşitli manzaralı klasik turu.',
    guide: `Nasıl gidilir
Kathmandu’dan Besisahar’a turist otobüsü 6–8 saat (Gongabu terminali, ~1.200 NPR). Jeep yolu artık Manang’a kadar uzandığı için çoğu yürüyüşçü Besisahar’dan Chame ya da Dharapani’ye paylaşımlı jeep (5–6 saat, 2.500–4.000 NPR) alır ve rotayı 10–12 güne sıkıştırır. Klasik “tam tur” isteyenler Ngadi ya da Jagat’tan yürümeye başlar. Dönüşte Jomsom’dan Pokhara’ya 20 dakikalık sabah uçuşu ya da 8–10 saatlik jeep vardır.

Ne zaman
Ekim–Kasım berrak ve kuru, Thorong La geçişi için en güvenli; Mart–Nisan ikinci sezon, aşağı vadilerde rododendron. Aralık–Şubat geçit sık sık karla kapanır, Kasım 2014 fırtınası gibi ani kar olayları her mevsim mümkündür. Muson (Haziran–Eylül) Manang’ın yağmur gölgesi sayesinde yürünebilir ama jeep yolları heyelanlıdır.

İzinler
ACAP (Annapurna Koruma Alanı) izni 3.000 NPR ve TIMS kartı 2.000 NPR; ikisi de Kathmandu (Bhrikutimandap) ya da Pokhara NTB ofisinden alınır. Besisahar, Chame ve Muktinath kontrol noktalarında damgalanır. 2023 rehber kuralı burada uygulanır: kontrol noktaları rehbersiz yürüyüşçüyü geri çevirebilir.

Konaklama
Teahouse standardı Everest bölgesinden biraz daha iyidir: Manang’da sıcak duş, fırın, sinema (dağ filmi + patlamış mısır), Wi-Fi. Yak Kharka ve Thorong Phedi basittir; High Camp (4850 m) yalnızca iyi aklimatize olanlar için. Muktinath ve Jomsom’da otel konforu, kaplıca Tatopani’de.

Aklimatizasyon
Chame’den (2670 m) sonra günlük uyku irtifası artışı 500 m’yi aşmamalı: Upper Pisang (3300 m), Manang (3540 m) ve Manang’da mutlaka bir dinlenme günü. Ice Lake (4600 m) gidiş-dönüşü klasik aklimatizasyon yürüyüşüdür. HRA Manang kliniği 15:00’te günlük seminer ve SpO₂ ölçümü yapar. Yak Kharka (4050 m) ve Thorong Phedi (4450 m) ara durakları geçit öncesi son basamaklardır; belirti varsa Phedi’de fazladan gece.

Bütçe
Günlük teahouse + yemek 25–40 USD; jeep transferleri 40–60 USD; Jomsom–Pokhara uçuşu ~130 USD. Rehber 30–40 USD/gün. 12 gün için 45.000–110.000 ₺ arası; uluslararası uçuş hariç.

Riskler
Thorong La’da rüzgâr ve donma; 04:00 çıkış, 10:00’dan sonra geçit rüzgârı sertleşir. Muktinath inişi 1.650 m — diz koruması ve baton. Kali Gandaki vadisinde öğleden sonra kum fırtınası benzeri rüzgâr. Jeep yollarında heyelan. Su arıtımı şart; Manang’da giardia yaygındır.

Bağlantı & para
Chame ve Jomsom’da ATM; Manang’da bazen çalışır — nakit NPR taşıyın. NCell 4G Manang’a kadar, Wi-Fi çoğu teahouse’ta ücretli. Sigortada 6.000 m helikopter kapsamı isteyin; Manang ve Muktinath helikopter pistleri sık kullanılır.`,
    maxElevationM: 5416,
    typicalDays: 12,
    totalDistanceKm: 160,
    difficulty: 'hard',
    bestMonths: [3, 4, 10, 11],
    transports: [
      {
        mode: 'flight',
        from: 'İstanbul (IST)',
        to: 'Kathmandu (KTM)',
        durationMin: 660,
        costTry: 34000,
        note: 'Aktarmalı, gidiş-dönüş.',
      },
      {
        mode: 'bus',
        from: 'Kathmandu (Gongabu)',
        to: 'Besisahar',
        durationMin: 420,
        costTry: 450,
        note: 'Turist otobüsü 07:00; yerel otobüs daha ucuz ve yavaş.',
      },
      {
        mode: 'jeep',
        from: 'Besisahar',
        to: 'Chame',
        durationMin: 330,
        costTry: 1300,
        note: 'Paylaşımlı jeep; sabah 08:00 kalkış.',
      },
      {
        mode: 'flight',
        from: 'Jomsom',
        to: 'Pokhara',
        durationMin: 20,
        costTry: 5200,
        note: 'Sabah 07:00–09:00 arası; öğleden sonra rüzgâr nedeniyle uçuş yok.',
      },
    ],
    permits: [
      {
        name: 'ACAP izni',
        costTry: 900,
        where: 'NTB Kathmandu / Pokhara',
        note: '3.000 NPR; 2 fotoğraf.',
      },
      {
        name: 'TIMS kartı',
        costTry: 600,
        where: 'NTB ofisi ya da acente',
        note: '2.000 NPR; rehberli gruplar için acente düzenler.',
      },
    ],
    budgetTry: { low: 45000, high: 110000 },
    risks: [
      'Thorong La’da ani kar fırtınası ve beyaz-karanlık (2014 faciası)',
      'AMS: Manang üstünde günde 500 m kuralı',
      'Muktinath inişinde diz ve kayma yaralanmaları',
      'Jeep yollarında heyelan (muson)',
      'Giardia ve su kaynaklı hastalık',
      'Rehbersiz yürüyüşçüler kontrol noktalarında geri çevrilebilir',
    ],
    gear: [
      '-10 °C uyku tulumu',
      'Kaz tüyü mont, rüzgâr geçirmez eldiven',
      'Trekking batonu (iniş için şart)',
      'Mikro krampon (Kasım–Mart geçit için)',
      'Kategori 4 gözlük, kar için',
      'Su filtresi',
      'Baş lambası (04:00 geçit çıkışı)',
    ],
    rescueNote:
      'HRA Manang kliniği (3540 m) sezonda açık; Jomsom’da devlet hastanesi. Helikopter tahliyesi Manang ve Muktinath’tan Pokhara/Kathmandu’ya. Acil: 100 (polis), 102 (ambulans), tur acentesi 7/24 hattı.',
    insuranceRequired: true,
    stageCount: annapurnaStages.length,
    rating: 4.8,
    reviewCount: 1215,
    sources: [
      'https://en.wikivoyage.org/wiki/Annapurna_Circuit',
      'https://ntnc.org.np/project/annapurna-conservation-area-project-acap',
      'https://www.himalayanrescue.org.np',
    ],
    updatedAt: UPDATED,
  },
  {
    id: ABC_ID,
    slug: 'annapurna-base-camp',
    name: 'Annapurna Base Camp',
    region: 'Annapurna Sanctuary',
    countryCode: 'NP',
    type: 'trek',
    adventureTypes: ['hiking'],
    coords: { latitude: 28.5306, longitude: 83.8781 },
    imageUrl: unsplash('1571401835393-8c5f98bc3b7c'),
    summary:
      'Modi Khola vadisinden 4130 m’deki buzul amfisine kısa ve yoğun bir teahouse treki. 7–8 günde Annapurna I güney duvarının dibine.',
    guide: `Nasıl gidilir
Pokhara’dan Nayapul ya da Jhinu Danda’ya jeep 2,5–3 saat (paylaşımlı ~1.000 NPR). Yeni yol Samrung/Jhinu köprüsüne kadar geldiği için ilk gün doğrudan Chhomrong’a ulaşılabilir. Pokhara’ya Kathmandu’dan turist otobüsü 7 saat ya da 25 dakikalık uçuş.

Ne zaman
Mart–Mayıs (rododendron ormanı kırmızıya döner) ve Ekim–Kasım. Kış (Aralık–Şubat) Deurali–MBC arasında çığ riski taşır; muson dönemi sülük ve sis. Şubat sonu kar altında sakin ve güzeldir ama Deurali üstü için rehber şart.

İzinler
ACAP izni 3.000 NPR ve TIMS 2.000 NPR; Pokhara NTB ofisi 15 dakikada düzenler. Chhomrong ve Birethanti kontrol noktalarında damgalanır. Rehber kuralı bu rotada sıkı uygulanır.

Konaklama
Chhomrong’a kadar sıcak duş ve Wi-Fi; Dovan’dan sonra sadece güneş enerjisi. ABC ve MBC teahouse’ları küçük ve sezon zirvesinde dolar; rehberler Deurali’den telefonla yer ayırır. Yemek fiyatları irtifayla artar (ABC’de dal bhat 900 NPR).

Aklimatizasyon
Kısa rotada 2170 m’den 4130 m’ye 3 günde çıkılır; bu yüzden Deurali (3230 m) ve MBC’de (3700 m) birer gece klasik plan. MBC’den ABC’ye 1,5–2 saat; gün doğumu için ABC’de gecelenir. Baş ağrısıyla uyanırsanız Deurali’ye inmek yeterli olur.

Bütçe
Pokhara jeep ve teahouse dahil günlük 25–35 USD; rehber 30 USD/gün. 8 gün için 30.000–70.000 ₺.

Riskler
Hinku Mağarası–Deurali–MBC arasında Ocak–Mart çığ kanalları: sabah 10:00’dan önce geçin, kar yağışı sonrası 24 saat bekleyin. Muson sülükleri, ıslak taş basamaklarda kayma (rotada 3.000’den fazla basamak). AMS belirtileri ABC’de yaygındır ama iniş kısadır.

Bağlantı & para
Chhomrong son ATM ve sinyal noktası; sonrası Wi-Fi kartıyla. Pokhara’da nakit NPR alın. Sigorta helikopter kapsamlı olmalı; ABC helikopter pisti sık kullanılır.`,
    maxElevationM: 4130,
    typicalDays: 8,
    totalDistanceKm: 70,
    difficulty: 'moderate',
    bestMonths: [3, 4, 5, 10, 11],
    transports: [
      {
        mode: 'flight',
        from: 'İstanbul (IST)',
        to: 'Kathmandu (KTM)',
        durationMin: 660,
        costTry: 34000,
        note: 'Aktarmalı, gidiş-dönüş.',
      },
      {
        mode: 'bus',
        from: 'Kathmandu',
        to: 'Pokhara',
        durationMin: 420,
        costTry: 500,
        note: 'Turist otobüsü; uçuş alternatifi 25 dk (~4.000 ₺).',
      },
      {
        mode: 'jeep',
        from: 'Pokhara',
        to: 'Jhinu Danda',
        durationMin: 180,
        costTry: 800,
        note: 'Paylaşımlı jeep; özel araç ~8.000 ₺.',
      },
    ],
    permits: [
      { name: 'ACAP izni', costTry: 900, where: 'NTB Pokhara', note: '3.000 NPR.' },
      { name: 'TIMS kartı', costTry: 600, where: 'NTB Pokhara', note: '2.000 NPR.' },
    ],
    budgetTry: { low: 30000, high: 70000 },
    risks: [
      'Kış çığ kanalları (Deurali–MBC), sabah erken geçiş',
      'AMS: 3 günde 2.000 m kazanım',
      'Islak taş basamaklarda kayma',
      'Muson sülükleri ve sis',
    ],
    gear: [
      '-10 °C uyku tulumu',
      'Yağmurluk / poncho (muson)',
      'Trekking batonu',
      'Baş lambası',
      'Su filtresi',
      'Sülük çorabı (Haziran–Eylül)',
    ],
    rescueNote:
      'ABC ve MBC helikopter pisti; en yakın klinik Chhomrong sağlık ocağı, hastane Pokhara (Manipal). Tur acentesi hattı ve 102.',
    insuranceRequired: true,
    stageCount: abcStages.length,
    rating: 4.7,
    reviewCount: 980,
    sources: [
      'https://en.wikivoyage.org/wiki/Annapurna_Sanctuary_Trek',
      'https://ntnc.org.np/project/annapurna-conservation-area-project-acap',
    ],
    updatedAt: UPDATED,
  },
  {
    id: LANGTANG_ID,
    slug: 'langtang-valley',
    name: 'Langtang Vadisi',
    region: 'Rasuwa, Langtang Milli Parkı',
    countryCode: 'NP',
    type: 'trek',
    adventureTypes: ['hiking'],
    coords: { latitude: 28.2103, longitude: 85.5652 },
    imageUrl: unsplash('1506905925346-21bda4d32df4'),
    summary:
      'Kathmandu’ya en yakın Himalaya vadisi: Syabrubesi’den Tamang köyleri ve yak meralarıyla Kyanjin Gompa’ya, Tserko Ri (4984 m) ile taçlanan sakin bir 7–8 günlük tur.',
    guide: `Nasıl gidilir
Kathmandu’dan Syabrubesi’ye yerel otobüs 7–9 saat (Machha Pokhari, ~1.000 NPR) ya da paylaşımlı jeep 6 saat (~2.500 NPR). Trishuli yolu muson sonrası heyelanlı ve tozludur; öne oturun, sabah 06:30 kalkışını kaçırmayın. Uçuş yoktur; dönüş aynı yoldan.

Ne zaman
Ekim–Kasım ve Mart–Mayıs. Kış aylarında Kyanjin Gompa açık kalır ve manzara berraktır, ancak Tserko Ri’de kar ve buz; Haziran–Eylül muson.

İzinler
Langtang Milli Parkı giriş ücreti 3.000 NPR (Dhunche kontrol noktası) ve TIMS 2.000 NPR. 2023 rehber kuralı Dhunche’de kontrol edilir.

Konaklama
Syabrubesi ve Lama Hotel basit ama sıcak; Langtang köyü 2015 depreminden sonra yeniden inşa edildi. Kyanjin Gompa küçük bir turizm merkezi: Wi-Fi, fırın, yak peyniri fabrikası, sıcak duş. Yüksek sezonda Kyanjin’de yer bulmak kolaydır.

Aklimatizasyon
Lama Hotel (2470 m) → Langtang (3430 m) 960 m kazanç; sınırın üstündedir, belirtili kişiler Ghodatabela’da (3030 m) gecelemeli. Kyanjin’de en az bir tam gün: Kyanjin Ri (4773 m) yarım gün, Tserko Ri (4984 m) tam gün ve 03:30 çıkış.

Bütçe
Otobüs ve teahouse ile günlük 20–30 USD; rehber 30 USD/gün. 8 gün için 25.000–60.000 ₺.

Riskler
2015 depreminde Langtang köyü buzul çığı altında kaldı; heyelan kanalları hâlâ hareketli, yağmurda Lama Hotel–Langtang arasında dikkat. Tserko Ri’de kar ve yorgunluk; Kyanjin’de AMS nadir değildir. Trishuli yolunda trafik kazaları.

Bağlantı & para
Syabrubesi ve Dhunche’de ATM; sonrasında nakit. NTC 2G Langtang’a kadar, Kyanjin’de Wi-Fi. Sigorta önerilir; helikopter Kyanjin’den kalkar.`,
    maxElevationM: 4984,
    typicalDays: 8,
    totalDistanceKm: 72,
    difficulty: 'moderate',
    bestMonths: [3, 4, 5, 10, 11, 12],
    transports: [
      {
        mode: 'flight',
        from: 'İstanbul (IST)',
        to: 'Kathmandu (KTM)',
        durationMin: 660,
        costTry: 34000,
        note: 'Aktarmalı, gidiş-dönüş.',
      },
      {
        mode: 'jeep',
        from: 'Kathmandu',
        to: 'Syabrubesi',
        durationMin: 390,
        costTry: 900,
        note: 'Paylaşımlı jeep; otobüs 350 ₺ ama 9 saat.',
      },
    ],
    permits: [
      {
        name: 'Langtang Milli Parkı giriş',
        costTry: 900,
        where: 'Dhunche kontrol noktası',
        note: '3.000 NPR.',
      },
      { name: 'TIMS kartı', costTry: 600, where: 'NTB Kathmandu', note: '2.000 NPR.' },
    ],
    budgetTry: { low: 25000, high: 60000 },
    risks: [
      'Heyelan kanalları (Lama Hotel–Langtang)',
      'Tserko Ri’de kar/buz ve AMS',
      'Yol trafiği (Trishuli)',
      'Kışın gece -15 °C',
    ],
    gear: ['-10 °C uyku tulumu', 'Kaz tüyü mont', 'Baş lambası', 'Su filtresi', 'Baton'],
    rescueNote:
      'Dhunche’de bölge hastanesi; Kyanjin Gompa helikopter pisti. Acil 100/102; tur acentesi hattı.',
    insuranceRequired: true,
    stageCount: langtangStages.length,
    rating: 4.6,
    reviewCount: 410,
    sources: ['https://en.wikivoyage.org/wiki/Langtang_National_Park', 'https://ntb.gov.np'],
    updatedAt: UPDATED,
  },
  {
    id: MANASLU_ID,
    slug: 'manaslu-circuit',
    name: 'Manaslu Circuit',
    region: 'Gorkha, Manaslu Koruma Alanı',
    countryCode: 'NP',
    type: 'trek',
    adventureTypes: ['hiking'],
    coords: { latitude: 28.6428, longitude: 84.5586 },
    imageUrl: unsplash('1522163182402-834f871fd851'),
    summary:
      'Budhi Gandaki vadisinden Nubri’nin Tibet köylerine, Larkya La (5106 m) ile Annapurna’ya bağlanan kısıtlı bölge turu. Zorunlu rehber, az kalabalık, 14–16 gün.',
    guide: `Nasıl gidilir
Kathmandu’dan Arughat ve Soti Khola/Machha Khola’ya jeep 8–9 saat (özel jeep ~200 USD, paylaşımlı 30 USD). Rota Dharapani’de biter; oradan Besisahar’a jeep 4–5 saat, ardından Kathmandu otobüsü. Manaslu’yu Annapurna Circuit ile birleştirerek 3 haftalık büyük tur yapılabilir.

Ne zaman
Ekim–Kasım (kısıtlı bölge izni bu aylarda daha pahalı) ve Mart–Mayıs. Aralık–Şubat Larkya La genelde kapalı; Dharamsala lodge’u kapanır. Muson dönemi sülük, heyelan ve bulut.

İzinler
Manaslu Kısıtlı Bölge İzni (MRAP): Eylül–Kasım haftalık 100 USD, ek gün 15 USD; Aralık–Ağustos 75 USD/hafta. En az 2 yürüyüşçü + lisanslı rehber ve kayıtlı acente şart (tek kişi ise acente “hayalet” ikinci izinle çözer). Ayrıca MCAP 3.000 NPR ve Dharapani’den sonrası için ACAP 3.000 NPR. İzinler yalnızca Kathmandu Göçmenlik Dairesi’nden acente aracılığıyla alınır; pasaport orijinali gerekir.

Konaklama
Teahouse’lar Annapurna’dan basittir; Namrung ve Samagaon nispeten konforlu (sıcak duş, Wi-Fi). Dharamsala’da tek lodge ve çadırlı ek kapasite — geçit gününden önce yer garantisi rehberin işi. Bimthang’dan sonra konfor artar.

Aklimatizasyon
Namrung (2630 m) sonrası Lho (3180 m), Samagaon (3530 m) ve Samdo (3860 m) kademeli çıkışlar idealdir. Samagaon’da dinlenme günü (Manaslu Ana Kampı 4800 m ya da Birendra Gölü) zorunlu sayılmalı; Samdo’da ek gün Larkya La için rahatlık sağlar. Dharamsala (4460 m) yalnızca bir gece.

Bütçe
İzin paketi ~250 USD, rehber 35–45 USD/gün, jeep transferleri 60–80 USD, teahouse 30–40 USD/gün. 15 gün için 75.000–140.000 ₺ arası; küçük gruplarda rehber maliyeti paylaşılır.

Riskler
Larkya La inişi buzlu ve dik; mikro krampon işe yarar. Kar fırtınasında geçit 2–3 gün kapanabilir. Budhi Gandaki vadisinde kaya düşmesi ve dar patikalar; katır kervanlarına vadi tarafında yol vermeyin. AMS, Samdo ve Dharamsala’da belirginleşir. Kısıtlı bölgede helikopter tahliyesi zaman alır.

Bağlantı & para
Machha Khola’dan sonra ATM yok; Kathmandu’dan bütün nakit. NTC 2G Samagaon’a kadar noktasal, Wi-Fi Namrung ve Samagaon’da ücretli. Uydu iletişim cihazı bu rota için mantıklıdır.`,
    maxElevationM: 5106,
    typicalDays: 15,
    totalDistanceKm: 177,
    difficulty: 'hard',
    bestMonths: [3, 4, 5, 10, 11],
    transports: [
      {
        mode: 'flight',
        from: 'İstanbul (IST)',
        to: 'Kathmandu (KTM)',
        durationMin: 660,
        costTry: 34000,
        note: 'Aktarmalı, gidiş-dönüş.',
      },
      {
        mode: 'jeep',
        from: 'Kathmandu',
        to: 'Machha Khola',
        durationMin: 540,
        costTry: 1500,
        note: 'Paylaşımlı; özel jeep ~8.500 ₺ (7 kişi).',
      },
      {
        mode: 'jeep',
        from: 'Dharapani',
        to: 'Besisahar',
        durationMin: 270,
        costTry: 1200,
        note: 'Bozuk yol; ardından Kathmandu otobüsü 6 saat.',
      },
    ],
    permits: [
      {
        name: 'Manaslu Kısıtlı Bölge İzni (MRAP)',
        costTry: 4200,
        where: 'Kathmandu Göçmenlik Dairesi (acente aracılığıyla)',
        note: 'Eylül–Kasım 100 USD/hafta; min. 2 kişi + rehber.',
      },
      { name: 'MCAP izni', costTry: 900, where: 'NTB Kathmandu', note: '3.000 NPR.' },
      {
        name: 'ACAP izni',
        costTry: 900,
        where: 'NTB Kathmandu',
        note: 'Dharapani sonrası için gerekli.',
      },
    ],
    budgetTry: { low: 75000, high: 140000 },
    risks: [
      'Larkya La’da kar fırtınası ve buzlu iniş',
      'Budhi Gandaki’de kaya düşmesi, dar patika',
      'AMS (Samdo/Dharamsala)',
      'Uzak bölge: tahliye gecikmesi',
      'Zorunlu rehber ve 2 kişi kuralı',
    ],
    gear: [
      '-15 °C uyku tulumu',
      'Mikro krampon',
      'Kaz tüyü mont + ekspedisyon eldiveni',
      'Baş lambası (03:30 geçit çıkışı)',
      'Su filtresi',
      'Uydu mesajlaşma cihazı (önerilir)',
    ],
    rescueNote:
      'Samagaon sağlık ocağı ve helikopter pisti; en yakın hastane Gorkha/Kathmandu. Tahliye acente ve sigorta üzerinden; kısıtlı bölgede polis kontrol noktaları yardımcı olur.',
    insuranceRequired: true,
    stageCount: manasluStages.length,
    rating: 4.8,
    reviewCount: 520,
    sources: [
      'https://en.wikivoyage.org/wiki/Manaslu_Circuit',
      'https://www.nepalimmigration.gov.np/page/trekking-permit',
      'https://ntnc.org.np/project/manaslu-conservation-area-project-mcap',
    ],
    updatedAt: UPDATED,
  },
  {
    id: KILI_ID,
    slug: 'kilimanjaro-machame',
    name: 'Kilimanjaro — Machame Rotası',
    region: 'Kilimanjaro Milli Parkı',
    countryCode: 'TZ',
    type: 'expedition',
    adventureTypes: ['hiking', 'climbing'],
    coords: { latitude: -3.0758, longitude: 37.3533 },
    imageUrl: unsplash('1589553416260-f586c8f1514f'),
    summary:
      '“Viski rotası”: yağmur ormanından Shira platosu, Barranco duvarı ve Barafu üzerinden Uhuru Peak (5895 m). 7 günlük plan, zorunlu rehber ve porter ekibiyle.',
    guide: `Nasıl gidilir
İstanbul’dan Kilimanjaro Havalimanı’na (JRO) Turkish Airlines direkt uçuşu ~8 saat; alternatif Addis Ababa ya da Nairobi aktarmalı. Havalimanından Moshi 45 dakika, Arusha 1 saat. Tanzanya e-vizesi (50 USD) önceden online alınır; sarı humma sertifikası yalnızca endemik ülkeden geliyorsanız istenir. Machame Gate Moshi’den 1 saat; tur şirketi transferi dahil.

Ne zaman
Ocak–Mart (soğuk, berrak, az kalabalık) ve Haziran–Ekim (kuru, en kalabalık). Nisan–Mayıs uzun yağmurlar; Kasım kısa yağmurlar. Dolunay zirve geceleri ekstra popüler ve pahalıdır.

İzinler
KINAPA ücretleri yalnızca lisanslı tur operatörü üzerinden ödenir: koruma ücreti 70 USD/gün, kamp 50 USD/gece, kurtarma 20 USD, rehber/porter giriş ücretleri ve %18 KDV. 7 günlük Machame için park ücretleri kişi başı ~1.000 USD tutar ve tur fiyatına dahildir. Rehbersiz tırmanış yasaktır; her yürüyüşçü için ortalama 3 porter + aşçı + yardımcı rehber görevlendirilir. KPAP (porter hakları) onaylı şirket seçin.

Konaklama
Tüm rota çadırlı kamptır; tur şirketi çadır, yemek çadırı ve şişme mat sağlar. Kamp tuvaletleri ilkel, özel tuvalet çadırı ekstra. Barafu’dan itibaren su taşınır. Zirve öncesi Barafu’da 4–5 saat uyku, 23:30 kalkış.

Aklimatizasyon
Machame’nin 7 günlük versiyonunda Lava Tower (4630 m) çıkıp Barranco’ya (3960 m) inen 4. gün ana aklimatizasyon adımıdır; 6 günlük versiyon zirve başarısını belirgin düşürür (%65’e karşı %85). “Pole pole” (yavaş yavaş) temposu, günde 4 L su ve Diamox tartışması rehberle yapılmalı. Zirve gecesi 1.200 m çıkış, aynı gün 2.800 m iniş — rota kısa sürede en yüksek irtifa değişimi verir.

Bütçe
Tur fiyatı kişi başı 2.000–3.500 USD (park ücretleri, ekip, yemek, transfer). Bahşiş ekip için 250–350 USD/kişi. Ekipman kiralama Moshi’de mümkün. Toplam 90.000–180.000 ₺; uçuş hariç.

Riskler
AMS ve HAPE: yıllık ölümlerin başlıca nedeni; rehberler SpO₂ ölçer, oksijen tüpü taşır. Zirve gecesi -15 °C ve rüzgâr; hipotermi ve donma. Barranco duvarında düşme (kolay ama açıklıklı). Kibo kraterinde volkanik gaz nadir. Tropikal hastalıklar alçakta: sıtma profilaksisi Moshi/Arusha için.

Bağlantı & para
Moshi ATM’leri USD ve TZS; bahşiş için yeni seri USD banknot. Vodacom 4G Shira’ya kadar sık, zirve kesiminde bazen sinyal var. Sigorta 6.000 m ve helikopter kapsamlı olmalı (Kilimanjaro SAR helikopteri 2017’den beri aktif).`,
    maxElevationM: 5895,
    typicalDays: 7,
    totalDistanceKm: 62,
    difficulty: 'hard',
    bestMonths: [1, 2, 3, 6, 7, 8, 9, 10],
    transports: [
      {
        mode: 'flight',
        from: 'İstanbul (IST)',
        to: 'Kilimanjaro (JRO)',
        durationMin: 480,
        costTry: 36000,
        note: 'Direkt THY; gidiş-dönüş ekonomi.',
      },
      {
        mode: 'taxi',
        from: 'JRO Havalimanı',
        to: 'Moshi',
        durationMin: 50,
        costTry: 2000,
        note: 'Tur şirketi transferi genelde dahil.',
      },
      {
        mode: 'jeep',
        from: 'Moshi',
        to: 'Machame Gate',
        durationMin: 60,
        costTry: null,
        note: 'Tur paketine dahil.',
      },
    ],
    permits: [
      {
        name: 'KINAPA park + kamp + kurtarma ücretleri',
        costTry: 42000,
        where: 'Lisanslı tur operatörü (Machame Gate’te ödeme)',
        note: '~1.000 USD / 7 gün; bireysel giriş yasak.',
      },
      {
        name: 'Tanzanya e-vizesi',
        costTry: 2100,
        where: 'visa.immigration.go.tz',
        note: '50 USD; en az 10 gün önce başvur.',
      },
    ],
    budgetTry: { low: 90000, high: 180000 },
    risks: [
      'AMS / HAPE — en yaygın tahliye sebebi',
      'Zirve gecesi hipotermi ve donma (-15 °C, rüzgâr)',
      'Barranco duvarında düşme',
      'Dehidrasyon (günde 4 L hedef)',
      'Alçak bölgelerde sıtma',
    ],
    gear: [
      '-15 °C uyku tulumu (kiralanabilir)',
      'Kaz tüyü mont, balaclava, kalın eldiven + iç eldiven',
      'Baş lambası + yedek pil (zirve gecesi 7 saat)',
      'Kategori 4 gözlük',
      '3 L su kapasitesi + termos (zirve gecesi hortum donar)',
      'Trekking batonu',
      'Yağmurluk (orman günü)',
      'Duffel çanta (porter için, maks. 15 kg)',
    ],
    rescueNote:
      'KINAPA kurtarma ekipleri her kampta; Kilimanjaro SAR helikopteri (Moshi) sigorta onayıyla. Hastane: KCMC Moshi. Acil: 112 (Tanzanya), tur şirketi telsiz ağı.',
    insuranceRequired: true,
    stageCount: kiliStages.length,
    rating: 4.8,
    reviewCount: 2210,
    sources: [
      'https://en.wikivoyage.org/wiki/Kilimanjaro',
      'https://www.tanzaniaparks.go.tz/national_parks/kilimanjaro-national-park',
      'https://kiliporters.org',
    ],
    updatedAt: UPDATED,
  },
  {
    id: TORRES_ID,
    slug: 'torres-del-paine-w',
    name: 'Torres del Paine W Rotası',
    region: 'Magallanes, Patagonya',
    countryCode: 'CL',
    type: 'trek',
    adventureTypes: ['hiking'],
    coords: { latitude: -50.9414, longitude: -72.9614 },
    imageUrl: unsplash('1478827387698-1527781a4887'),
    summary:
      'Grey Buzulu, Francés Vadisi ve granit kuleler: 4–5 günlük “W” ya da 8 günlük “O” turu. CONAF ve refugio rezervasyonu olmadan girilmez.',
    guide: `Nasıl gidilir
İstanbul → Santiago (SCL) aktarmalı ~20 saat, Santiago → Punta Arenas 3,5 saat, oradan Puerto Natales otobüsü 3 saat. Puerto Natales’ten parka sabah 07:00 otobüsleri (Bus-Sur, Buses Fernández; ~15.000 CLP gidiş-dönüş) Laguna Amarga ve Pudeto’ya gider; Pudeto’dan Paine Grande’ye katamaran (~35.000 CLP). W batıdan doğuya (Grey → Torres) ya da tersi yürünebilir; ekim–nisan yüksek sezon.

Ne zaman
Kasım–Mart ana sezon; Aralık–Şubat en kalabalık ve rüzgârlı. Ekim ve Nisan sakin, gölgeler uzun, kar mümkün. Mayıs–Eylül W yalnızca rehberli ve sınırlı refugio ile yürünebilir.

İzinler
CONAF park giriş bileti online (pasesparques.cl; yabancılar ~46.000 CLP, 3 günden uzun kalış). Her gece için konaklama rezervasyonu zorunludur ve giriş kapısında kontrol edilir: Paine Grande ve Grey için Vertice Patagonia, Los Cuernos/Francés, Chileno ve Central için Las Torres Patagonia. Aralık–Şubat için 4–6 ay önce rezervasyon yapın; ücretsiz CONAF kampları (Italiano, Paso) sınırlı ve bazen kapalıdır.

Konaklama
Refugio yatakhaneleri (60–120 USD/kişi, uyku tulumu kiralık), tam pansiyon paketleri (~60 USD) ve platformlu kamp alanları (çadır kurulu kiralık). Sıcak duş ve restoran çoğunda var; Grey ve Paine Grande’de Wi-Fi ücretli. Yemek pişirmek yalnızca belirlenmiş alanlarda; 2011 ve 2012 yangınları sonrası kural katıdır.

Aklimatizasyon
İrtifa sorunu yok (maks. 900 m). Asıl zorluk rüzgârdır: 100 km/s üstü hamleler Británico ve Torres seyir noktalarında insanı deviriyor; baton ve düşük ağırlık merkezi. Günlük 15–20 km, toplam 75–80 km.

Bütçe
Park bileti + katamaran + otobüs ~120 USD; kamp ile 4 gece 250–400 USD, refugio tam pansiyonla 800–1.200 USD. Toplam 40.000–110.000 ₺ (Şili içi uçuş dahil, uluslararası hariç).

Riskler
Rüzgâr (özellikle Francés ve kuleler), hipotermi (yaz ortasında bile kar), ıslak kaya ve moren. Yangın: tüp ocağı dışında ateş kesinlikle yasak; ihlal sınır dışı ve ağır para cezası. Puma karşılaşması nadir ve tehlikesizdir. Nehir geçişleri köprülü, sorun yok.

Bağlantı & para
Puerto Natales’te ATM ve kart; parkta refugio’lar kart alır ama nakit CLP taşıyın. Sinyal yalnızca Las Torres ve Paine Grande çevresinde. Sigorta zorunlu değil, önerilir.`,
    maxElevationM: 900,
    typicalDays: 5,
    totalDistanceKm: 80,
    difficulty: 'moderate',
    bestMonths: [10, 11, 12, 1, 2, 3, 4],
    transports: [
      {
        mode: 'flight',
        from: 'İstanbul (IST)',
        to: 'Santiago (SCL)',
        durationMin: 1200,
        costTry: 52000,
        note: 'Aktarmalı (Madrid/São Paulo), gidiş-dönüş.',
      },
      {
        mode: 'flight',
        from: 'Santiago',
        to: 'Punta Arenas (PUQ)',
        durationMin: 210,
        costTry: 6500,
        note: 'LATAM/Sky; erken alınırsa ucuz.',
      },
      {
        mode: 'bus',
        from: 'Punta Arenas',
        to: 'Puerto Natales',
        durationMin: 180,
        costTry: 550,
        note: 'Bus-Sur; günde 8+ sefer.',
      },
      {
        mode: 'bus',
        from: 'Puerto Natales',
        to: 'Pudeto / Laguna Amarga',
        durationMin: 150,
        costTry: 650,
        note: '07:00 kalkış; gidiş-dönüş bilet.',
      },
      {
        mode: 'ferry',
        from: 'Pudeto',
        to: 'Paine Grande',
        durationMin: 30,
        costTry: 1500,
        note: 'Katamaran; rüzgârda iptal olabilir.',
      },
    ],
    permits: [
      {
        name: 'CONAF park girişi',
        costTry: 2100,
        where: 'pasesparques.cl (online)',
        note: '~46.000 CLP yabancı, 3+ gün.',
      },
      {
        name: 'Konaklama rezervasyonu (Vertice / Las Torres)',
        costTry: null,
        where: 'verticepatagonia.com, lastorres.com',
        note: 'Her gece için zorunlu; girişte kontrol edilir.',
      },
    ],
    budgetTry: { low: 40000, high: 110000 },
    risks: [
      'Aşırı rüzgâr (100 km/s+), düşme',
      'Hipotermi — yazın kar mümkün',
      'Yangın kuralları (ihlalde sınır dışı)',
      'Refugio rezervasyonu olmadan giriş reddi',
    ],
    gear: [
      'Rüzgâr geçirmez hardshell + pantolon',
      '0 °C uyku tulumu (kamp)',
      'Bere ve eldiven (yazın da)',
      'Trekking batonu',
      'Tüp ocağı (sadece izinli alanlarda)',
      'Nakit CLP',
    ],
    rescueNote:
      'CONAF ranger istasyonları her sektörde; ciddi vakalar Puerto Natales Hastanesi’ne (2,5 saat) götürülür. Acil: 133 (Carabineros), 131 (ambulans). Helikopter kurtarma sınırlı.',
    insuranceRequired: false,
    stageCount: torresStages.length,
    rating: 4.8,
    reviewCount: 1720,
    sources: [
      'https://en.wikivoyage.org/wiki/Torres_del_Paine_National_Park',
      'https://www.conaf.cl/parques/parque-nacional-torres-del-paine/',
      'https://www.verticepatagonia.com',
    ],
    updatedAt: UPDATED,
  },
  {
    id: INCA_ID,
    slug: 'inca-trail',
    name: 'Inca Trail (Camino Inca)',
    region: 'Cusco, Kutsal Vadi',
    countryCode: 'PE',
    type: 'trek',
    adventureTypes: ['hiking'],
    coords: { latitude: -13.3025, longitude: -72.4911 },
    imageUrl: unsplash('1526392060635-9d6019884377'),
    summary:
      'Km 82’den Dead Woman’s Pass (4215 m) ve İnka taş yolu boyunca Güneş Kapısı’na: 4 günlük, kotalı ve yalnızca lisanslı operatörle yürünebilen dünyanın en ünlü arkeolojik treki.',
    guide: `Nasıl gidilir
İstanbul → Lima aktarmalı ~18 saat (Madrid/Amsterdam), Lima → Cusco 1,5 saat uçuş. Cusco 3.400 m’dedir; şehirde 2 gün aklimatizasyon zorunlu sayılmalı (Kutsal Vadi’de Ollantaytambo 2.800 m daha rahat). Tur operatörü sabah 04:30 otelden alır, Km 82 kontrol noktasına 3 saat.

Ne zaman
Mayıs–Eylül kuru sezon (Haziran–Ağustos en kalabalık ve soğuk geceler). Şubat ayı rota bakım için kapalıdır; Aralık–Mart yağmurlu ve çamurlu. Mart–Nisan ve Ekim iyi dengedir.

İzinler
Günlük 500 kişilik kota (yaklaşık 200 yürüyüşçü + porterler) SERNANP tarafından yalnızca lisanslı operatörlere verilir; Mayıs–Ağustos için 5–7 ay önce satın alınmalı, pasaport numarasıyla kişiye özeldir ve devredilemez. Permi ücreti (~100 USD) ve Machu Picchu girişi tur fiyatına dahildir. Bağımsız yürüyüş yasaktır. Alternatif: Salkantay (kotasız), Lares.

Konaklama
Operatörün kurduğu çadırlı kamplar; porterler çadır, yemek çadırı ve tuvalet çadırı taşır. Yasal porter yükü 20 kg, kişisel duffel 7 kg ile sınırlı (fazlası ekstra porter). Wiñay Wayna kampında zaman zaman sıcak duş ve satış noktası.

Aklimatizasyon
Cusco’da 2 gün + Kutsal Vadi bir gün en iyi hazırlık. 2. gün Wayllabamba (3000 m) → Dead Woman’s Pass (4215 m) 1.200 m tırmanış tek sabahta gelir; koka çayı, bol su ve yavaş tempo. Kampların uyku irtifası 3.600 m’yi geçmediği için AMS genelde hafif kalır.

Bütçe
Klasik 4 gün tur 700–1.100 USD (permi, porter, yemek, tren dönüş dahil); ekstra porter 100–150 USD; bahşiş 60–80 USD. Toplam 45.000–95.000 ₺ (Peru içi uçuş dahil).

Riskler
AMS (özellikle Cusco’ya uçakla inince), ıslak İnka basamaklarında düşme (3. gün 2.000 basamak iniş), güneş yanığı (ekvator UV), soğuk geceler Pacaymayo’da. Kayıp pasaport permiyi geçersiz kılar. Yağmur sezonunda heyelanla rota kapanabilir.

Bağlantı & para
Cusco’da ATM; rotada nakit PEN küçük kupür (porter bahşişi, Wiñay Wayna). Sinyal yalnızca Km 82 ve Machu Picchu’da. Sigorta önerilir; tahliye at sırtında ve yürüyerek olur, helikopter yok.`,
    maxElevationM: 4215,
    typicalDays: 4,
    totalDistanceKm: 43,
    difficulty: 'moderate',
    bestMonths: [4, 5, 6, 7, 8, 9, 10],
    transports: [
      {
        mode: 'flight',
        from: 'İstanbul (IST)',
        to: 'Lima (LIM)',
        durationMin: 1080,
        costTry: 48000,
        note: 'Aktarmalı, gidiş-dönüş.',
      },
      {
        mode: 'flight',
        from: 'Lima',
        to: 'Cusco (CUZ)',
        durationMin: 85,
        costTry: 4500,
        note: 'LATAM/Sky; sabah uçuşları daha güvenilir.',
      },
      {
        mode: 'bus',
        from: 'Cusco',
        to: 'Km 82 (Piscacucho)',
        durationMin: 180,
        costTry: null,
        note: 'Operatör transferi, 04:30 kalkış.',
      },
      {
        mode: 'train',
        from: 'Aguas Calientes',
        to: 'Ollantaytambo',
        durationMin: 100,
        costTry: 2800,
        note: 'PeruRail/Inca Rail; tur paketine genelde dahil.',
      },
    ],
    permits: [
      {
        name: 'Inca Trail permisi (SERNANP)',
        costTry: 4200,
        where: 'Lisanslı tur operatörü',
        note: 'Günlük 500 kota; 5–7 ay önce; pasaporta bağlı.',
      },
      {
        name: 'Machu Picchu girişi',
        costTry: 2200,
        where: 'Operatör / tuboleto.cultura.pe',
        note: 'Sabah slotu tur fiyatına dahil.',
      },
    ],
    budgetTry: { low: 45000, high: 95000 },
    risks: [
      'AMS (Cusco 3.400 m’ye uçakla iniş)',
      'Islak İnka basamaklarında düşme',
      'Ekvator UV’si, güneş yanığı',
      'Permi kotası / pasaport uyumsuzluğu',
      'Yağmur sezonu heyelanları (Şubat kapalı)',
    ],
    gear: [
      '0 °C uyku tulumu (kiralık)',
      'Yağmurluk / poncho',
      'Trekking batonu (lastik uçlu — zorunlu)',
      'Baş lambası',
      'Güneş şapkası + 50 krem',
      'Böcek kovucu',
      'Pasaport (orijinal!)',
    ],
    rescueNote:
      'Rotada SERNANP ranger noktaları; operatörler oksijen taşır. Hastane: Cusco Regional. Tahliye Km 82 ya da Machu Picchu yönüne yürüyerek/at ile; acil 105 (polis), 116 (itfaiye/kurtarma).',
    insuranceRequired: false,
    stageCount: incaStages.length,
    rating: 4.9,
    reviewCount: 3050,
    sources: [
      'https://en.wikivoyage.org/wiki/Inca_Trail',
      'https://www.gob.pe/sernanp',
      'https://www.machupicchu.gob.pe',
    ],
    updatedAt: UPDATED,
  },
  {
    id: TMB_ID,
    slug: 'tour-du-mont-blanc',
    name: 'Tour du Mont Blanc',
    region: 'Chamonix – Courmayeur – Champex',
    countryCode: 'FR',
    type: 'trek',
    adventureTypes: ['hiking'],
    coords: { latitude: 45.8326, longitude: 6.8652 },
    imageUrl: unsplash('1531789694268-03cfa7f4ea1a'),
    summary:
      'Üç ülke, 170 km ve 10.000 m tırmanışla Mont Blanc masifinin çevresi. Refuge yarım pansiyonu, köy gîte’leri ve teleferik kısaltmalarıyla 11 günlük Alp klasiği.',
    guide: `Nasıl gidilir
İstanbul → Cenevre direkt 3 saat; Cenevre’den Chamonix’e shuttle (AlpyBus, Mountain Drop-offs; ~40 EUR) 1,5 saat ya da Bellegarde üzerinden tren. Les Houches klasik başlangıçtır ve Chamonix’den trenle 10 dakikadır. Schengen vizesi gerekir; İtalya ve İsviçre kesimleri için ek belge yok, ancak İsviçre’de CHF geçer.

Ne zaman
Refuge’ler Haziran ortasından Eylül ortasına açıktır. Temmuz–Ağustos en kalabalık; Haziran başı yüksek geçitlerde kar (Col du Bonhomme, Fenêtre d’Arpette), Eylül berrak ve sakin. UTMB yarışı (Ağustos sonu) haftasında Chamonix dolar.

İzinler
İzin yok. Refuge ve gîte rezervasyonu ise zorunludur: Temmuz–Ağustos için Şubat–Mart’ta rezervasyon (montourdumontblanc.com tek merkez). Vahşi kamp Fransa’da 19:00–07:00 bivak toleransıyla, İtalya’da park dışında, İsviçre’de kantona göre değişir; refuge yakınında kamp alanları var.

Konaklama
Refuge yarım pansiyonu 60–80 EUR (yatakhane, akşam yemeği, kahvaltı), gîte d’étape 50–70 EUR, köy otelleri 100+ EUR. Uyku tulumu astarı (liner) refuge’lerde zorunlu. Courmayeur ve Champex’te market ve çamaşır; Les Chapieux’de küçük büfe. Kredi kartı çoğu yerde geçer, dağ kulübelerinde nakit güvenli.

Aklimatizasyon
Maksimum irtifa 2.665 m (Fenêtre d’Arpette) — AMS riski yok. Zorluk günlük 1.000–1.400 m tırmanış ve inişten gelir; kondisyon ve diz koruması esas. Teleferikler (Bellevue, Courmayeur–Chécrouit, Flégère) uzun günleri kısaltır.

Bütçe
11 gün yarım pansiyon refuge ile 900–1.200 EUR, otel ağırlıklı 1.800+ EUR; ulaşım 100 EUR. Toplam 45.000–95.000 ₺ (uçuş hariç).

Riskler
Öğleden sonra fırtınası (Alpler’de Temmuz–Ağustos her gün olabilir; geçitleri 14:00’ten önce geçin), haziranda kar yamaçları, Fenêtre d’Arpette’te kaya düşmesi, sıcak çarpması (vadi tabanı 30 °C). İnek ve koyun koruma köpekleri (patou) — durun, sakin geçin.

Bağlantı & para
Bütün köylerde 4G; refuge’lerde Wi-Fi nadiren. Avrupa sağlık sigortası/kurtarma sigortası (örn. Club Alpin “Carte Vieux Campeur”) helikopter maliyetini karşılar; Fransa’da kurtarma PGHM ile ücretsiz, İtalya ve İsviçre’de ücretlidir.`,
    maxElevationM: 2665,
    typicalDays: 11,
    totalDistanceKm: 170,
    difficulty: 'moderate',
    bestMonths: [6, 7, 8, 9],
    transports: [
      {
        mode: 'flight',
        from: 'İstanbul (IST)',
        to: 'Cenevre (GVA)',
        durationMin: 190,
        costTry: 14000,
        note: 'Direkt, gidiş-dönüş.',
      },
      {
        mode: 'bus',
        from: 'Cenevre Havalimanı',
        to: 'Chamonix',
        durationMin: 90,
        costTry: 1800,
        note: 'Paylaşımlı shuttle; FlixBus daha ucuz.',
      },
      {
        mode: 'train',
        from: 'Chamonix',
        to: 'Les Houches',
        durationMin: 10,
        costTry: 150,
        note: 'Mont Blanc Express; konaklama kartıyla ücretsiz.',
      },
    ],
    permits: [
      {
        name: 'Refuge rezervasyonu',
        costTry: null,
        where: 'montourdumontblanc.com',
        note: 'İzin yok; Temmuz–Ağustos için 4–5 ay önce rezervasyon.',
      },
    ],
    budgetTry: { low: 45000, high: 95000 },
    risks: [
      'Öğleden sonra fırtınası ve yıldırım (geçitler)',
      'Haziran kar yamaçları',
      'Fenêtre d’Arpette’te kaya düşmesi',
      'Sıcak çarpması, dehidrasyon',
      'Koruma köpekleri (patou)',
    ],
    gear: [
      'Uyku tulumu astarı (refuge zorunlu)',
      'Hafif hardshell + yağmur pantolonu',
      'Trekking batonu',
      'Şapka, 50 krem',
      'Mikro krampon (Haziran)',
      'Kulak tıkacı (yatakhane)',
      'Nakit EUR + CHF',
    ],
    rescueNote:
      'Fransa: PGHM Chamonix (+33 4 50 53 16 89) ya da 112; İtalya: 118 (Soccorso Alpino); İsviçre: 1414 (Rega). Her refuge’de telsiz/telefon var.',
    insuranceRequired: false,
    stageCount: tmbStages.length,
    rating: 4.8,
    reviewCount: 2650,
    sources: [
      'https://en.wikivoyage.org/wiki/Tour_du_Mont_Blanc',
      'https://www.montourdumontblanc.com',
      'https://www.autourdumontblanc.com',
    ],
    updatedAt: UPDATED,
  },
  {
    id: HAUTE_ID,
    slug: 'walkers-haute-route',
    name: 'Haute Route (Chamonix – Zermatt)',
    region: 'Valais Alpleri',
    countryCode: 'CH',
    type: 'trek',
    adventureTypes: ['hiking'],
    coords: { latitude: 46.0578, longitude: 7.3689 },
    imageUrl: unsplash('1508739773434-c26b3d09e071'),
    summary:
      'Mont Blanc’tan Matterhorn’a 11 geçit, 180 km ve 12.000 m tırmanış: yürüyüşçü Haute Route’u. Alplerin en iddialı kulübe-kulübe traversi.',
    guide: `Nasıl gidilir
Chamonix başlangıç (Cenevre’den 1,5 saat), Zermatt bitiş (Visp’e tren, Cenevre/Zürih’e 3 saat). İsviçre tren ağı her etaba kaçış noktası sunar; Swiss Half Fare Card teleferik ve trenleri yarı fiyata indirir.

Ne zaman
Temmuz ortası–Eylül ortası. Haziranda Prafleuri ve Riedmatten geçitlerinde kar; Eylül sonunda kulübeler kapanır. Europaweg’in kaya düşmesi kesimleri sık kapanır — Europahütte’ye güncel durumu sorun.

İzinler
İzin yok; kulübe rezervasyonu şart (SAC kulübeleri online). Kamp yüksek Alp bölgelerinde çoğu kantonda yasaktır.

Konaklama
SAC kulübeleri yarım pansiyon 70–90 CHF; köylerde otel 120+ CHF. Kulübelerde nakit CHF, bazılarında kart. Yatakhane, battaniye var, liner zorunlu.

Aklimatizasyon
Maksimum 2.965 m; AMS sorun değil. Zorluk uzun geçit günleri (8–9 saat) ve teknik iniş kesimleri: Pas de Chèvres merdivenleri, Col de Riedmatten kaya çığı, Prafleuri moreni. Fitness ve güvenli adım şart.

Bütçe
12 gün için 1.600–2.400 CHF konaklama ve yemek; İsviçre pahalıdır. Toplam 75.000–130.000 ₺.

Riskler
Fırtına ve yıldırım, buzlu geçitler, kaya düşmesi (Europaweg), yol kaybı (sis). Zorunlu: harita/GPS, erken çıkış.

Bağlantı & para
Köylerde 4G, kulübelerde zayıf. Rega (1414) helikopter kurtarma; Rega üyeliği (40 CHF/yıl) maliyeti kaldırır.`,
    maxElevationM: 2965,
    typicalDays: 12,
    totalDistanceKm: 180,
    difficulty: 'hard',
    bestMonths: [7, 8, 9],
    transports: [
      {
        mode: 'flight',
        from: 'İstanbul (IST)',
        to: 'Cenevre (GVA)',
        durationMin: 190,
        costTry: 14000,
        note: 'Direkt, gidiş-dönüş.',
      },
      {
        mode: 'train',
        from: 'Zermatt',
        to: 'Cenevre',
        durationMin: 220,
        costTry: 4500,
        note: 'Visp aktarmalı; Half Fare Card ile yarı fiyat.',
      },
    ],
    permits: [
      {
        name: 'SAC kulübe rezervasyonu',
        costTry: null,
        where: 'sac-cas.ch / kulübe siteleri',
        note: 'İzin yok; yaz için 2–3 ay önce.',
      },
    ],
    budgetTry: { low: 75000, high: 130000 },
    risks: [
      'Fırtına ve yıldırım (geçitler)',
      'Kaya düşmesi (Europaweg, Riedmatten)',
      'Buzlu kar yamaçları (Temmuz başı)',
      'Sisde yol kaybı',
    ],
    gear: [
      'Liner + kulübe terliği',
      'Hardshell, eldiven, bere',
      'Baton, mikro krampon (erken sezon)',
      'GPS / çevrimdışı harita',
      'Nakit CHF',
    ],
    rescueNote:
      'Rega (1414) ve Air Zermatt (+41 27 966 86 86); kulübe bekçileri telsizle çağırır. 112 her yerde çalışır.',
    insuranceRequired: false,
    stageCount: hauteStages.length,
    rating: 4.7,
    reviewCount: 640,
    sources: [
      'https://en.wikivoyage.org/wiki/Haute_Route',
      'https://www.sac-cas.ch',
      'https://www.myswitzerland.com',
    ],
    updatedAt: UPDATED,
  },
  {
    id: ACONCAGUA_ID,
    slug: 'aconcagua-normal-route',
    name: 'Aconcagua Normal Rota',
    region: 'Mendoza, And Dağları',
    countryCode: 'AR',
    type: 'expedition',
    adventureTypes: ['climbing', 'hiking'],
    coords: { latitude: -32.6532, longitude: -70.0109 },
    imageUrl: unsplash('1547234935-80c7145ec969'),
    summary:
      'Amerika kıtasının çatısı (6961 m): teknik olmayan ama irtifası acımasız 18–20 günlük ekspedisyon. Plaza de Mulas’tan üç yüksek kamp, katır lojistiği ve zorunlu tıbbi kontroller.',
    guide: `Nasıl gidilir
İstanbul → Buenos Aires ~17 saat, Buenos Aires → Mendoza 2 saat. Mendoza’da permi ve alışveriş 1–2 gün; Penitentes/Los Puquios’a 3,5 saat transfer (Ruta 7, Şili sınırına doğru). Katır servisi ekipmanı Plaza de Mulas’a taşır (kişi başı ~25 kg). Sezon Kasım 15 – Mart 15.

Ne zaman
Aralık–Ocak en sıcak ve en stabil (yine de zirve gecesi -25 °C). Kasım ve Şubat sonu daha ucuz permi, daha soğuk ve fırtınalı. Zirve başarı oranı ~%40; hava pencereleri için 3–4 gün yedek gerekir.

İzinler
Aconcagua Eyalet Parkı permisi Mendoza’daki resmî ofisten yalnızca bizzat alınır: yüksek sezon tırmanış permisi ~1.000 USD (20 gün), düşük sezon 600–800 USD; Türk vatandaşları için yabancı tarifesi. Rehber zorunlu değildir ama tek başına tırmananların ranger ile check-in yapması, Confluencia ve Plaza de Mulas’ta tıbbi kontrolden geçmesi şarttır (SpO₂ ve tansiyon; doktor yasaklayabilir). Katı atık torbası (kişi başı numaralı) girişte verilir, çıkışta kontrol edilir.

Konaklama
Plaza de Mulas’ta servis şirketleri (Inka, Grajales, Fernando Grajales) yemek çadırı, tuvalet, Wi-Fi ve sıcak duş sunar; kişisel çadır yüksek kamplarda. Kamp 1 Canadá, Kamp 2 Nido de Cóndores, Kamp 3 Cólera — su yok, kar eritilir.

Aklimatizasyon
Confluencia (3400 m) 2 gece + Plaza Francia yürüyüşü, Plaza de Mulas (4370 m) 3 gece + Bonete (5004 m), ardından yük taşıma-inme döngüsü: Canadá’ya carry ve dönüş, Nido’ya carry ve dönüş, sonra kamplara yerleşme. Nido’da (5560 m) bir dinlenme günü. Cólera’dan (5970 m) zirveye 8–10 saat, iniş 3–4 saat. Toplam 18–20 gün planlanır.

Bütçe
Permi ~1.000 USD, katır 300–400 USD, ana kamp servisi 800–1.500 USD, rehberli ekspedisyon 4.500–6.500 USD. Bireysel toplam 130.000–280.000 ₺ (uçuş hariç).

Riskler
İrtifa (HAPE/HACE her sezon ölüm nedeni), Viento Blanco (beyaz rüzgâr) 100+ km/s, donma (Canaleta’da parmak kayıpları sık), dehidrasyon, Canaleta’da kaya düşmesi. 14:00 zirve dönüş saati kuralı; ranger’lar 6.000 m üstünde SpO₂ kontrolü yapar ve indirir.

Bağlantı & para
Plaza de Mulas’ta ücretli Wi-Fi ve uydu telefon; yüksek kamplarda yalnızca uydu. Nakit ARS/USD Mendoza’da. Helikopter Plaza de Mulas’a kadar iner (park helikopteri, permi ücretine kısmen dahil); üst kamplardan taşıma ranger ve tırmanıcılarla.`,
    maxElevationM: 6961,
    typicalDays: 19,
    totalDistanceKm: 75,
    difficulty: 'extreme',
    bestMonths: [12, 1, 2],
    transports: [
      {
        mode: 'flight',
        from: 'İstanbul (IST)',
        to: 'Buenos Aires (EZE)',
        durationMin: 1020,
        costTry: 55000,
        note: 'Aktarmalı (São Paulo), gidiş-dönüş.',
      },
      {
        mode: 'flight',
        from: 'Buenos Aires (AEP)',
        to: 'Mendoza (MDZ)',
        durationMin: 120,
        costTry: 5500,
        note: 'Aerolíneas/Flybondi; 23 kg bagaj ekle.',
      },
      {
        mode: 'bus',
        from: 'Mendoza',
        to: 'Penitentes / Horcones',
        durationMin: 210,
        costTry: 1500,
        note: 'Servis şirketi transferi ya da Uspallata otobüsü.',
      },
      {
        mode: 'trek',
        from: 'Horcones',
        to: 'Plaza de Mulas',
        durationMin: 780,
        costTry: 16000,
        note: '2 gün; katır servisi (25 kg) fiyatı dahil.',
      },
    ],
    permits: [
      {
        name: 'Aconcagua Eyalet Parkı tırmanış permisi',
        costTry: 42000,
        where: 'Mendoza, Centro de Visitantes (bizzat)',
        note: 'Yüksek sezon ~1.000 USD / 20 gün; pasaport + sigorta beyanı.',
      },
    ],
    budgetTry: { low: 130000, high: 280000 },
    risks: [
      'HAPE / HACE — her sezon can kaybı',
      'Viento Blanco: 100+ km/s rüzgâr ve -30 °C hissedilen',
      'Donma (Canaleta, zirve sırtı)',
      'Canaleta’da kaya düşmesi',
      'Tıbbi kontrolde geri çevrilme (SpO₂ < 80)',
      'Dehidrasyon ve iştah kaybı (kilo kaybı 5+ kg)',
    ],
    gear: [
      'Çift katlı bot (Olympus Mons / Spantik sınıfı)',
      '-30 °C uyku tulumu',
      'Ekspedisyon tulum ya da kaz tüyü parka + pantolon',
      'Krampon, kazma (Cólera üstü için)',
      '4 mevsim çadır (rüzgâr dayanımı)',
      'Ocak + yakıt (kar eritme), 2 termos',
      'Kategori 4 buzul gözlüğü + kar gözlüğü',
      'Uydu telefon / inReach',
      'Pulse oksimetre, deksametazon (doktorla)',
    ],
    rescueNote:
      'Park doktorları Confluencia ve Plaza de Mulas’ta; ranger (guardaparque) telsiz ağı tüm kamplarda. Helikopter Plaza de Mulas’a kadar. Acil: 911 (Mendoza), park telsizi kanal 1. Hastane: Hospital Central Mendoza.',
    insuranceRequired: true,
    stageCount: aconcaguaStages.length,
    rating: 4.6,
    reviewCount: 380,
    sources: ['https://en.wikivoyage.org/wiki/Aconcagua', 'https://www.aconcagua.mendoza.gov.ar'],
    updatedAt: UPDATED,
  },
  {
    id: ELBRUS_ID,
    slug: 'elbrus-south',
    name: 'Elbrus Güney Rotası',
    region: 'Kabardey-Balkar, Kafkasya',
    countryCode: 'RU',
    type: 'expedition',
    adventureTypes: ['climbing', 'skiing'],
    coords: { latitude: 43.3499, longitude: 42.4453 },
    imageUrl: unsplash('1519681393784-d120267933ba'),
    summary:
      'Avrupa’nın en yüksek zirvesi (5642 m) teleferik ve varil kulübeleriyle 7–8 günde. Teknik olarak kolay, hava ve irtifa açısından ciddi bir buzul tırmanışı.',
    guide: `Nasıl gidilir
İstanbul → Mineralnye Vody (MRV) direkt 3 saat (vize gerekli; Türk vatandaşları için e-vize). Havalimanından Terskol/Azau’ya transfer 3 saat. Azau’dan üç kademeli teleferik Garabashi’ye (3850 m) çıkar.

Ne zaman
Haziran sonu–Ağustos; Temmuz en stabil. Mayıs ve Eylül kayakla tırmanış sezonu.

İzinler
Sınır bölgesi izni (propusk) Terskol için gerekmez; ulusal park giriş ücreti küçüktür ve tur şirketi düzenler. Kayıt MChS (acil durum bakanlığı) Terskol ofisine yapılmalıdır — kurtarma bu kayıtla başlar.

Konaklama
Terskol/Azau otelleri; dağda Garabashi varilleri (Bochki) ve LeapRus kapsül kulübesi (3900 m). Mutfak ve şarj var, su karla.

Aklimatizasyon
Terskol’da Cheget (3000 m) yürüyüşü, Garabashi’de 2 gece + Pastukhov Kayaları (4700 m) aklimatizasyon. Zirve gecesi 02:00 snowcat ile Pastukhov’a çıkış yaygındır; Sedlovina (5300 m) eyerinden batı zirveye sabit ipli traverse.

Bütçe
Rehberli 7 gün tur 900–1.500 USD, snowcat 100–150 USD/kişi, teleferik 30 USD. Toplam 55.000–110.000 ₺ (uçuş hariç).

Riskler
Beyaz-karanlık ve ani hava değişimi (yönünü kaybetmek ana ölüm nedeni), crevasse (rota dışına çıkmayın), donma ve AMS. Zirve dönüş saati 13:00.

Bağlantı & para
Terskol’da 4G ve ATM (Mir kartı; yabancı kartlar çalışmayabilir — nakit RUB). Kurtarma MChS ile ücretsiz ama helikopter sınırlı; sigorta şart.`,
    maxElevationM: 5642,
    typicalDays: 8,
    totalDistanceKm: 30,
    difficulty: 'hard',
    bestMonths: [6, 7, 8],
    transports: [
      {
        mode: 'flight',
        from: 'İstanbul (IST)',
        to: 'Mineralnye Vody (MRV)',
        durationMin: 180,
        costTry: 16000,
        note: 'Direkt; e-vize gerekli.',
      },
      {
        mode: 'taxi',
        from: 'MRV Havalimanı',
        to: 'Terskol / Azau',
        durationMin: 180,
        costTry: 2500,
        note: 'Paylaşımlı transfer.',
      },
    ],
    permits: [
      {
        name: 'Elbrus Milli Parkı girişi + MChS kaydı',
        costTry: 400,
        where: 'Terskol (tur şirketi)',
        note: 'Kayıt zorunlu, ücret sembolik.',
      },
    ],
    budgetTry: { low: 55000, high: 110000 },
    risks: [
      'Beyaz-karanlıkta yön kaybı',
      'Crevasse (rota dışı)',
      'Donma ve AMS',
      'Hızlı irtifa: teleferikle 3850 m’ye çıkış',
    ],
    gear: [
      'Krampon, kazma, emniyet kemeri',
      'Çift ya da yalıtımlı bot',
      '-20 °C uyku tulumu',
      'Kaz tüyü mont, kar gözlüğü',
      'GPS (beyaz-karanlık için)',
    ],
    rescueNote:
      'MChS Elbrus kurtarma birimi Terskol (+7 866 38 71489); kayıt olmadan çıkmayın. Acil 112.',
    insuranceRequired: true,
    stageCount: elbrusStages.length,
    rating: 4.4,
    reviewCount: 290,
    sources: ['https://en.wikivoyage.org/wiki/Mount_Elbrus'],
    updatedAt: UPDATED,
  },
  {
    id: AGRI_ID,
    slug: 'agri-dagi',
    name: 'Ağrı Dağı (Ararat)',
    region: 'Doğubayazıt, Ağrı',
    countryCode: 'TR',
    type: 'expedition',
    adventureTypes: ['climbing', 'hiking'],
    coords: { latitude: 39.7019, longitude: 44.2983 },
    imageUrl: unsplash('1596484552834-6a58f850e0a1'),
    summary:
      'Türkiye’nin çatısı 5137 m: Eli Köyü’nden 3200 ve 4200 m kamplarıyla 4–5 günlük buzullu volkan tırmanışı. İzin ve rehber zorunlu.',
    guide: `Nasıl gidilir
İstanbul’dan Ağrı (AJI) ya da Iğdır (IGD) havalimanına 2,5 saat uçuş; Doğubayazıt’a Ağrı’dan 1,5 saat, Iğdır’dan 45 dakika. Doğubayazıt’ta rehber acenteleri Eli Köyü transferini (jeep 1 saat) ve katırları düzenler.

Ne zaman
Haziran sonu–Eylül ortası; Temmuz–Ağustos en stabil, Eylül berrak ama soğuk. Kışın yalnızca deneyimli kayak-tırmanış ekipleri.

İzinler
Tırmanış izni Doğubayazıt Kaymakamlığı/Valilik onayıyla yalnızca lisanslı acente aracılığıyla alınır: pasaport/kimlik fotokopisi, 3–7 iş günü, ücret sembolik ama acente hizmet bedeli var. Rehbersiz tırmanış yasak; kontrol noktaları jandarma tarafından yapılır. Şubat-Mart dışında sınır güvenliği nedeniyle izin bazen askıya alınır — güncel durumu sorun.

Konaklama
Doğubayazıt otelleri; dağda çadırlı kamp. 1. kamp (3200 m) çimenlik, kaynak suyu; 2. kamp (4200 m) taşlık ve rüzgârlı, su kar eritilerek. Acente ortak yemek çadırı kurar.

Aklimatizasyon
Standart 4 gün: Eli Köyü → 1. kamp, 2. kampa yük taşıyıp 1. kampa dönüş (aklimatizasyon), 2. kampa çıkış, 02:00 zirve ve 1. kampa iniş. 5 günlük plan 1. kampta ek dinlenme günü ekler ve başarıyı artırır.

Bütçe
Acente paketi (izin, rehber, katır, yemek, kamp) 12.000–25.000 ₺; ulaşım 6.000–9.000 ₺. Toplam 18.000–40.000 ₺.

Riskler
4.800 m üstünde buzul ve krevas (rehberi takip edin), zirve rüzgârı ve ani sis, AMS (2 günde 3.000 m kazanç), dolu ve fırtına (öğleden sonra). Hipotermi; Ağustos’ta bile zirve -10 °C.

Bağlantı & para
Doğubayazıt’ta ATM; dağda 1. kampa kadar zayıf 2G. Kurtarma jandarma ve AFAD/JAK ile; helikopter askerî onaya bağlı. Sigorta önerilir.`,
    maxElevationM: 5137,
    typicalDays: 5,
    totalDistanceKm: 26,
    difficulty: 'hard',
    bestMonths: [7, 8, 9],
    transports: [
      {
        mode: 'flight',
        from: 'İstanbul (IST/SAW)',
        to: 'Iğdır (IGD)',
        durationMin: 150,
        costTry: 5500,
        note: 'Gidiş-dönüş; Ağrı (AJI) alternatif.',
      },
      {
        mode: 'taxi',
        from: 'Iğdır',
        to: 'Doğubayazıt',
        durationMin: 45,
        costTry: 900,
        note: 'Minibüs 150 ₺.',
      },
      {
        mode: 'jeep',
        from: 'Doğubayazıt',
        to: 'Eli Köyü',
        durationMin: 60,
        costTry: 1200,
        note: 'Acente jeep’i; katırlar köyde yüklenir.',
      },
    ],
    permits: [
      {
        name: 'Ağrı Dağı tırmanış izni',
        costTry: 2000,
        where: 'Doğubayazıt Kaymakamlığı (acente aracılığıyla)',
        note: '3–7 iş günü; kimlik/pasaport fotokopisi; rehber zorunlu.',
      },
    ],
    budgetTry: { low: 18000, high: 40000 },
    risks: [
      'Buzul ve krevas (4.800 m üstü)',
      'AMS: 2 günde 3.000 m',
      'Zirve fırtınası ve sis',
      'Hipotermi, donma',
      'İzin iptali (güvenlik)',
    ],
    gear: [
      'Krampon, kazma, kask',
      '-15 °C uyku tulumu',
      'Kaz tüyü mont, kar gözlüğü',
      'Baş lambası (02:00 çıkış)',
      'Tayt-hardshell katmanları',
      'Su arıtma (1. kamp)',
    ],
    rescueNote:
      'Doğubayazıt Devlet Hastanesi ve 112; dağ kurtarma Jandarma JAK / AFAD Ağrı. Acente telsiz ağı 1. kampa kadar.',
    insuranceRequired: false,
    stageCount: agriStages.length,
    rating: 4.6,
    reviewCount: 730,
    sources: [
      'https://tr.wikivoyage.org/wiki/A%C4%9Fr%C4%B1_Da%C4%9F%C4%B1',
      'https://www.dogubayazit.gov.tr',
    ],
    updatedAt: UPDATED,
  },
  {
    id: KACKAR_ID,
    slug: 'kackar-daglari',
    name: 'Kaçkar Dağları',
    region: 'Rize – Artvin, Doğu Karadeniz',
    countryCode: 'TR',
    type: 'trek',
    adventureTypes: ['hiking', 'climbing'],
    coords: { latitude: 40.8321, longitude: 41.1594 },
    imageUrl: unsplash('1464822759023-fed622ff2c3b'),
    summary:
      'Ayder’den Yukarı Kavrun, Dilberdüzü ve buzul gölleriyle Kaçkar zirvesi (3937 m). Yaylalar, sis ve kaplıcalarla 3–4 günlük Karadeniz klasiği.',
    guide: `Nasıl gidilir
İstanbul’dan Rize-Artvin Havalimanı’na (RZV) 2 saat; havalimanından Ayder’e 1,5 saat (Pazar/Çamlıhemşin üzerinden minibüs ya da araç kiralama). Ayder’den Yukarı Kavrun’a yaz aylarında sabah dolmuşu ya da jeep (45 dk). Alternatif giriş Yusufeli/Barhal → Olgunlar (Artvin tarafı).

Ne zaman
Temmuz–Eylül; Ağustos en kalabalık (Dilberdüzü çadır kenti). Haziran karlı, Eylül sonu berrak ve sakin. Sabah 05:00–10:00 arası açık, öğleden sonra sis ve yağmur olağan; zirve gün doğumu için planlanır.

İzinler
İzin yok. Kaçkar Dağları Milli Parkı içinde kamp serbest, ateş yasak; yaylalarda köy evi konaklaması için önceden aramak iyi olur.

Konaklama
Ayder pansiyon ve kaplıca tesisleri; Yukarı Kavrun yayla pansiyonları (ev yemeği, sınırlı sıcak su). Dilberdüzü ve Deniz Gölü çadır. Rehber ya da katırcı Kavrun’da bulunur.

Aklimatizasyon
2300 m’den 3400 m’ye iki günde çıkılır; AMS nadirdir ama zirve gecesi kampında baş ağrısı görülür. Dilberdüzü’nde bir gece klasik. Zirtan son bölümü kar-kaya (UIAA I–II); Temmuz’da mikro krampon işe yarar.

Bütçe
Uçuş 4.000–7.000 ₺, transfer 1.000–2.000 ₺, pansiyon 1.500 ₺/gece, rehber 3.000–5.000 ₺/gün. Toplam 8.000–25.000 ₺.

Riskler
Sis ve yön kaybı (zirve inişi), ıslak kaya, ani dolu/yıldırım, hipotermi (Ağustos’ta gece 0 °C), Deniz Gölü kampında rüzgâr. Ayı görülür, sorun çıkarmaz; yiyeceği çadırdan uzakta tutun.

Bağlantı & para
Ayder’de ATM; Kavrun’dan sonra nakit ve zayıf 2G. Kurtarma: 112 ve Rize AKUT/JAK; Dilberdüzü sezonluk jandarma noktası.`,
    maxElevationM: 3937,
    typicalDays: 4,
    totalDistanceKm: 35,
    difficulty: 'moderate',
    bestMonths: [7, 8, 9],
    transports: [
      {
        mode: 'flight',
        from: 'İstanbul (IST/SAW)',
        to: 'Rize-Artvin (RZV)',
        durationMin: 120,
        costTry: 5000,
        note: 'Gidiş-dönüş; Trabzon (TZX) alternatif.',
      },
      {
        mode: 'bus',
        from: 'RZV Havalimanı',
        to: 'Ayder',
        durationMin: 90,
        costTry: 400,
        note: 'Pazar’dan Çamlıhemşin–Ayder minibüsü.',
      },
      {
        mode: 'jeep',
        from: 'Ayder',
        to: 'Yukarı Kavrun',
        durationMin: 45,
        costTry: 300,
        note: 'Sabah dolmuşu; özel jeep 1.500 ₺.',
      },
    ],
    permits: [],
    budgetTry: { low: 8000, high: 25000 },
    risks: [
      'Sis ve yön kaybı',
      'Islak kaya, kar yamaçları (Temmuz)',
      'Yıldırım ve dolu (öğleden sonra)',
      'Gece soğuğu (0 °C)',
    ],
    gear: [
      '0 °C uyku tulumu',
      'Yağmurluk (Karadeniz!)',
      'Baton, mikro krampon (erken sezon)',
      'Baş lambası',
      'GPS / çevrimdışı harita (sis)',
    ],
    rescueNote:
      '112; Rize/Artvin JAK ve AKUT Karadeniz ekipleri. Dilberdüzü’nde sezonluk jandarma noktası. Ayder’de sağlık ocağı, hastane Pazar/Rize.',
    insuranceRequired: false,
    stageCount: kackarStages.length,
    rating: 4.7,
    reviewCount: 1120,
    sources: [
      'https://tr.wikivoyage.org/wiki/Ka%C3%A7kar_Da%C4%9Flar%C4%B1',
      'https://www.tarimorman.gov.tr',
    ],
    updatedAt: UPDATED,
  },
  {
    id: LIKYA_ID,
    slug: 'likya-yolu',
    name: 'Likya Yolu',
    region: 'Fethiye – Antalya, Teke Yarımadası',
    countryCode: 'TR',
    type: 'trek',
    adventureTypes: ['hiking'],
    coords: { latitude: 36.3111, longitude: 30.4747 },
    imageUrl: unsplash('1519046904884-53103b34b206'),
    summary:
      'Fethiye’den Antalya’ya 500+ km işaretli kıyı yolu: antik Likya kentleri, koylar, Tahtalı (2366 m) ve köy pansiyonları. Bölüm bölüm ya da tam 25–30 gün.',
    guide: `Nasıl gidilir
Batı başlangıç Ovacık için Dalaman Havalimanı (DLM) 1 saat + Fethiye dolmuşu; doğu ucu Antalya Havalimanı (AYT). Rota kıyı yolunu izlediği için hemen her etaba dolmuşla girip çıkılabilir; en sevilen bölümler Ovacık–Kabak (2 gün), Kaş–Kekova (3 gün) ve Adrasan–Olimpos–Göynük (3 gün).

Ne zaman
Mart–Mayıs (çiçekler, 20 °C) ve Ekim–Kasım. Yaz ayları kıyıda 35 °C+, sabah 05:30 çıkışla kısa etaplar yürünür; kış yağmurlu ama ılık, dereler taşar.

İzinler
İzin yok. Rota Kültür Rotaları Derneği tarafından kırmızı-beyaz işaretlidir; Olimpos ve Patara antik alanlarında giriş ücreti (Müzekart geçer). Vahşi kamp çoğu yerde tolere edilir, milli park sınırlarında kural değişir.

Konaklama
Köy pansiyonları (1.000–2.500 ₺, ev yemeği), Kabak ve Adrasan’da kamp/bungalov, Kaş ve Kalkan’da otel. Yaz sezonunda önceden arayın; kışın çoğu kapalı.

Aklimatizasyon
İrtifa yok; ısı ve su asıl mesele. Etaplar 15–25 km, kıyıda 700–1.000 m günlük tırmanış-iniş. Tahtalı zirvesi isteğe bağlı; Beycik’ten 1.500 m.

Bütçe
Günlük 1.500–3.000 ₺ pansiyon + yemek; kamp ile 500 ₺. 10 günlük bölüm 12.000–35.000 ₺.

Riskler
Sıcak çarpması, susuzluk (çeşmeler arası 15 km olabilir — 3 L taşıyın), Kelebekler Vadisi inişi (halatlı, düşme ölümleri var), kaygan kireç taşı, kene, yaban domuzu. Yazın orman yangını riskinde yollar kapanabilir; Temmuz–Ağustos’ta valilik yasağı çıkarsa etabı erteleyin.

Bağlantı & para
Hemen her yerde 4G; köylerde nakit. Kurtarma 112 ve AKUT Antalya; kıyı etaplarında Sahil Güvenlik 158.`,
    maxElevationM: 2366,
    typicalDays: 10,
    totalDistanceKm: 200,
    difficulty: 'moderate',
    bestMonths: [3, 4, 5, 10, 11],
    transports: [
      {
        mode: 'flight',
        from: 'İstanbul (IST/SAW)',
        to: 'Dalaman (DLM)',
        durationMin: 80,
        costTry: 3500,
        note: 'Gidiş; dönüş Antalya (AYT).',
      },
      {
        mode: 'bus',
        from: 'Dalaman',
        to: 'Fethiye / Ovacık',
        durationMin: 75,
        costTry: 250,
        note: 'Havaş + Ölüdeniz dolmuşu.',
      },
      {
        mode: 'bus',
        from: 'Göynük',
        to: 'Antalya',
        durationMin: 60,
        costTry: 120,
        note: 'Kemer–Antalya halk otobüsü.',
      },
    ],
    permits: [
      {
        name: 'Antik alan girişleri (Patara, Olimpos)',
        costTry: 300,
        where: 'Alan gişeleri / Müzekart',
        note: 'Rota izni yok.',
      },
    ],
    budgetTry: { low: 12000, high: 35000 },
    risks: [
      'Sıcak çarpması ve su yetersizliği',
      'Kelebekler Vadisi inişi (halat)',
      'Kaygan kireç taşı',
      'Orman yangını (yaz)',
      'Kene',
    ],
    gear: [
      '3 L su + filtre',
      'Geniş kenarlı şapka, 50 krem',
      'Hafif yağmurluk (ilkbahar)',
      'Baton',
      'Sandalet (koy molaları)',
      'Kültür Rotaları rehber kitabı / GPX',
    ],
    rescueNote:
      '112 ve AKUT Antalya/Muğla; kıyıda Sahil Güvenlik 158. Kaş, Kalkan, Kemer’de hastane; Kaş’ta hiperbarik oda yok (Antalya).',
    insuranceRequired: false,
    stageCount: likyaStages.length,
    rating: 4.7,
    reviewCount: 1860,
    sources: [
      'https://en.wikivoyage.org/wiki/Lycian_Way',
      'https://cultureroutesinturkey.com/lycian-way',
    ],
    updatedAt: UPDATED,
  },
  {
    id: KAPADOKYA_ID,
    slug: 'kapadokya',
    name: 'Kapadokya Vadileri',
    region: 'Nevşehir, İç Anadolu',
    countryCode: 'TR',
    type: 'multi_sport',
    adventureTypes: ['hiking', 'climbing', 'paragliding', 'cycling'],
    coords: { latitude: 38.6431, longitude: 34.8289 },
    imageUrl: unsplash('1641128324972-af3212f0f6bd'),
    summary:
      'Göreme merkezli vadi yürüyüşleri (Kızılçukur, Meskendir, Güvercinlik, Ihlara), gün doğumu balon uçuşu, tüf kayada spor tırmanış ve gravel bisiklet. 3–5 günlük çok sporlu üs.',
    guide: `Nasıl gidilir
İstanbul’dan Nevşehir (NAV) 1,5 saat ya da Kayseri (ASR) 1,5 saat uçuş; havalimanı shuttle’ları Göreme/Ürgüp’e 45–60 dakika (~600 ₺). Otobüsle 10–11 saat. Göreme’den bütün vadilere yürüyerek ya da dolmuşla ulaşılır; Ihlara için araç/tur gerekir (1,5 saat).

Ne zaman
Nisan–Haziran ve Eylül–Ekim; balon uçuşları rüzgârdan Kasım–Mart’ta sık iptal olur ama kar manzarası eşsizdir. Temmuz–Ağustos 35 °C, vadilerde sabah yürüyüşü.

İzinler
Vadi yürüyüşleri ücretsiz; Göreme Açık Hava Müzesi, Zelve, Ihlara ve yeraltı şehirleri ücretli (Müzekart). Balon uçuşu için Sivil Havacılık lisanslı 20+ şirket; 05:00 kalkış, ~1 saat, 200–260 EUR. Tırmanış sektörleri (Ortahisar, Kızılçukur) serbest; ekipmanlı yerel rehberler var.

Konaklama
Mağara otelleri 2.000–15.000 ₺; Çavuşin ve Ortahisar’da pansiyon; Ihlara’da nehir kenarı pansiyon. Kamp Göreme’de (Kaya Camping).

Aklimatizasyon
1.100–1.400 m; irtifa etkisi yok. Vadiler 5–15 km, kaygan tüf inişleri ve dar tünellerle; baş lambası ve bol su.

Bütçe
Balon 8.000–10.000 ₺, ATV/at turu 1.500 ₺, tırmanış rehberi 3.000 ₺/yarım gün. 3 gün için 10.000–45.000 ₺.

Riskler
Kaya düşmesi ve tüf erozyonu (kaya kiliselerine sınırlar dışında girmeyin), balon iptali/sert iniş, yazın sıcak çarpması, vadide yön kaybı (işaretler eksik; çevrimdışı harita şart). Köpekler bazı vadilerde saldırgan olabilir; baton taşıyın ve grup hâlinde yürüyün.

Bağlantı & para
Her yerde 4G ve ATM. 112 ve Nevşehir Devlet Hastanesi 20 dakika; balon şirketleri sigortalıdır.`,
    maxElevationM: 1400,
    typicalDays: 3,
    totalDistanceKm: 40,
    difficulty: 'easy',
    bestMonths: [4, 5, 6, 9, 10],
    transports: [
      {
        mode: 'flight',
        from: 'İstanbul (IST/SAW)',
        to: 'Nevşehir (NAV) / Kayseri (ASR)',
        durationMin: 90,
        costTry: 4000,
        note: 'Gidiş-dönüş.',
      },
      {
        mode: 'bus',
        from: 'Havalimanı',
        to: 'Göreme',
        durationMin: 60,
        costTry: 600,
        note: 'Rezervasyonlu shuttle.',
      },
      {
        mode: 'taxi',
        from: 'Göreme',
        to: 'Ihlara Vadisi',
        durationMin: 90,
        costTry: 2500,
        note: 'Gün turu ya da kiralık araç.',
      },
    ],
    permits: [
      {
        name: 'Müze / vadi girişleri (Göreme AHM, Zelve, Ihlara)',
        costTry: 900,
        where: 'Gişeler / Müzekart',
        note: 'Vadi yürüyüşleri ücretsiz.',
      },
      {
        name: 'Balon uçuşu rezervasyonu',
        costTry: 9000,
        where: 'Lisanslı balon şirketi',
        note: '05:00 kalkış; hava iptalinde iade.',
      },
    ],
    budgetTry: { low: 10000, high: 45000 },
    risks: [
      'Kaya düşmesi / tüf çökmesi',
      'Balon sert inişi ve iptaller',
      'Yazın sıcak çarpması',
      'Vadide yön kaybı (işaret eksik)',
      'Saldırgan köpekler',
    ],
    gear: [
      'Baş lambası (tüneller)',
      'Kask (tırmanış)',
      '2 L su, şapka',
      'Çevrimdışı harita',
      'Bisiklet: gravel/MTB kiralık',
    ],
    rescueNote:
      '112; Nevşehir Devlet Hastanesi ve Ürgüp Devlet Hastanesi 15–25 dk. Ihlara vadisinde ranger/jandarma noktası.',
    insuranceRequired: false,
    stageCount: kapadokyaStages.length,
    rating: 4.6,
    reviewCount: 2400,
    sources: ['https://en.wikivoyage.org/wiki/Cappadocia', 'https://muze.gov.tr'],
    updatedAt: UPDATED,
  },
  {
    id: CHALTEN_ID,
    slug: 'el-chalten-fitz-roy',
    name: 'El Chaltén — Fitz Roy & Cerro Torre',
    region: 'Los Glaciares Milli Parkı, Patagonya',
    countryCode: 'AR',
    type: 'trek',
    adventureTypes: ['hiking', 'climbing'],
    coords: { latitude: -49.2917, longitude: -73.0022 },
    imageUrl: unsplash('1502920917128-1aa500764cbd'),
    summary:
      'Arjantin’in trekking başkenti: Laguna de los Tres ve Laguna Torre’ye ücretsiz kamplı 3–4 günlük tur; Fitz Roy gün doğumu, izin yok, rüzgâr çok.',
    guide: `Nasıl gidilir
İstanbul → Buenos Aires ~17 saat, Buenos Aires → El Calafate 3 saat; El Calafate’den El Chaltén otobüsü 3 saat (Chaltén Travel, Cal-Tur; ~40 USD gidiş-dönüş). Kasabaya girişte park ranger ofisi kısa brifing verir.

Ne zaman
Kasım–Mart; Aralık–Şubat en kalabalık. Ekim ve Nisan sakin, kar mümkün. Fitz Roy’un bulutsuz görünmesi için 3–4 gün ayırın.

İzinler
Los Glaciares Kuzey sektöründe giriş ücreti yok; kamplar (Capri, Poincenot, De Agostini) ücretsiz ve rezervasyonsuz, ateş yasak, tuvalet var. Ranger ofisine kayıt tavsiye edilir. Tırmanış için ayrı kayıt (Cerro Torre, Fitz Roy).

Konaklama
Kasabada hostel ve kabin (30–120 USD), market pahalı ve sınırlı, ATM sık boşalır (nakit ARS/USD getirin). Kamplarda dere suyu içilebilir (Patagonya’nın ayrıcalığı).

Aklimatizasyon
1.170 m’de irtifa sorunu yok. Laguna de los Tres’in son 400 m’si dik ve rüzgârlı; kar/buzda ranger kapatır.

Bütçe
Otobüs 40 USD, hostel 30–50 USD/gece, yemek 25 USD/gün. 4 gün için 20.000–55.000 ₺ (Arjantin içi uçuş dahil).

Riskler
Rüzgâr (120 km/s), hipotermi, Los Tres tırmanışında düşme, dere geçişleri (Río Blanco), yangın yasağı ihlali. Puma nadir.

Bağlantı & para
Kasabada zayıf 4G ve Wi-Fi; vadilerde sinyal yok. Kurtarma ranger + gönüllü ekiplerle, helikopter nadir; sigorta önerilir.`,
    maxElevationM: 1170,
    typicalDays: 4,
    totalDistanceKm: 45,
    difficulty: 'moderate',
    bestMonths: [11, 12, 1, 2, 3],
    transports: [
      {
        mode: 'flight',
        from: 'İstanbul (IST)',
        to: 'Buenos Aires (EZE)',
        durationMin: 1020,
        costTry: 55000,
        note: 'Aktarmalı, gidiş-dönüş.',
      },
      {
        mode: 'flight',
        from: 'Buenos Aires (AEP)',
        to: 'El Calafate (FTE)',
        durationMin: 190,
        costTry: 7000,
        note: 'Aerolíneas Argentinas.',
      },
      {
        mode: 'bus',
        from: 'El Calafate',
        to: 'El Chaltén',
        durationMin: 180,
        costTry: 1700,
        note: 'Günde 3–4 sefer; erken rezervasyon.',
      },
    ],
    permits: [],
    budgetTry: { low: 20000, high: 55000 },
    risks: [
      'Aşırı rüzgâr ve hipotermi',
      'Los Tres son tırmanışta düşme',
      'Dere geçişleri',
      'Yangın yasağı',
    ],
    gear: [
      'Rüzgâr geçirmez kabuk',
      '-5 °C uyku tulumu, rüzgâra dayanıklı çadır',
      'Baton',
      'Tüp ocağı (kasabada gaz)',
      'Nakit ARS',
    ],
    rescueNote:
      'Ranger ofisi El Chaltén (Parques Nacionales) ve gönüllü Comisión de Auxilio; 911 / 105. Sağlık ocağı kasabada, hastane El Calafate.',
    insuranceRequired: false,
    stageCount: chaltenStages.length,
    rating: 4.8,
    reviewCount: 940,
    sources: [
      'https://en.wikivoyage.org/wiki/El_Chalt%C3%A9n',
      'https://www.argentina.gob.ar/parquesnacionales/losglaciares',
    ],
    updatedAt: UPDATED,
  },
  {
    id: KAS_ID,
    slug: 'kas-dalis-bolgesi',
    name: 'Kaş Dalış Bölgesi',
    region: 'Antalya, Akdeniz',
    countryCode: 'TR',
    type: 'dive_region',
    adventureTypes: ['diving'],
    coords: { latitude: 36.1994, longitude: 29.6386 },
    imageUrl: unsplash('1544551763-46a013bb70d5'),
    summary:
      'Türkiye’nin dalış başkenti: uçak ve gemi batıkları, kanyon ve mağara duvarları, 30 m görüş. Başlangıçtan trimix teknik dalışa 3–5 günlük dalış safarisi.',
    guide: `Nasıl gidilir
İstanbul → Antalya (AYT) 1,5 saat, havalimanından Kaş’a 3 saat (Batı Antalya otobüsü ya da transfer); Dalaman’dan da 2,5 saat. Dalış merkezleri limanda; sabah 09:00 tekneyle 2 dalış, öğle molası koyda.

Ne zaman
Mayıs–Kasım; Eylül–Ekim su 26 °C ve görüş en iyi. Kış dalışı 17 °C suyla mümkün (kuru elbise). Temmuz–Ağustos kalabalık ve tekne rezervasyonu şart.

İzinler
Sportif dalış için brövé (SSI/PADI/CMAS) ve son 12 ay içinde dalış kaydı; yoksa refresh dalışı. Bazı antik alanlar (Uluburun orijinal batığı) yasak; replika ve 2. Dünya Savaşı batıkları serbest. Teknik dalış (Flying Fish 60 m) için trimix sertifikası.

Konaklama
Kaş merkez pansiyon ve butik oteller (1.500–6.000 ₺); dalış merkezleri paket (konaklama + 6 dalış) sunar.

Aklimatizasyon
Derinlik profili: 2 dalış/gün, 18–30 m, dekompresyon sınırında; en yakın hiperbarik oda Antalya (3 saat) — uçuşa 24 saat kala son dalış.

Bütçe
Dalış 1.500–2.500 ₺ (ekipman dahil), 6 dalış paketi 8.000–12.000 ₺, kurs (Open Water) 15.000–20.000 ₺. 4 gün 15.000–40.000 ₺.

Riskler
Dekompresyon hastalığı (hiperbarik oda uzak), akıntı (Kanyon), derin batıkta narkoz, tekne trafiği, denizanası (Ağustos). Dalış sigortası (DAN) şiddetle önerilir.

Bağlantı & para
Kaş’ta 4G ve ATM. Acil: 112, Sahil Güvenlik 158, DAN acil hattı; Kaş Devlet Hastanesi ilk müdahale.`,
    maxElevationM: 0,
    typicalDays: 4,
    totalDistanceKm: 20,
    difficulty: 'moderate',
    bestMonths: [5, 6, 7, 8, 9, 10, 11],
    transports: [
      {
        mode: 'flight',
        from: 'İstanbul (IST/SAW)',
        to: 'Antalya (AYT)',
        durationMin: 90,
        costTry: 3500,
        note: 'Gidiş-dönüş.',
      },
      {
        mode: 'bus',
        from: 'Antalya Otogarı',
        to: 'Kaş',
        durationMin: 180,
        costTry: 400,
        note: 'Batı Antalya; saat başı.',
      },
      {
        mode: 'ferry',
        from: 'Kaş Limanı',
        to: 'Dalış noktaları',
        durationMin: 30,
        costTry: null,
        note: 'Dalış merkezi teknesi; pakete dahil.',
      },
    ],
    permits: [
      {
        name: 'Dalış brövesi + dalış kaydı',
        costTry: null,
        where: 'Dalış merkezi kontrolü',
        note: 'Son 12 ayda dalış yoksa refresh zorunlu.',
      },
    ],
    budgetTry: { low: 15000, high: 40000 },
    risks: [
      'Dekompresyon hastalığı (oda Antalya’da)',
      'Akıntı ve tekne trafiği',
      'Derin batıkta narkoz',
      'Denizanası (Ağustos)',
    ],
    gear: [
      'Dalış bilgisayarı',
      '5 mm elbise (Mayıs/Kasım 7 mm)',
      'Maske, palet (kiralık mevcut)',
      'Yüzey şamandırası (SMB)',
      'DAN sigorta kartı',
    ],
    rescueNote:
      'Kaş Devlet Hastanesi ilk müdahale; hiperbarik oda Antalya. Sahil Güvenlik 158, 112, DAN Europe +39 06 4211 5685.',
    insuranceRequired: true,
    stageCount: kasStages.length,
    rating: 4.7,
    reviewCount: 860,
    sources: ['https://en.wikivoyage.org/wiki/Ka%C5%9F', 'https://www.tssf.gov.tr'],
    updatedAt: UPDATED,
  },
];

export const seedDestinationStages: DestinationStage[] = [
  ...ebcStages,
  ...annapurnaStages,
  ...abcStages,
  ...langtangStages,
  ...manasluStages,
  ...kiliStages,
  ...torresStages,
  ...incaStages,
  ...tmbStages,
  ...hauteStages,
  ...aconcaguaStages,
  ...elbrusStages,
  ...agriStages,
  ...kackarStages,
  ...likyaStages,
  ...kapadokyaStages,
  ...chaltenStages,
  ...kasStages,
];

/* ------------------------------------------------------------------ */
/* KULLANICI VERİSİ (u_me)                                             */
/* ------------------------------------------------------------------ */

export const seedSavedDestinations: { userId: string; destinationId: string }[] = [
  { userId: CURRENT_USER_ID, destinationId: EBC_ID },
  { userId: CURRENT_USER_ID, destinationId: KACKAR_ID },
];

/** Annapurna Circuit boyunca dört akşam kaydı — irtifa arttıkça skor yükseliyor. */
export const seedAmsChecks: AmsCheck[] = [
  {
    id: 'ams_1',
    userId: CURRENT_USER_ID,
    destinationId: ANNAPURNA_ID,
    elevationM: 2670,
    headache: 0,
    gi: 0,
    fatigue: 1,
    dizziness: 0,
    score: 1,
    severity: 'none',
    note: 'Chame. Jeep sonrası yorgunluk, iştah iyi. SpO₂ 94.',
    createdAt: daysAgo(40),
  },
  {
    id: 'ams_2',
    userId: CURRENT_USER_ID,
    destinationId: ANNAPURNA_ID,
    elevationM: 3540,
    headache: 1,
    gi: 0,
    fatigue: 1,
    dizziness: 0,
    score: 2,
    severity: 'none',
    note: 'Manang, dinlenme günü öncesi. Hafif baş ağrısı akşam geçti. SpO₂ 88.',
    createdAt: daysAgo(38),
  },
  {
    id: 'ams_3',
    userId: CURRENT_USER_ID,
    destinationId: ANNAPURNA_ID,
    elevationM: 4050,
    headache: 1,
    gi: 1,
    fatigue: 2,
    dizziness: 0,
    score: 4,
    severity: 'mild',
    note: 'Yak Kharka. İştahsız, uyku bölük pörçük. Bol su, Diamox 125 mg. SpO₂ 84.',
    createdAt: daysAgo(36),
  },
  {
    id: 'ams_4',
    userId: CURRENT_USER_ID,
    destinationId: ANNAPURNA_ID,
    elevationM: 4450,
    headache: 1,
    gi: 0,
    fatigue: 1,
    dizziness: 1,
    score: 3,
    severity: 'mild',
    note: 'Thorong Phedi. Belirtiler geriledi; sabah geçit. SpO₂ 82.',
    createdAt: daysAgo(35),
  },
];

/** Bir aktif (2 saat sonra dolan) ve bir tamamlanmış dönüş planı. */
export const seedReturnPlans: ReturnPlan[] = [
  {
    id: 'rp_active',
    userId: CURRENT_USER_ID,
    title: 'Kaçkar zirve günü',
    destinationId: KACKAR_ID,
    adventureType: 'hiking',
    startAt: hoursAgo(5),
    expectedReturnAt: hoursAhead(2),
    graceMin: 60,
    route: 'Deniz Gölü kampı → Kaçkar zirvesi → Dilberdüzü → Yukarı Kavrun',
    companions: 'Elif Doğan, Can Yıldırım',
    contactIds: ['u_elif'],
    status: 'active',
    returnedAt: null,
    alertSentAt: null,
    createdAt: hoursAgo(6),
  },
  {
    id: 'rp_returned',
    userId: CURRENT_USER_ID,
    title: 'Belgrad Ormanı uzun koşu',
    destinationId: null,
    adventureType: 'hiking',
    startAt: daysAgo(3),
    expectedReturnAt: new Date(now - 3 * 86_400_000 + 4 * 3_600_000).toISOString(),
    graceMin: 30,
    route: 'Bahçeköy → Neşetsuyu → Kirazlıbent → Bahçeköy (22 km)',
    companions: '',
    contactIds: ['u_elif'],
    status: 'returned',
    returnedAt: new Date(now - 3 * 86_400_000 + 3.5 * 3_600_000).toISOString(),
    alertSentAt: null,
    createdAt: daysAgo(3),
  },
];

/* ------------------------------------------------------------------ */
/* ACİL MERKEZLER (destinasyon bölgeleri)                              */
/* ------------------------------------------------------------------ */

/** Destinasyonlara ait ek acil merkezler (Nepal HRA klinikleri vb.); ana listeye eklenir. */
export const seedDestinationEmergencyCenters: EmergencyCenter[] = [
  {
    id: 'dec_hra_pheriche',
    name: 'HRA Pheriche Aid Post',
    type: 'hospital',
    coords: { latitude: 27.8956, longitude: 86.8194 },
    locationName: 'Pheriche, Khumbu (4371 m)',
    phone: '+977 1 4440292',
    open24h: false,
    countryCode: 'NP',
  },
  {
    id: 'dec_hra_manang',
    name: 'HRA Manang Aid Post',
    type: 'hospital',
    coords: { latitude: 28.6667, longitude: 84.0167 },
    locationName: 'Manang (3540 m)',
    phone: '+977 1 4440292',
    open24h: false,
    countryCode: 'NP',
  },
  {
    id: 'dec_kunde',
    name: 'Kunde Hospital',
    type: 'hospital',
    coords: { latitude: 27.8261, longitude: 86.7167 },
    locationName: 'Kunde, Khumbu (3840 m)',
    phone: '+977 38 540 060',
    open24h: true,
    countryCode: 'NP',
  },
  {
    id: 'dec_lukla_hospital',
    name: 'Pasang Lhamu – Nicole Niquille Hastanesi',
    type: 'hospital',
    coords: { latitude: 27.6889, longitude: 86.7306 },
    locationName: 'Lukla (2860 m)',
    phone: '+977 38 540 190',
    open24h: true,
    countryCode: 'NP',
  },
  {
    id: 'dec_ciwec',
    name: 'CIWEC Hospital & Travel Medicine',
    type: 'hospital',
    coords: { latitude: 27.7172, longitude: 85.3183 },
    locationName: 'Lainchaur, Kathmandu',
    phone: '+977 1 4435232',
    open24h: true,
    countryCode: 'NP',
  },
  {
    id: 'dec_nepal_police_rescue',
    name: 'Nepal Turist Polisi / Helikopter Kurtarma Koordinasyonu',
    type: 'mountain_rescue',
    coords: { latitude: 27.7126, longitude: 85.3143 },
    locationName: 'Bhrikutimandap, Kathmandu',
    phone: '+977 1 4247041',
    open24h: true,
    countryCode: 'NP',
  },
  {
    id: 'dec_kinapa_rescue',
    name: 'KINAPA Kurtarma Ekibi (Marangu Gate)',
    type: 'mountain_rescue',
    coords: { latitude: -3.2528, longitude: 37.5136 },
    locationName: 'Marangu, Kilimanjaro Milli Parkı',
    phone: '+255 27 275 6602',
    open24h: true,
    countryCode: 'TZ',
  },
  {
    id: 'dec_kcmc',
    name: 'Kilimanjaro Christian Medical Centre (KCMC)',
    type: 'hospital',
    coords: { latitude: -3.3186, longitude: 37.3392 },
    locationName: 'Moshi, Tanzanya',
    phone: '+255 27 275 4377',
    open24h: true,
    countryCode: 'TZ',
  },
  {
    id: 'dec_cusco_regional',
    name: 'Hospital Regional del Cusco',
    type: 'hospital',
    coords: { latitude: -13.5269, longitude: -71.9622 },
    locationName: 'Cusco, Peru',
    phone: '+51 84 231131',
    open24h: true,
    countryCode: 'PE',
  },
  {
    id: 'dec_aguas_calientes',
    name: 'Centro de Salud Machu Picchu Pueblo',
    type: 'hospital',
    coords: { latitude: -13.1547, longitude: -72.5253 },
    locationName: 'Aguas Calientes, Peru',
    phone: '+51 84 211005',
    open24h: false,
    countryCode: 'PE',
  },
  {
    id: 'dec_puerto_natales',
    name: 'Hospital Dr. Augusto Essmann Burgos',
    type: 'hospital',
    coords: { latitude: -51.7269, longitude: -72.5047 },
    locationName: 'Puerto Natales, Şili',
    phone: '+56 61 2411583',
    open24h: true,
    countryCode: 'CL',
  },
  {
    id: 'dec_conaf_paine',
    name: 'CONAF Guardería Laguna Amarga',
    type: 'ranger',
    coords: { latitude: -50.9789, longitude: -72.7508 },
    locationName: 'Torres del Paine Milli Parkı',
    phone: '+56 61 2360496',
    open24h: false,
    countryCode: 'CL',
  },
  {
    id: 'dec_pghm_chamonix',
    name: 'PGHM Chamonix (Peloton de Gendarmerie de Haute Montagne)',
    type: 'mountain_rescue',
    coords: { latitude: 45.9231, longitude: 6.8694 },
    locationName: 'Chamonix-Mont-Blanc, Fransa',
    phone: '+33 4 50 53 16 89',
    open24h: true,
    countryCode: 'FR',
  },
  {
    id: 'dec_chamonix_hospital',
    name: 'Hôpitaux du Pays du Mont-Blanc – Chamonix',
    type: 'hospital',
    coords: { latitude: 45.9214, longitude: 6.8619 },
    locationName: 'Chamonix, Fransa',
    phone: '+33 4 50 53 84 00',
    open24h: true,
    countryCode: 'FR',
  },
  {
    id: 'dec_air_zermatt',
    name: 'Air Zermatt Kurtarma Üssü',
    type: 'mountain_rescue',
    coords: { latitude: 46.0203, longitude: 7.7486 },
    locationName: 'Zermatt, İsviçre',
    phone: '+41 27 966 86 86',
    open24h: true,
    countryCode: 'CH',
  },
  {
    id: 'dec_rega',
    name: 'Rega İsviçre Hava Kurtarma (1414)',
    type: 'ambulance',
    coords: { latitude: 47.4581, longitude: 8.5644 },
    locationName: 'Zürih Havalimanı, İsviçre',
    phone: '1414',
    open24h: true,
    countryCode: 'CH',
  },
  {
    id: 'dec_mendoza_central',
    name: 'Hospital Central de Mendoza',
    type: 'hospital',
    coords: { latitude: -32.8892, longitude: -68.8453 },
    locationName: 'Mendoza, Arjantin',
    phone: '+54 261 420 0600',
    open24h: true,
    countryCode: 'AR',
  },
  {
    id: 'dec_aconcagua_rangers',
    name: 'Guardaparques Plaza de Mulas',
    type: 'ranger',
    coords: { latitude: -32.6544, longitude: -70.0592 },
    locationName: 'Aconcagua Eyalet Parkı (4370 m)',
    phone: null,
    open24h: true,
    countryCode: 'AR',
  },
  {
    id: 'dec_chalten_rangers',
    name: 'Parques Nacionales – El Chaltén Ranger Ofisi',
    type: 'ranger',
    coords: { latitude: -49.3322, longitude: -72.8858 },
    locationName: 'El Chaltén, Arjantin',
    phone: '+54 2962 493004',
    open24h: false,
    countryCode: 'AR',
  },
  {
    id: 'dec_mchs_elbrus',
    name: 'MChS Elbrus Arama-Kurtarma Birimi',
    type: 'mountain_rescue',
    coords: { latitude: 43.2556, longitude: 42.5139 },
    locationName: 'Terskol, Kabardey-Balkar',
    phone: '+7 866 38 71489',
    open24h: true,
    countryCode: 'RU',
  },
  {
    id: 'dec_dogubayazit',
    name: 'Doğubayazıt Dr. Yaşar Eryılmaz Devlet Hastanesi',
    type: 'hospital',
    coords: { latitude: 39.5453, longitude: 44.0819 },
    locationName: 'Doğubayazıt, Ağrı',
    phone: '+90 472 312 5110',
    open24h: true,
    countryCode: 'TR',
  },
  {
    id: 'dec_jak_agri',
    name: 'Jandarma Arama Kurtarma (JAK) Ağrı',
    type: 'mountain_rescue',
    coords: { latitude: 39.7203, longitude: 43.0517 },
    locationName: 'Ağrı',
    phone: '112',
    open24h: true,
    countryCode: 'TR',
  },
  {
    id: 'dec_ayder_saglik',
    name: 'Ayder Sağlık Ocağı',
    type: 'hospital',
    coords: { latitude: 40.9503, longitude: 41.1031 },
    locationName: 'Ayder Yaylası, Rize',
    phone: '112',
    open24h: false,
    countryCode: 'TR',
  },
  {
    id: 'dec_pazar_hastane',
    name: 'Pazar Devlet Hastanesi',
    type: 'hospital',
    coords: { latitude: 41.1786, longitude: 40.8919 },
    locationName: 'Pazar, Rize',
    phone: '+90 464 612 1050',
    open24h: true,
    countryCode: 'TR',
  },
  {
    id: 'dec_kas_hastane',
    name: 'Kaş Devlet Hastanesi',
    type: 'hospital',
    coords: { latitude: 36.2036, longitude: 29.6339 },
    locationName: 'Kaş, Antalya',
    phone: '+90 242 836 3200',
    open24h: true,
    countryCode: 'TR',
  },
  {
    id: 'dec_kas_sahil',
    name: 'Sahil Güvenlik Kaş',
    type: 'coast_guard',
    coords: { latitude: 36.1978, longitude: 29.6414 },
    locationName: 'Kaş Limanı',
    phone: '158',
    open24h: true,
    countryCode: 'TR',
  },
  {
    id: 'dec_nevsehir_hastane',
    name: 'Nevşehir Devlet Hastanesi',
    type: 'hospital',
    coords: { latitude: 38.6244, longitude: 34.7189 },
    locationName: 'Nevşehir',
    phone: '+90 384 228 5050',
    open24h: true,
    countryCode: 'TR',
  },
];
