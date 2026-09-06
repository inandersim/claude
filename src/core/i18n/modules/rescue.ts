import { rescue_ar } from './locales/ar/rescue';
import { rescue_pt } from './locales/pt/rescue';
import { rescue_es } from './locales/es/rescue';
import { rescue_fr } from './locales/fr/rescue';
import { rescue_de } from './locales/de/rescue';
import { rescue_ru } from './locales/ru/rescue';
import { rescue_it } from './locales/it/rescue';
import { rescue_zh } from './locales/zh/rescue';
import { rescue_hi } from './locales/hi/rescue';
import { rescue_ne } from './locales/ne/rescue';
import { localeSet } from './shared';
import { rescue_ja } from './locales/ja/rescue';
import { rescue_ko } from './locales/ko/rescue';
import { rescue_nb } from './locales/nb/rescue';

const tr = {
  title: 'Ülke kurtarma dizini',
  subtitle: 'Bulunduğun ülkenin acil numaraları ve kurtarma örgütleri',
  detected: 'Tespit edilen ülke',
  currentCountry: 'Bulunduğun ülke',
  countryLine: 'Bulunduğun ülke: {{country}} · Acil {{number}}',
  directory: 'Dizin',
  source: {
    geocode: 'Konumdan (GPS)',
    bbox: 'Yaklaşık (harita)',
    fallback: 'Son bilinen',
    manual: 'Elle seçildi',
  },
  changeCountry: 'Ülkeyi değiştir',
  autoDetect: 'Otomatik tespit',
  autoDetectHint: 'Konumdan tespit yanlışsa ülkeyi listeden seç.',
  call: 'Ara',
  callGeneral: 'Acil {{number}}',
  callMountain: 'Dağ kurtarma',
  callSea: 'Deniz kurtarma',
  callMedical: 'Ambulans',
  numbers: {
    title: 'Acil numaralar',
    general: 'Acil',
    police: 'Polis',
    ambulance: 'Ambulans',
    fire: 'İtfaiye',
    mountain: 'Dağ',
    sea: 'Deniz',
    tourist: 'Turist polisi',
  },
  helicopter: {
    title: 'Helikopter kurtarma',
    free: 'Ücretsiz (devlet)',
    paid: 'Ücretli',
    insurance_required: 'Sigorta zorunlu',
    limited: 'Sınırlı / duruma bağlı',
  },
  insurance: 'Sigorta notu',
  insuranceReminder:
    'Yola çıkmadan poliçenin dağ/heli-tahliye kapsamını ve sigortacının acil hattını kontrol et.',
  organizations: 'Kurtarma örgütleri',
  noOrganizations: 'Bu ülke için kayıtlı örgüt yok; genel acil numarayı kullan.',
  scope: {
    mountain: 'Dağ',
    sea: 'Deniz',
    cave: 'Mağara',
    medical: 'Tıbbi',
    general: 'Genel',
  },
  website: 'Web',
  embassy: 'Türk temsilciliği',
  embassyCity: 'Büyükelçilik · {{city}}',
  embassyUnknown: 'Bu ülkedeki temsilcilik numarası kayıtlı değil; çağrı merkezini ara.',
  foreignMinistryLine: 'Dışişleri Konsolosluk Çağrı Merkezi (7/24)',
  neighbors: 'Sınıra yakınsın',
  neighborsHint:
    'Telefonun komşu ülkenin şebekesine düşebilir; o ülkenin numarası da geçerli olabilir.',
  neighborDistance: '~{{km}} km',
  notes: 'Notlar',
  languages: 'Acil hatta konuşulan diller',
  sosHint: 'Basılı tut: {{number}} aranır, acil kişilerine konumun gönderilir',
  sosConfirmDescription:
    '{{number}} ({{country}}) aranacak ve acil kişilerine canlı konumun gönderilecek.',
  satelliteSos: 'Uydu SOS',
  nearestCenters: 'En yakın merkezler',
  search: 'Ülke ara',
  searchPlaceholder: 'Ülke adı ya da kod (örn. NP)',
  noResults: 'Eşleşen ülke yok',
  select: 'Seç',
  close: 'Kapat',
  unknownCountry: 'Ülke tespit edilemedi',
  unknownCountryHint: 'GSM standardı 112 çoğu ülkede acil servise bağlanır.',
  countryCount: '{{count}} ülke',
  compactLine: 'Acil {{number}}',
  updatedFromLocation: 'Konumdan güncellendi',
};

/** Diğer dillerin uyması gereken şekil. */
export type RescueI18nShape = typeof tr;

const en: RescueI18nShape = {
  title: 'Country rescue directory',
  subtitle: 'Emergency numbers and rescue organisations where you are',
  detected: 'Detected country',
  currentCountry: 'Your country',
  countryLine: 'Your country: {{country}} · Emergency {{number}}',
  directory: 'Directory',
  source: {
    geocode: 'From location (GPS)',
    bbox: 'Approximate (map)',
    fallback: 'Last known',
    manual: 'Chosen manually',
  },
  changeCountry: 'Change country',
  autoDetect: 'Auto-detect',
  autoDetectHint: 'If location-based detection is wrong, pick the country from the list.',
  call: 'Call',
  callGeneral: 'Emergency {{number}}',
  callMountain: 'Mountain rescue',
  callSea: 'Sea rescue',
  callMedical: 'Ambulance',
  numbers: {
    title: 'Emergency numbers',
    general: 'Emergency',
    police: 'Police',
    ambulance: 'Ambulance',
    fire: 'Fire',
    mountain: 'Mountain',
    sea: 'Sea',
    tourist: 'Tourist police',
  },
  helicopter: {
    title: 'Helicopter rescue',
    free: 'Free (state)',
    paid: 'Charged',
    insurance_required: 'Insurance required',
    limited: 'Limited / case by case',
  },
  insurance: 'Insurance note',
  insuranceReminder:
    'Before you go, check that your policy covers mountain/heli evacuation and note your insurer’s emergency line.',
  organizations: 'Rescue organisations',
  noOrganizations: 'No organisations on record for this country; use the general emergency number.',
  scope: {
    mountain: 'Mountain',
    sea: 'Sea',
    cave: 'Cave',
    medical: 'Medical',
    general: 'General',
  },
  website: 'Web',
  embassy: 'Turkish mission',
  embassyCity: 'Embassy · {{city}}',
  embassyUnknown: 'No mission number on record for this country; call the consular centre.',
  foreignMinistryLine: 'Foreign Ministry Consular Call Centre (24/7)',
  neighbors: 'You are near a border',
  neighborsHint:
    'Your phone may roam onto a neighbouring network; that country’s number may apply too.',
  neighborDistance: '~{{km}} km',
  notes: 'Notes',
  languages: 'Languages spoken on the emergency line',
  sosHint: 'Hold: calls {{number}} and sends your location to your emergency contacts',
  sosConfirmDescription:
    '{{number}} ({{country}}) will be called and your live location sent to your emergency contacts.',
  satelliteSos: 'Satellite SOS',
  nearestCenters: 'Nearest centres',
  search: 'Search country',
  searchPlaceholder: 'Country name or code (e.g. NP)',
  noResults: 'No matching country',
  select: 'Select',
  close: 'Close',
  unknownCountry: 'Country not detected',
  unknownCountryHint: 'The GSM standard number 112 reaches emergency services in most countries.',
  countryCount: '{{count}} countries',
  compactLine: 'Emergency {{number}}',
  updatedFromLocation: 'Updated from location',
};

/** rescue modülü çevirileri — tr kaynak, en zorunlu; diğer diller sonra bağlanır. */
export const rescueI18n = localeSet(tr, en, {
  ko: rescue_ko,
  ar: rescue_ar,
  ru: rescue_ru,
  ja: rescue_ja,
  de: rescue_de,
  fr: rescue_fr,
  es: rescue_es,
  pt: rescue_pt,
  it: rescue_it,
  zh: rescue_zh,
  hi: rescue_hi,
  ne: rescue_ne,
  nb: rescue_nb,
});
