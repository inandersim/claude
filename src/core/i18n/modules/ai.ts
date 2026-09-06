import { ai_ar } from './locales/ar/ai';
import { ai_de } from './locales/de/ai';
import { ai_fr } from './locales/fr/ai';
import { ai_es } from './locales/es/ai';
import { ai_it } from './locales/it/ai';
import { ai_ja } from './locales/ja/ai';
import { ai_pt } from './locales/pt/ai';
import { ai_ru } from './locales/ru/ai';
import { ai_zh } from './locales/zh/ai';
import { ai_ko } from './locales/ko/ai';
import { ai_hi } from './locales/hi/ai';
import { ai_ne } from './locales/ne/ai';
import { ai_nb } from './locales/nb/ai';
import { localeSet } from './shared';

const tr = {
  title: 'Zirtan AI',
  subtitle: 'Macera asistanın — çevrimdışı da çalışır',
  welcomeTitle: 'Nereye gidiyoruz?',
  welcomeBody:
    'Gezi planı, yer önerisi, güvenlik brifingi, paketleme listesi ve ilk yardım adımları için sor.',
  placeholder: 'Zirtan AI’ya sor…',
  send: 'Gönder',
  quickTitle: 'Hızlı komutlar',
  history: 'Geçmiş sohbetler',
  historyEmpty: 'Henüz sohbet yok',
  historyEmptyBody: 'Aşağıya bir soru yaz ya da hızlı komutlardan birini seç.',
  newChat: 'Yeni sohbet',
  deleteThread: 'Sohbeti sil',
  deleteConfirm: 'Bu sohbet ve tüm mesajları silinsin mi?',
  deleted: 'Sohbet silindi',
  planTrip: 'Gezi planla',
  planning: 'Plan hazırlanıyor…',
  planError: 'Plan oluşturulamadı',
  thinking: 'Zirtan AI yazıyor…',
  you: 'Sen',
  assistant: 'Zirtan AI',
  disclaimer: 'Bilgiler yol göstericidir; sahada kendi değerlendirmeni yap.',
  offlineMode: 'Çevrimdışı mod — yanıtlar yerel verilerden üretiliyor',
  onlineMode: 'Bulut modu — yanıtlar Zirtan AI ağ geçidinden geliyor',
  sendError: 'Mesaj gönderilemedi',
  loadError: 'Sohbet yüklenemedi',
  threadNotFound: 'Sohbet bulunamadı',
  threadNotFoundBody: 'Silinmiş ya da başka bir hesaba ait olabilir.',
  messagesCount: '{{count}} mesaj',
  actions: 'Önerilen bağlantılar',
  openLink: '{{label}} sayfasını aç',
  intent: {
    plan_trip: 'Gezi planı',
    safety_brief: 'Güvenlik',
    packing_list: 'Paketleme',
    find_place: 'Yer önerisi',
    gear_advice: 'Ekipman',
    first_aid: 'İlk yardım',
    weather: 'Hava',
    general: 'Genel',
  },
  plan: {
    title: 'Gezi planı',
    days: 'Günler',
    day: '{{day}}. gün',
    daysCount: '{{count}} gün',
    distance: 'Mesafe',
    ascent: 'Tırmanış',
    total: 'Toplam',
    packing: 'Paketleme listesi',
    safety: 'Güvenlik notları',
    close: 'Kapat',
    openPlanner: 'Rota planlayıcıda aç',
  },
};

/** Diğer dillerin uyması gereken şekil. */
export type AiI18nShape = typeof tr;

const en: AiI18nShape = {
  title: 'Zirtan AI',
  subtitle: 'Your adventure assistant — works offline too',
  welcomeTitle: 'Where are we heading?',
  welcomeBody:
    'Ask for a trip plan, place picks, a safety brief, a packing list or first aid steps.',
  placeholder: 'Ask Zirtan AI…',
  send: 'Send',
  quickTitle: 'Quick prompts',
  history: 'Past chats',
  historyEmpty: 'No chats yet',
  historyEmptyBody: 'Type a question below or pick one of the quick prompts.',
  newChat: 'New chat',
  deleteThread: 'Delete chat',
  deleteConfirm: 'Delete this chat and all its messages?',
  deleted: 'Chat deleted',
  planTrip: 'Plan trip',
  planning: 'Building your plan…',
  planError: 'Could not build the plan',
  thinking: 'Zirtan AI is typing…',
  you: 'You',
  assistant: 'Zirtan AI',
  disclaimer: 'Information is indicative; make your own assessment in the field.',
  offlineMode: 'Offline mode — answers come from local data',
  onlineMode: 'Cloud mode — answers come from the Zirtan AI gateway',
  sendError: 'Message could not be sent',
  loadError: 'Chat could not be loaded',
  threadNotFound: 'Chat not found',
  threadNotFoundBody: 'It may have been deleted or belongs to another account.',
  messagesCount: '{{count}} messages',
  actions: 'Suggested links',
  openLink: 'Open {{label}}',
  intent: {
    plan_trip: 'Trip plan',
    safety_brief: 'Safety',
    packing_list: 'Packing',
    find_place: 'Places',
    gear_advice: 'Gear',
    first_aid: 'First aid',
    weather: 'Weather',
    general: 'General',
  },
  plan: {
    title: 'Trip plan',
    days: 'Days',
    day: 'Day {{day}}',
    daysCount: '{{count}} days',
    distance: 'Distance',
    ascent: 'Ascent',
    total: 'Total',
    packing: 'Packing list',
    safety: 'Safety notes',
    close: 'Close',
    openPlanner: 'Open in route planner',
  },
};

/** ai modülü çevirileri — tr kaynak, en zorunlu; diğer diller aşağıya eklenir. */
export const aiI18n = localeSet(tr, en, {
  ko: ai_ko,
  ar: ai_ar,
  de: ai_de,
  fr: ai_fr,
  es: ai_es,
  it: ai_it,
  ja: ai_ja,
  pt: ai_pt,
  ru: ai_ru,
  zh: ai_zh,
  hi: ai_hi,
  ne: ai_ne,
  nb: ai_nb,
});
