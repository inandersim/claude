/**
 * Kanal adaptörü ortak katmanı.
 *
 * Her kanal aynı dört yöntemi uygular:
 *   publish(item, ctx)      → tek gönderiyi yayınlar (anahtar yoksa kuru çalışma paketi)
 *   schedule(items, ctx)    → gönderileri en iyi saatlere yerleştirir (+ .ics)
 *   metrics(range, ctx)     → metrik çeker ya da elle dışa aktarma yönergesi üretir
 *   reply(mention, ctx)     → yorum/DM için yanıt taslağı (kural tabanlı, API'siz)
 *
 * Kuru çalışma varsayılandır. `--live` **ve** kanalın ortam değişkenleri tamsa gerçek
 * çağrı yapılır; aksi hâlde `out/packets/<kanal>/…` altına elle yayınlanabilir paket yazılır.
 */

import { checkCompliance, HASHTAGS, SAFETY_NOTE } from '../lib/brand.mjs';
import { minutesOf } from '../lib/dates.mjs';
import { charCount, hashtagSet, lines, pick, truncate } from '../lib/text.mjs';

/** Kanal adaptörünün uygulaması zorunlu yöntemleri (testler bunu doğrular). */
export const CHANNEL_METHODS = ['publish', 'schedule', 'metrics', 'reply'];

/** Varsayılan bağlam; betikler yalnızca değiştirdiklerini geçer. */
export function makeContext(overrides = {}) {
  return {
    env: process.env,
    live: false,
    fetchImpl: globalThis.fetch,
    now: new Date(),
    /** Kuru çalışmada paket yazan Writer (yoksa paket bellekte kalır). */
    writer: null,
    outDir: null,
    log: () => {},
    /** Hız sınırı bekleyicisi (canlı modda kanal başına asgari boşluk). */
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    ...overrides,
  };
}

/** Gönderi nesnesinin asgari alanları var mı? */
export function validateItem(item) {
  const missing = ['id', 'lang', 'title', 'body'].filter((k) => !item?.[k]);
  if (missing.length > 0) throw new Error(`Gönderi alanı eksik: ${missing.join(', ')}`);
  return item;
}

/**
 * Kanal sınırlarına göre metni kurar: gövde → CTA → bağlantı → hashtag.
 * `linkPolicy`: inline (metne yazılır) · bio (profil bağlantısı) · none (link yok).
 */
export function formatForChannel(item, spec) {
  const warnings = [];
  const lang = item.lang ?? 'tr';
  const pool = [
    ...(item.hashtags ?? []),
    ...(HASHTAGS[lang]?.core ?? []),
    ...(HASHTAGS[lang]?.niche ?? []),
  ];
  const tags = spec.maxHashtags === 0 ? [] : hashtagSet(pool, spec.maxHashtags);
  if (spec.maxHashtags > 0 && (item.hashtags ?? []).length > spec.maxHashtags) {
    warnings.push(`hashtag ${item.hashtags.length} → ${spec.maxHashtags}`);
  }

  const parts = [String(item.body).trim()];
  if (item.cta && spec.ctaInBody !== false) parts.push(String(item.cta).trim());

  let link = '';
  if (item.link) {
    if (spec.linkPolicy === 'inline') {
      link = item.link;
      parts.push(link);
    } else if (spec.linkPolicy === 'bio') {
      link = item.link;
      warnings.push('bağlantı tıklanmaz: profil bağlantısını bu içeriğe güncelle');
    } else {
      warnings.push('bu kanalda bağlantı yok: bağlantıyı sabitlenmiş yorumda ver');
    }
  }
  if (item.safety && SAFETY_NOTE[lang]) parts.push(SAFETY_NOTE[lang]);
  if (tags.length > 0) parts.push(tags.join(' '));

  let text = parts.join('\n\n');
  /** X gibi kanallarda bağlantı sabit uzunlukta sayılır (t.co kısaltması). */
  const effectiveLength = (value) =>
    spec.linkCountsAs && link ? charCount(value) - charCount(link) + spec.linkCountsAs : charCount(value);
  if (effectiveLength(text) > spec.maxChars) {
    const tail = parts.slice(1).join('\n\n');
    const room = spec.maxChars - effectiveLength(tail) - 2;
    text = [truncate(String(item.body).trim(), Math.max(60, room)), tail].filter(Boolean).join('\n\n');
    warnings.push(`metin ${spec.maxChars} karaktere kısaltıldı`);
  } else if (effectiveLength(text) > spec.recommendedChars) {
    warnings.push(`metin ${effectiveLength(text)} karakter; önerilen ≤ ${spec.recommendedChars}`);
  }

  const firstLine = String(item.body).split('\n')[0] ?? '';
  if (spec.foldAt && charCount(firstLine) > spec.foldAt) {
    warnings.push(`ilk satır ${charCount(firstLine)} karakter; ${spec.foldAt} karakterden önce kanca ver`);
  }

  const compliance = checkCompliance(`${item.title}\n${text}`);
  for (const c of compliance) warnings.push(`YASAK İFADE: "${c.phrase}" — ${c.reason}`);

  return { text, title: String(item.title).trim(), hashtags: tags, link, warnings, compliance };
}

/** Kanalın canlı yayın için ihtiyaç duyduğu ortam değişkenleri tam mı? */
export function envReady(spec, env) {
  const missing = (spec.envKeys ?? []).filter((k) => !String(env?.[k] ?? '').trim());
  return { ready: spec.canPublish && missing.length === 0, missing };
}

/** Elle yayınlanacak paketi Markdown olarak kurar. */
export function packetMarkdown(item, spec, formatted, extra = {}) {
  const visual = item.visual ?? {};
  return lines(
    `# ${formatted.title}`,
    '',
    `- Kanal: **${spec.label}** (${spec.id})`,
    `- Biçim: ${item.format ?? spec.formats[0]}`,
    `- Dil: ${item.lang}`,
    `- Tarih / en iyi saat: ${item.date ?? '—'} · ${item.bestTime ?? bestTimeFor(spec, item.lang)} (Europe/Istanbul)`,
    item.link ? `- Bağlantı: ${item.link}` : null,
    `- Karakter: ${charCount(formatted.text)} / ${spec.maxChars}${spec.linkCountsAs && formatted.link ? ` (bağlantı ${spec.linkCountsAs} sayılır → etkin ${charCount(formatted.text) - charCount(formatted.link) + spec.linkCountsAs})` : ''}`,
    extra.mode ? `- Mod: ${extra.mode}${extra.reason ? ` — ${extra.reason}` : ''}` : null,
    '',
    '## Yayına giden metin',
    '',
    '```text',
    formatted.text,
    '```',
    '',
    formatted.hashtags.length > 0 ? `## Hashtag\n\n${formatted.hashtags.join(' ')}\n` : null,
    '## Görsel talimatı',
    '',
    visual.brief ? visual.brief : 'Görsel brief yok — kütüphane fotoğrafı + ekran görüntüsü çerçevesi kullan.',
    visual.shots?.length ? `\nÇekim listesi:\n${visual.shots.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : null,
    visual.aspect ? `\nOran: ${visual.aspect}` : null,
    visual.alt ? `\nAlt metin: ${visual.alt}` : null,
    '',
    '## Elle yayın adımları',
    '',
    (spec.manualSteps ?? []).map((s, i) => `${i + 1}. ${s}`).join('\n'),
    '',
    item.sources?.length ? `## Kaynak ve lisans\n\n${item.sources.map((s) => `- ${s}`).join('\n')}\n` : null,
    formatted.warnings.length > 0 ? `## Uyarılar\n\n${formatted.warnings.map((w) => `- ${w}`).join('\n')}` : null,
  );
}

/** Kanal + dil için ilk en iyi saat. */
export function bestTimeFor(spec, lang = 'tr', index = 0) {
  const times = spec.bestTimes[lang] ?? spec.bestTimes.tr ?? ['12:00'];
  return times[index % times.length];
}

/** ICS takvim dosyası (elle yayın hatırlatıcıları için). */
export function toIcs(entries, calendarName) {
  const stamp = (iso, time) => `${iso.replace(/-/gu, '')}T${time.replace(':', '')}00`;
  const body = entries.flatMap((e) => [
    'BEGIN:VEVENT',
    `UID:${e.id}@zirtan.app`,
    `DTSTAMP:${stamp(e.date, '09:00')}`,
    `DTSTART;TZID=Europe/Istanbul:${stamp(e.date, e.time)}`,
    `DURATION:PT20M`,
    `SUMMARY:${e.summary.replace(/[\n,;]/gu, ' ')}`,
    `DESCRIPTION:${(e.description ?? '').replace(/[\n]/gu, '\\n').replace(/[,;]/gu, ' ')}`,
    'END:VEVENT',
  ]);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zirtan//marketing//TR',
    `X-WR-CALNAME:${calendarName}`,
    ...body,
    'END:VCALENDAR',
  ].join('\r\n');
}

/* ------------------------------------------------------------------ */
/* Yanıt motoru (kural tabanlı, API'siz)                                 */
/* ------------------------------------------------------------------ */

const INTENT_RULES = [
  {
    intent: 'safety',
    escalate: true,
    patterns: [
      // Türkçe eklemeli dildir: kök eşleşmesi yeterli (yaralandı, kayboldu, düşmüş).
      /(?<!\p{L})(kaybol|kayıp|yaralan|yarala|düştü|düşmüş|kaza(?!n)|imdat|acil|sos|çığ|donma|hipotermi)/iu,
      /(?<!\p{L})(lost|injured|accident|emergency|rescue|avalanche|frostbite)\b/iu,
      /(?<!\p{L})(потерял|травм|авари|срочно|спасат|лавин)\w*/iu,
      /(?<!\p{L})(verletzt|notfall|rettung|lawine|vermisst)\b/iu,
    ],
  },
  {
    intent: 'complaint',
    escalate: true,
    patterns: [
      /(?<!\p{L})(çök|açılmıyor|hata|bug|çalışmıyor|donuyor|iade|dolandır)/iu,
      /(?<!\p{L})(crash|broken|doesn'?t work|refund|scam|bug)\b/iu,
      /(?<!\p{L})(не работает|ошибк|вылета|верните)\w*/iu,
      /(?<!\p{L})(stürzt ab|funktioniert nicht|fehler|erstattung)\b/iu,
    ],
  },
  {
    intent: 'partnership',
    escalate: true,
    patterns: [
      /(?<!\p{L})(iş ?birliği|işbirliği|sponsor|reklam|kulübümüz|kulübüm|rehberim|işletme|ortaklık)/iu,
      /(?<!\p{L})(collab|partnership|sponsor|our club|press|media kit)\b/iu,
      /(?<!\p{L})(сотрудничеств|реклам|наш клуб|партнёр)\w*/iu,
      /(?<!\p{L})(kooperation|zusammenarbeit|verein|presse)\b/iu,
    ],
  },
  {
    intent: 'question',
    escalate: false,
    patterns: [/\?/u, /(?<!\p{L})(nasıl|nerede|ne zaman|var mı|kaç)(?!\p{L})/iu, /\b(how|where|when|does it|can i)\b/iu, /(?<!\p{L})(как|где|когда|можно ли)(?!\p{L})/iu, /(?<!\p{L})(wie|wo|wann|kann ich)(?!\p{L})/iu],
  },
  {
    intent: 'spam',
    escalate: false,
    patterns: [/(?<!\p{L})(takipçi|follow ?4 ?follow|bitcoin|casino|bahis|kazanç garanti)/iu, /\bfree followers?\b/iu, /(?<!\p{L})(крипт|казино|подписчик)/iu],
  },
];

/** Basit dil sezgisi (yanıt taslağı için yeterli). */
export function guessLang(text) {
  const t = String(text);
  if (/[\u0400-\u04FF]/u.test(t)) return 'ru';
  if (/[çğışöüÇĞİŞÖÜ]/u.test(t) || /(?<!\p{L})(nasıl|nerede|merhaba|teşekkür|kulüp)/iu.test(t)) return 'tr';
  if (/(?<!\p{L})(und|nicht|wie|danke|wandern|berg|kann)(?!\p{L})/iu.test(t) || /[äöüß]/u.test(t)) return 'de';
  return 'en';
}

/** Metnin niyetini kural tabanlı sınıflar. */
export function classifyIntent(text) {
  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((p) => p.test(text))) return { intent: rule.intent, escalate: rule.escalate };
  }
  return { intent: 'praise', escalate: false };
}

const REPLY_POOLS = {
  safety: {
    tr: [
      'Önce acil durum: 112’yi ara, konumunu paylaş, mümkünse yerinde kal. Uygulamada SOS’a basılı tutarsan konumun acil kişilerine gider. Buradan da takipteyiz, ne olduğunu yazarsan yönlendirelim.',
      'Bu ciddi — 112 ve varsa yerel dağ kurtarma. Zirtan’de SOS ekranında ülkeye göre numara ve en yakın kurtarma merkezi çıkıyor. Durumu yazarsan hemen ilgileniriz.',
    ],
    en: [
      'Emergency first: call your local number (112 in Türkiye/EU), share your location, and stay put if you can. Holding SOS in the app sends your location to your emergency contacts. Tell us what happened and we’ll follow up here.',
      'That sounds serious — call 112 and mountain rescue if you have a number. The SOS screen shows the country’s number and nearest rescue base. Write us what you need.',
    ],
    de: [
      'Zuerst der Notfall: 112 anrufen, Standort teilen, wenn möglich bleiben wo du bist. Mit gedrücktem SOS schickt die App deinen Standort an deine Notfallkontakte. Schreib uns, was passiert ist.',
      'Das klingt ernst — 112 und die Bergrettung. Im SOS-Screen stehen die Nummer des Landes und die nächste Rettungsstelle. Sag uns, was du brauchst.',
    ],
    ru: [
      'Сначала экстренное: звони 112, поделись координатами, по возможности оставайся на месте. Удержание SOS отправит твоё местоположение экстренным контактам. Напиши, что случилось, — поможем.',
      'Это серьёзно — 112 и горноспасатели. На экране SOS есть номер по стране и ближайшая база спасателей. Напиши, что нужно.',
    ],
  },
  question: {
    tr: [
      'Kısa cevap: {answer} Uzun hâli için sorunu biraz açarsan (rota, mevsim, kaç kişi) daha net yazayım.',
      '{answer} Detay istersen rotayı ve tarihi yaz, ona göre bakalım.',
    ],
    en: [
      'Short answer: {answer} Tell me the route, the season and group size and I’ll go into detail.',
      '{answer} If you share the route and dates I can be more specific.',
    ],
    de: [
      'Kurz: {answer} Sag mir Route, Jahreszeit und Gruppengröße, dann gehe ich ins Detail.',
      '{answer} Mit Route und Datum kann ich genauer antworten.',
    ],
    ru: [
      'Коротко: {answer} Напиши маршрут, сезон и сколько вас — отвечу подробнее.',
      '{answer} Если скажешь маршрут и даты, отвечу конкретнее.',
    ],
  },
  complaint: {
    tr: [
      'Haklısın, böyle olmamalıydı. Cihaz modelini ve uygulama sürümünü yazar mısın (Profil → Ayarlar → Hakkında)? Kaydı açıp bu hafta dönüyoruz.',
      'Özür dileriz. Hatayı yakalayabilmemiz için ne yaptığında olduğunu ve sürümü yazarsan kaydı açalım; düzeldiğinde buradan haber veririz.',
    ],
    en: [
      'You’re right, that shouldn’t happen. Can you send the device model and app version (Profile → Settings → About)? We’ll open a ticket and come back this week.',
      'Sorry about that. Tell us what you were doing when it happened plus the version — we’ll file it and ping you when it’s fixed.',
    ],
    de: [
      'Du hast recht, das sollte nicht passieren. Schick uns bitte Gerätemodell und App-Version (Profil → Einstellungen → Über). Wir legen ein Ticket an und melden uns diese Woche.',
      'Sorry. Beschreib kurz, was du gemacht hast, plus Version — wir melden uns, sobald es behoben ist.',
    ],
    ru: [
      'Ты прав, так быть не должно. Пришли модель телефона и версию приложения (Профиль → Настройки → О приложении) — заведём задачу и вернёмся на этой неделе.',
      'Извини. Напиши, что делал(а) в этот момент, и версию — сообщим, когда починим.',
    ],
  },
  partnership: {
    tr: [
      'Memnuniyetle. Kulüp/işletme paketimiz ücretsiz: profil, etkinlik + RSVP, .edu doğrulama ve kulüp ligi. DM’den isim ve şehir yazarsan aynı gün açıyoruz.',
      'İş birliğine varız. Ne yaptığınızı ve ne beklediğinizi kısaca yazın; rehber/eğitmen tarafında Pro Guide 3 ay ücretsiz.',
    ],
    en: [
      'Happy to. The club/business pack is free: profile, events with RSVP, .edu verification and the club league. DM us the name and city and we’ll set it up the same day.',
      'Let’s talk. Tell us what you run and what you need; for guides the Pro Guide plan is free for 3 months.',
    ],
    de: [
      'Gerne. Das Paket für Vereine und Betriebe ist kostenlos: Profil, Touren mit RSVP, .edu-Verifizierung, Vereinsliga. Schick uns Name und Ort per DM.',
      'Sehr gern. Schreib kurz, was ihr macht und was ihr braucht; für Guides ist Pro Guide 3 Monate kostenlos.',
    ],
    ru: [
      'С удовольствием. Пакет для клубов и бизнеса бесплатный: профиль, события с RSVP, .edu-подтверждение, лига клубов. Напишите название и город в личные — откроем в тот же день.',
      'Давайте. Расскажите, чем занимаетесь и что нужно; гидам Pro Guide бесплатно на 3 месяца.',
    ],
  },
  praise: {
    tr: [
      'Teşekkürler! Bir sonraki rotanı Zirtan’de işaretlersen tehlike haritasına katkın olur — arkandan gelen de görür.',
      'Ne güzel, sağ ol. Fotoğrafını #zirtanapp ile paylaşırsan (izninle) sayfada yer verelim.',
    ],
    en: [
      'Thank you! Mark your next route in Zirtan and the hazard map gets better for whoever walks it next.',
      'Appreciate it. Tag #zirtanapp and — with your permission — we’ll feature the shot.',
    ],
    de: [
      'Danke! Wenn du deine nächste Tour in Zirtan markierst, profitieren alle, die nach dir gehen.',
      'Danke dir. Mit #zirtanapp markieren — und mit deiner Erlaubnis zeigen wir das Foto.',
    ],
    ru: [
      'Спасибо! Отметь следующий маршрут в Zirtan — карта опасностей станет полезнее для тех, кто пойдёт следом.',
      'Спасибо. Поставь #zirtanapp — с твоего разрешения покажем кадр у нас.',
    ],
  },
  spam: {
    tr: ['Yanıt verme; gizle/bildir. Takipçi-bot yorumları erişimi düşürür.'],
    en: ['Do not reply; hide or report. Follow-bot comments hurt reach.'],
    de: ['Nicht antworten; ausblenden oder melden.'],
    ru: ['Не отвечать; скрыть или пожаловаться.'],
  },
};

/**
 * Yorum/DM için yanıt taslağı üretir (insan onayı şart).
 * @param {{ id?: string, text: string, lang?: string, author?: string }} mention
 */
export function draftReply(mention, spec, ctx = {}) {
  const text = String(mention.text ?? '');
  const lang = mention.lang ?? guessLang(text);
  const { intent, escalate } = classifyIntent(text);
  const pool = REPLY_POOLS[intent][lang] ?? REPLY_POOLS[intent].en;
  let draft = pick(`${mention.id ?? text}-${spec.id}`, pool);
  if (draft.includes('{answer}')) {
    draft = draft.replace('{answer}', ctx.answer ?? knownAnswer(text, lang));
  }
  const maxLen = spec.maxReplyChars ?? 500;
  return {
    channel: spec.id,
    mentionId: mention.id ?? null,
    lang,
    intent,
    escalate,
    escalateReason: escalate ? ESCALATE_REASON[intent] : '',
    draft: truncate(draft, maxLen),
    needsHuman: true,
    channelNote: spec.replyNote ?? '',
  };
}

const ESCALATE_REASON = {
  safety: 'Güvenlik/kaza içeriyor — insan onayı ve gerekirse 112 yönlendirmesi şart.',
  complaint: 'Hata/iade konusu — destek kaydı açılmalı.',
  partnership: 'Ortaklık talebi — ticari yanıt insana ait.',
};

/** Sık sorulan üç soruya hazır, dürüst cevap (uydurma yok). */
function knownAnswer(text, lang) {
  const t = text.toLowerCase();
  const key = /ücret|fiyat|price|kosten|цена|бесплат|free/u.test(t)
    ? 'price'
    : /çevrimdışı|offline|офлайн/u.test(t)
      ? 'offline'
      : /android|ios|iphone|telefon/u.test(t)
        ? 'platform'
        : 'general';
  const answers = {
    price: {
      tr: 'Kâşif planı ücretsiz; Pro ₺149/ay, rehberler için Pro Guide ₺399/ay.',
      en: 'The Explorer plan is free; Pro is ₺149/month and Pro Guide (for guides) ₺399/month.',
      de: 'Der Explorer-Plan ist kostenlos; Pro kostet ₺149/Monat, Pro Guide ₺399/Monat.',
      ru: 'План «Кашиф» бесплатный; Pro — ₺149/мес, Pro Guide — ₺399/мес.',
    },
    offline: {
      tr: 'Haritalar (PMTiles), rota motoru ve 12 ilk yardım rehberi çevrimdışı çalışır; eşleşme ve canlı yayın internet ister.',
      en: 'Maps (PMTiles), the routing engine and the 12 first-aid guides work offline; matching and live streams need a connection.',
      de: 'Karten (PMTiles), Routing und die 12 Erste-Hilfe-Leitfäden funktionieren offline; Matching und Livestream brauchen Netz.',
      ru: 'Карты (PMTiles), маршрутизация и 12 инструкций по первой помощи работают офлайн; подбор и эфиры требуют сети.',
    },
    platform: {
      tr: 'iOS ve Android — tek uygulama, aynı hesap.',
      en: 'iOS and Android — one app, same account.',
      de: 'iOS und Android — eine App, ein Konto.',
      ru: 'iOS и Android — одно приложение, один аккаунт.',
    },
    general: {
      tr: 'Kütüphanede rota, kamp ve tırmanış alanları; haritada topluluk tehlike bildirimleri; SOS ekranında ülkeye göre acil numara var.',
      en: 'The library has routes, campsites and crags; the map carries community hazard reports; the SOS screen shows country-specific emergency numbers.',
      de: 'In der Bibliothek stehen Routen, Zeltplätze und Klettergebiete; die Karte zeigt Gefahrenmeldungen der Community; im SOS-Screen die Notrufnummern des Landes.',
      ru: 'В библиотеке маршруты, кемпинги и скалы; на карте — отметки опасностей от сообщества; в SOS — экстренные номера по стране.',
    },
  };
  return answers[key][lang] ?? answers[key].en;
}

/* ------------------------------------------------------------------ */
/* Fabrika                                                               */
/* ------------------------------------------------------------------ */

/**
 * Kanal tanımından tam adaptör üretir.
 * `def.buildRequests(item, formatted, env)` canlı yayın için HTTP planı döner.
 */
export function defineChannel(def) {
  const spec = def.spec;

  async function publish(item, ctx = makeContext()) {
    validateItem(item);
    const formatted = formatForChannel(item, spec);
    const { ready, missing } = envReady(spec, ctx.env);
    const requests = def.buildRequests ? def.buildRequests(item, formatted, ctx.env) : [];
    const blocking = formatted.compliance.length > 0;
    const mode = ctx.live && ready && !blocking ? 'live' : 'dry-run';
    const reason = blocking
      ? 'marka denetimi başarısız (yasak ifade)'
      : !ctx.live
        ? 'kuru çalışma (varsayılan) — gerçek yayın için --live'
        : !spec.canPublish
          ? `${spec.label} API ile yayına kapalı: elle yükle`
          : missing.length > 0
            ? `eksik ortam değişkeni: ${missing.join(', ')}`
            : '';

    const packet = packetMarkdown(item, spec, formatted, { mode, reason });
    const result = {
      channel: spec.id,
      postId: item.id,
      mode,
      ok: !blocking,
      reason,
      warnings: formatted.warnings,
      text: formatted.text,
      hashtags: formatted.hashtags,
      bestTime: item.bestTime ?? bestTimeFor(spec, item.lang),
      requests: requests.map((r) => ({ ...r, headers: undefined })),
      remoteIds: [],
      packetPath: null,
    };

    if (mode === 'dry-run') {
      if (ctx.writer && ctx.outDir) {
        result.packetPath = ctx.writer.text(`${ctx.outDir}/${spec.id}/${item.id}.md`, packet);
      }
      ctx.log(`[kuru] ${spec.id} · ${item.id} — ${reason}`);
      return result;
    }

    for (const req of requests) {
      if (spec.minGapMs) await ctx.sleep(spec.minGapMs);
      const res = await ctx.fetchImpl(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.jsonBody ? JSON.stringify(req.jsonBody) : req.formBody ? new URLSearchParams(req.formBody) : undefined,
      });
      const body = await res.text();
      if (!res.ok) {
        result.ok = false;
        result.error = `HTTP ${res.status} ${redact(req.url)}: ${body.slice(0, 240)}`;
        return result;
      }
      try {
        const json = JSON.parse(body);
        result.remoteIds.push(String(json.id ?? json.id_str ?? json.post_id ?? json.response?.post_id ?? 'ok'));
      } catch {
        result.remoteIds.push('ok');
      }
    }
    ctx.log(`[canlı] ${spec.id} · ${item.id} → ${result.remoteIds.join(', ')}`);
    return result;
  }

  function schedule(items, ctx = makeContext()) {
    const entries = [];
    const perDay = new Map();
    for (const item of items) {
      const date = item.date ?? new Date(ctx.now).toISOString().slice(0, 10);
      const used = perDay.get(date) ?? 0;
      const time = item.bestTime ?? bestTimeFor(spec, item.lang, used);
      perDay.set(date, used + 1);
      entries.push({
        id: `${spec.id}-${item.id}`,
        channel: spec.id,
        postId: item.id,
        date,
        time,
        lang: item.lang,
        format: item.format ?? spec.formats[0],
        summary: `${spec.label}: ${truncate(item.title, 60)}`,
        description: `${item.cta ?? ''} ${item.link ?? ''}`.trim(),
        overCadence: used + 1 > spec.maxPerDay,
        note: used + 1 > spec.maxPerDay ? `günlük ${spec.maxPerDay} gönderi sınırı aşıldı` : '',
      });
    }
    entries.sort((a, b) => (a.date === b.date ? minutesOf(a.time) - minutesOf(b.time) : a.date < b.date ? -1 : 1));
    const ics = toIcs(entries, `Zirtan · ${spec.label}`);
    if (ctx.writer && ctx.outDir) {
      ctx.writer.text(`${ctx.outDir}/${spec.id}/schedule.ics`, ics);
      ctx.writer.json(`${ctx.outDir}/${spec.id}/schedule.json`, entries);
    }
    return { channel: spec.id, entries, ics };
  }

  async function metrics(range = {}, ctx = makeContext()) {
    const { ready, missing } = envReady(spec, ctx.env);
    const plan = def.metricsRequest ? def.metricsRequest(range, ctx.env) : null;
    const source = spec.metrics;
    if (!ctx.live || !ready || !plan) {
      return {
        channel: spec.id,
        mode: 'dry-run',
        reason: !ctx.live ? 'kuru çalışma' : missing.length > 0 ? `eksik değişken: ${missing.join(', ')}` : 'API yok',
        fields: source.fields,
        manualExport: source.manualExport,
        csvHeader: ['date', 'channel', 'post_id', ...source.fields].join(','),
        rows: [],
        plannedRequest: plan ?? null,
      };
    }
    const res = await ctx.fetchImpl(plan.url, { method: plan.method, headers: plan.headers });
    const body = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${redact(plan.url)}: ${body.slice(0, 240)}`);
    const json = JSON.parse(body);
    return {
      channel: spec.id,
      mode: 'live',
      fields: source.fields,
      rows: def.parseMetrics ? def.parseMetrics(json) : [],
      raw: json,
    };
  }

  function reply(mention, ctx = makeContext()) {
    return draftReply(mention, spec, ctx);
  }

  return { id: spec.id, spec, publish, schedule, metrics, reply };
}

/** Log çıktısında token maskeler. */
export function redact(value) {
  return String(value)
    .replace(/(access_token|token|key)=([^&\s]{4})[^&\s]*/giu, '$1=$2…')
    .replace(/(bot)(\d+):[A-Za-z0-9_-]+/gu, '$1$2:…');
}
