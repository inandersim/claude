import { vision_pl } from './locales/pl/vision';
import { vision_ar } from './locales/ar/vision';
import { vision_pt } from './locales/pt/vision';
import { vision_es } from './locales/es/vision';
import { vision_fr } from './locales/fr/vision';
import { vision_de } from './locales/de/vision';
import { vision_ru } from './locales/ru/vision';
import { vision_it } from './locales/it/vision';
import { vision_zh } from './locales/zh/vision';
import { vision_hi } from './locales/hi/vision';
import { vision_ne } from './locales/ne/vision';
import { vision_el } from './locales/el/vision';
import { vision_id } from './locales/id/vision';
import { vision_cs } from './locales/cs/vision';
import { localeSet } from './shared';
import { vision_ja } from './locales/ja/vision';
import { vision_ko } from './locales/ko/vision';
import { vision_nb } from './locales/nb/vision';
import { vision_nl } from './locales/nl/vision';
import { vision_sv } from './locales/sv/vision';

const tr = {
  title: 'Kamera ile sor',
  subtitle: 'Fotoğrafla, durumu seç, tavsiye al',
  permission: {
    title: 'Kamera izni gerekiyor',
    body: 'Sahadaki manzarayı, ekipmanı ya da yarayı fotoğraflayıp Zirtan AI’dan tavsiye almak için kameraya erişmemiz gerekiyor.',
    grant: 'Kameraya izin ver',
    denied:
      'Kamera izni verilmedi. Ayarlardan izin verebilir ya da galeriden fotoğraf seçebilirsin.',
    gallery: 'Galeriden seç',
  },
  webNote: 'Kamera yalnızca mobilde çalışır; buradan bir fotoğraf seçebilirsin.',
  situationTitle: 'Durum',
  situation: {
    terrain: 'Arazi',
    weather: 'Hava',
    gear: 'Ekipman',
    injury: 'Yaralanma',
    wildlife: 'Yaban hayatı',
    plant: 'Bitki / mantar',
    map: 'Harita',
    water: 'Su',
    camp: 'Kamp yeri',
    other: 'Diğer',
  },
  hint: {
    terrain: 'Yamacı ve zemini kadraja al',
    weather: 'Gökyüzünü ve bulutları göster',
    gear: 'Ekipmanı yakından ve net çek',
    injury: 'Yaralı bölgeyi iyi ışıkta çek',
    wildlife: 'Güvenli mesafeden çek, yaklaşma',
    plant: 'Yaprak, gövde ve şapkayı birlikte göster',
    map: 'Harita ve pusulayı düz tut',
    water: 'Suyun akışını ve rengini göster',
    camp: 'Çadır yerini ve çevresini geniş çek',
    other: 'Durumu olabildiğince net göster',
  },
  questionPlaceholder: 'Kısa bir soru (isteğe bağlı)',
  quickTitle: 'Hızlı sorular',
  shutter: 'Fotoğraf çek',
  flip: 'Kamerayı çevir',
  flash: 'Flaş',
  flashOn: 'Flaş açık',
  flashOff: 'Flaş kapalı',
  close: 'Kapat',
  gallery: 'Galeri',
  preview: 'Önizleme',
  analyze: 'Analiz et',
  analyzing: 'Görüntü değerlendiriliyor…',
  retake: 'Yeniden çek',
  continueInChat: 'Zirtan AI’da devam et',
  history: 'Geçmiş',
  captureError: 'Fotoğraf çekilemedi',
  analyzeError: 'Analiz yapılamadı',
  tooLarge: 'Görüntü çok büyük; daha düşük kalitede yeniden çek.',
  noImage: 'Önce bir fotoğraf çek ya da seç.',
  risk: {
    title: 'Risk',
    low: 'Düşük',
    moderate: 'Orta',
    high: 'Yüksek',
    extreme: 'Çok yüksek',
  },
  observations: 'Gözlemler',
  advice: 'Tavsiye',
  avoid: 'Kaçın',
  actions: 'Uygulama içi bağlantılar',
  confidence: 'Güven yüzde {{value}}',
  source: {
    remote: 'Bulut',
    local: 'Çevrimdışı',
    localBody: 'Görüntü analizi yapılamadı; duruma göre yerel kontrol listesi gösteriliyor.',
  },
  disclaimer:
    'Yapay zekâ tavsiyesi yol göstericidir; hayati durumda 112’yi ara ve sahada kendi değerlendirmeni yap.',
  historyScreen: {
    title: 'Analiz geçmişi',
    subtitle: 'Son {{count}} analiz',
    empty: 'Henüz analiz yok',
    emptyBody: 'Kamerayı aç, bir fotoğraf çek ve durumu seç.',
    open: 'Kamerayı aç',
    clear: 'Geçmişi temizle',
    clearConfirm: 'Tüm görüntü analizleri silinsin mi?',
    cleared: 'Geçmiş temizlendi',
    loadError: 'Geçmiş yüklenemedi',
    noQuestion: 'Soru yok',
    itemLabel: '{{situation}} analizi, risk {{risk}}',
  },
};

/** Diğer dillerin uyması gereken şekil. */
export type VisionI18nShape = typeof tr;

const en: VisionI18nShape = {
  title: 'Ask with camera',
  subtitle: 'Snap a photo, pick the situation, get advice',
  permission: {
    title: 'Camera permission needed',
    body: 'To photograph the terrain, gear or an injury and get advice from Zirtan AI we need access to your camera.',
    grant: 'Allow camera',
    denied:
      'Camera permission was not granted. You can allow it in Settings or pick a photo from your gallery.',
    gallery: 'Pick from gallery',
  },
  webNote: 'The camera works on mobile only; you can pick a photo here instead.',
  situationTitle: 'Situation',
  situation: {
    terrain: 'Terrain',
    weather: 'Weather',
    gear: 'Gear',
    injury: 'Injury',
    wildlife: 'Wildlife',
    plant: 'Plant / fungus',
    map: 'Map',
    water: 'Water',
    camp: 'Campsite',
    other: 'Other',
  },
  hint: {
    terrain: 'Frame the slope and the ground',
    weather: 'Show the sky and the clouds',
    gear: 'Shoot the gear up close and sharp',
    injury: 'Shoot the injured area in good light',
    wildlife: 'Shoot from a safe distance, do not approach',
    plant: 'Show leaf, stem and cap together',
    map: 'Hold the map and compass flat',
    water: 'Show the flow and colour of the water',
    camp: 'Take a wide shot of the pitch and surroundings',
    other: 'Show the situation as clearly as possible',
  },
  questionPlaceholder: 'A short question (optional)',
  quickTitle: 'Quick questions',
  shutter: 'Take photo',
  flip: 'Flip camera',
  flash: 'Flash',
  flashOn: 'Flash on',
  flashOff: 'Flash off',
  close: 'Close',
  gallery: 'Gallery',
  preview: 'Preview',
  analyze: 'Analyze',
  analyzing: 'Assessing the image…',
  retake: 'Retake',
  continueInChat: 'Continue in Zirtan AI',
  history: 'History',
  captureError: 'Could not take the photo',
  analyzeError: 'Analysis failed',
  tooLarge: 'The image is too large; retake at a lower quality.',
  noImage: 'Take or pick a photo first.',
  risk: {
    title: 'Risk',
    low: 'Low',
    moderate: 'Moderate',
    high: 'High',
    extreme: 'Extreme',
  },
  observations: 'Observations',
  advice: 'Advice',
  avoid: 'Avoid',
  actions: 'In-app links',
  confidence: 'Confidence {{value}}%',
  source: {
    remote: 'Cloud',
    local: 'Offline',
    localBody: 'Image analysis was unavailable; showing the local checklist for this situation.',
  },
  disclaimer:
    'AI advice is guidance only; in a life-threatening situation call 112 and make your own assessment on site.',
  historyScreen: {
    title: 'Analysis history',
    subtitle: 'Last {{count}} analyses',
    empty: 'No analyses yet',
    emptyBody: 'Open the camera, take a photo and pick the situation.',
    open: 'Open camera',
    clear: 'Clear history',
    clearConfirm: 'Delete all image analyses?',
    cleared: 'History cleared',
    loadError: 'Could not load history',
    noQuestion: 'No question',
    itemLabel: '{{situation}} analysis, risk {{risk}}',
  },
};

/** vision modülü çevirileri — tr kaynak, en zorunlu; diğer diller sonra bağlanır. */
export const visionI18n = localeSet(tr, en, {
  pl: vision_pl,
  cs: vision_cs,
  id: vision_id,
  ko: vision_ko,
  ar: vision_ar,
  ru: vision_ru,
  ja: vision_ja,
  de: vision_de,
  fr: vision_fr,
  es: vision_es,
  pt: vision_pt,
  it: vision_it,
  zh: vision_zh,
  hi: vision_hi,
  ne: vision_ne,
  nb: vision_nb,
  el: vision_el,
  nl: vision_nl,
  sv: vision_sv,
});
