/**
 * İçerik kalıpları (arketipler).
 *
 * Her arketip veriden (destinasyon, rota, tür, tarihi alan, kaya alanı, yer, kulüp)
 * dört dilde — tr / en / de / ru — bir içerik üretir. Metin veriden beslendiği için
 * her kayıt farklı çıkar; kanca ve kapanış cümleleri deterministik varyant havuzundan
 * seçilir (aynı kayıt her çalıştırmada aynı metni verir).
 *
 * Üretilen gövde üç uzunlukta gelir:
 *   short  → X, TikTok, Pinterest (tek fikir)
 *   medium → Instagram, Facebook, Telegram, VK, LinkedIn
 *   long   → Reddit, YouTube açıklaması, blog
 */

import { monthRanges, monthName } from '../lib/dates.mjs';
import { duration, num, pick, slugify } from '../lib/text.mjs';
import {
  activityName,
  attribution,
  era,
  FIRST_AID_BY_GROUP,
  heritageKind,
  localizeRisks,
  localizeRules,
  rockType as rockTypeName,
  stageKind,
} from './lexicon.mjs';
import {
  clubsByCountry,
  cragsInMonth,
  destinationsInMonth,
  loadData,
  placesOfKind,
  riskySpeciesInMonth,
  routesOfActivity,
  unescoSites,
} from './sources.mjs';

/** Dile göre değer seçer (eksikse İngilizce). */
export const T = (lang, table) => table[lang] ?? table.en;

const j = (arr) =>
  arr
    .filter((l) => l !== undefined && l !== null)
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();

const LABEL = {
  distance: { tr: 'mesafe', en: 'distance', de: 'Distanz', ru: 'дистанция' },
  ascent: { tr: 'tırmanış', en: 'ascent', de: 'Aufstieg', ru: 'набор' },
  days: { tr: 'gün', en: 'days', de: 'Tage', ru: 'дней' },
  season: { tr: 'sezon', en: 'season', de: 'Saison', ru: 'сезон' },
  water: { tr: 'su', en: 'water', de: 'Wasser', ru: 'вода' },
  signal: { tr: 'şebeke', en: 'signal', de: 'Empfang', ru: 'связь' },
  budget: { tr: 'bütçe', en: 'budget', de: 'Budget', ru: 'бюджет' },
  permit: { tr: 'izin', en: 'permit', de: 'Genehmigung', ru: 'пермит' },
  sleep: { tr: 'konaklama', en: 'overnight', de: 'Übernachtung', ru: 'ночёвка' },
  yes: { tr: 'var', en: 'yes', de: 'ja', ru: 'есть' },
  no: { tr: 'yok', en: 'no', de: 'nein', ru: 'нет' },
};

const DIFFICULTY = {
  easy: { tr: 'kolay', en: 'easy', de: 'leicht', ru: 'лёгкий' },
  moderate: { tr: 'orta', en: 'moderate', de: 'mittel', ru: 'средний' },
  hard: { tr: 'zor', en: 'hard', de: 'schwer', ru: 'сложный' },
  expert: { tr: 'çok zor', en: 'expert', de: 'sehr schwer', ru: 'экспертный' },
};

const CONNECTIVITY = {
  none: { tr: 'şebeke yok', en: 'no signal', de: 'kein Empfang', ru: 'связи нет' },
  weak: { tr: 'zayıf şebeke', en: 'weak signal', de: 'schwacher Empfang', ru: 'слабая связь' },
  good: { tr: 'şebeke var', en: 'signal ok', de: 'Empfang vorhanden', ru: 'связь есть' },
  wifi: { tr: 'wifi var', en: 'wifi available', de: 'WLAN vorhanden', ru: 'есть wi-fi' },
};

const dif = (d, lang) => T(lang, DIFFICULTY[d] ?? DIFFICULTY.moderate);
const conn = (c, lang) => T(lang, CONNECTIVITY[c] ?? CONNECTIVITY.none);

/* ------------------------------------------------------------------ */
/* 1 · Etap etap gezi planı                                              */
/* ------------------------------------------------------------------ */

const itinerary = {
  id: 'itinerary',
  label: 'Etap etap gezi planı',
  needsSafetyNote: false,
  subjects: () => loadData().destinations,
  key: (d) => d.slug,
  build(d, lang) {
    const days = d.typicalDays ?? Math.max(2, Math.round((d.stages?.length ?? 4) * 0.8));
    const km = Math.round(d.totalDistanceKm ?? 0);
    const stages = (d.stages ?? []).filter((s) => s.sleeping || s.kind === 'summit').slice(0, 6);
    const water = (d.stages ?? []).filter((s) => s.waterAvailable).length;
    const offline = (d.stages ?? []).filter((s) => s.connectivity === 'none').length;
    const season = monthRanges(d.bestMonths ?? [], lang);
    const hook = pick(`${d.slug}-itinerary-${lang}`, T(lang, {
      tr: [
        `${d.name} için en çok sorulan şey şu: kaç gün ve hangi etap nerede biter.`,
        `${d.name} için en sakin bölme: ${days} gün, akşamları belli.`,
        `${d.name}: ${days} gün, ${km} km ve her akşam nerede uyuyacağın belli.`,
      ],
      en: [
        `The question people ask about ${d.name} is always the same: how many days, and where does each one end?`,
        `Here is the calmest way to split ${d.name} into ${days} days.`,
        `${d.name}: ${days} days, ${km} km, and a known bed at the end of each one.`,
      ],
      de: [
        `Die häufigste Frage zum ${d.name}: wie viele Tage — und wo endet jeder davon?`,
        `So teilst du ${d.name} entspannt in ${days} Tage.`,
        `${d.name}: ${days} Tage, ${km} km und jeden Abend ein bekanntes Ziel.`,
      ],
      ru: [
        `Про ${d.name} спрашивают одно и то же: сколько дней и где заканчивается каждый.`,
        `Вот спокойный вариант разбивки ${d.name} на ${days} дней.`,
        `${d.name}: ${days} дней, ${km} км и понятная ночёвка в конце каждого.`,
      ],
    }));

    const stageLines = stages.map((s, i) =>
      T(lang, {
        tr: `${i + 1}. ${s.name} — ${s.distanceKm} km, ${duration(s.durationMin, 'tr')}, ${num(s.elevationM)} m${s.waterAvailable ? ', su var' : ', su yok'}${s.connectivity === 'none' ? ', şebeke yok' : ''}`,
        en: `${i + 1}. ${s.name} — ${s.distanceKm} km, ${duration(s.durationMin, 'en')}, ${num(s.elevationM, 'en')} m${s.waterAvailable ? ', water' : ', no water'}${s.connectivity === 'none' ? ', no signal' : ''}`,
        de: `${i + 1}. ${s.name} — ${s.distanceKm} km, ${duration(s.durationMin, 'de')}, ${num(s.elevationM, 'de')} m${s.waterAvailable ? ', Wasser' : ', kein Wasser'}${s.connectivity === 'none' ? ', kein Empfang' : ''}`,
        ru: `${i + 1}. ${s.name} — ${s.distanceKm} км, ${duration(s.durationMin, 'ru')}, ${num(s.elevationM, 'ru')} м${s.waterAvailable ? ', вода есть' : ', воды нет'}${s.connectivity === 'none' ? ', связи нет' : ''}`,
      }),
    );

    const facts = T(lang, {
      tr: `Sezon ${season}. Zorluk ${dif(d.difficulty, 'tr')}, en yüksek nokta ${num(d.maxElevationM)} m. ${water} etapta su var, ${offline} etapta şebeke yok — haritayı çevrimdışı indir.`,
      en: `Season: ${season}. ${dif(d.difficulty, 'en')}, high point ${num(d.maxElevationM, 'en')} m. Water on ${water} stages, no signal on ${offline} — download the map offline.`,
      de: `Saison: ${season}. ${dif(d.difficulty, 'de')}, höchster Punkt ${num(d.maxElevationM, 'de')} m. Wasser auf ${water} Etappen, auf ${offline} kein Empfang — Karte offline laden.`,
      ru: `Сезон: ${season}. Сложность — ${dif(d.difficulty, 'ru')},高 точка ${num(d.maxElevationM, 'ru')} м. Вода на ${water} этапах, на ${offline} нет связи — скачай карту офлайн.`.replace('高 ', 'высшая '),
    });

    const localizedRisks = localizeRisks(d.risks ?? [], lang);
    const risks = localizedRisks.lines.slice(0, 3);
    const permits = (d.permits ?? []).map((p) => `${p.name} (₺${num(p.costTry)})`).join(', ');
    const overview = T(lang, {
      tr: d.summary,
      en: `${d.name} runs through ${d.region} (${d.countryCode}): ${days} days, ${km} km, high point ${num(d.maxElevationM, 'en')} m, graded ${dif(d.difficulty, 'en')}. Season ${season}.`,
      de: `${d.name} führt durch ${d.region} (${d.countryCode}): ${days} Tage, ${km} km, höchster Punkt ${num(d.maxElevationM, 'de')} m, ${dif(d.difficulty, 'de')}. Saison ${season}.`,
      ru: `${d.name} проходит по ${d.region} (${d.countryCode}): ${days} дней, ${km} км, верхняя точка ${num(d.maxElevationM, 'ru')} м, сложность — ${dif(d.difficulty, 'ru')}. Сезон ${season}.`,
    });
    const budget = d.budgetTry ? `₺${num(d.budgetTry.low)}–${num(d.budgetTry.high)}` : '';

    return {
      title: T(lang, {
        tr: `${d.name}: ${days} günde etap etap plan`,
        en: `${d.name} in ${days} days — stage by stage`,
        de: `${d.name} in ${days} Tagen — Etappe für Etappe`,
        ru: `${d.name} за ${days} дней — по этапам`,
      }),
      hook,
      short: T(lang, {
        tr: `${d.name}, ${days} gün, ${km} km. ${stages[0]?.name ?? ''} ile başla; ${offline} etapta şebeke yok, haritayı önceden indir.`,
        en: `${d.name}: ${days} days, ${km} km. Start at ${stages[0]?.name ?? ''}; ${offline} stages have no signal, so download the map first.`,
        de: `${d.name}: ${days} Tage, ${km} km. Start bei ${stages[0]?.name ?? ''}; auf ${offline} Etappen kein Empfang — Karte vorher laden.`,
        ru: `${d.name}: ${days} дней, ${km} км. Старт — ${stages[0]?.name ?? ''}; на ${offline} этапах нет связи, скачай карту заранее.`,
      }),
      medium: j([hook, '', ...stageLines, '', facts]),
      long: j([
        hook,
        '',
        lang === 'tr' ? d.summary : overview,
        '',
        T(lang, { tr: '**Etaplar**', en: '**Stages**', de: '**Etappen**', ru: '**Этапы**' }),
        ...(d.stages ?? []).map((s) =>
          `${s.order}. ${s.name} (${stageKind(s.kind, lang)}) — ${s.distanceKm} km · ${duration(s.durationMin, lang)} · ${num(s.elevationM, lang)} m · ${s.waterAvailable ? T(lang, LABEL.water) + ' ' + T(lang, LABEL.yes) : T(lang, LABEL.water) + ' ' + T(lang, LABEL.no)} · ${conn(s.connectivity, lang)}${lang === 'tr' && s.note ? ` — ${s.note}` : ''}`,
        ),
        '',
        facts,
        permits ? T(lang, { tr: `İzinler: ${permits}.`, en: `Permits: ${permits}.`, de: `Genehmigungen: ${permits}.`, ru: `Пермиты: ${permits}.` }) : '',
        budget ? T(lang, { tr: `Bütçe: ${budget}.`, en: `Budget: ${budget}.`, de: `Budget: ${budget}.`, ru: `Бюджет: ${budget}.` }) : '',
        risks.length ? T(lang, { tr: '**Riskler**', en: '**Risks**', de: '**Risiken**', ru: '**Риски**' }) : '',
        ...risks.map((r) => `- ${r}`),
        lang === 'tr' && d.rescueNote ? `\n${d.rescueNote}` : '',
      ]),
      keywords: [d.name, `${d.name} ${T(lang, { tr: 'rota', en: 'route', de: 'Route', ru: 'маршрут' })}`, `${days} ${T(lang, LABEL.days)}`],
      visual: {
        aspect: '4:5 + 9:16',
        brief: T(lang, {
          tr: `${d.name} etap haritası: rota çizgisi + ${stages.length} konaklama noktası, yükseklik profili şeridi altta. İkinci kare: uygulamadaki rota ekranı (yükseklik profili görünür).`,
          en: `Stage map of ${d.name}: route line, ${stages.length} overnight stops, elevation strip at the bottom. Second frame: the route screen in the app.`,
          de: `Etappenkarte ${d.name}: Routenlinie, ${stages.length} Übernachtungen, Höhenprofil unten. Zweites Bild: Routen-Screen der App.`,
          ru: `Карта этапов ${d.name}: линия маршрута, ${stages.length} ночёвок, профиль высот внизу. Второй кадр — экран маршрута в приложении.`,
        }),
        shots: (stages.slice(0, 4).map((s) => `${s.name} — ${T(lang, { tr: 'sabah ışığı, geniş açı', en: 'morning light, wide', de: 'Morgenlicht, weit', ru: 'утренний свет, широкий кадр' })}`)),
        alt: T(lang, {
          tr: `${d.name} rotasının etap haritası ve yükseklik profili`,
          en: `Stage map and elevation profile of ${d.name}`,
          de: `Etappenkarte und Höhenprofil ${d.name}`,
          ru: `Карта этапов и профиль высот ${d.name}`,
        }),
      },
      sources: d.sources ?? [],
      translationNotes: localizedRisks.unmapped,
      subject: { kind: 'destination', slug: d.slug, name: d.name, country: d.countryCode },
    };
  },
};

/* ------------------------------------------------------------------ */
/* 2 · İlk 10 dakika (tür + ilk yardım)                                  */
/* ------------------------------------------------------------------ */

const ENCOUNTER = {
  snake: { tr: 'ısırığında', en: 'snake bite', de: 'Schlangenbiss', ru: 'укусе змеи' },
  arachnid: { tr: 'sokmasında', en: 'sting or bite', de: 'Stich oder Biss', ru: 'укусе' },
  insect: { tr: 'sokmasında', en: 'sting', de: 'Stich', ru: 'укусе' },
  marine: { tr: 'temasında', en: 'contact', de: 'Kontakt', ru: 'контакте' },
  mammal: { tr: 'karşılaşmasında', en: 'encounter', de: 'Begegnung', ru: 'встрече' },
  plant: { tr: 'temasında', en: 'contact', de: 'Kontakt', ru: 'контакте' },
  fungus: { tr: 'yenmesinde', en: 'ingestion', de: 'Verzehr', ru: 'отравлении' },
  bird: { tr: 'karşılaşmasında', en: 'encounter', de: 'Begegnung', ru: 'встрече' },
};

const first10 = {
  id: 'first-10-minutes',
  label: 'İlk 10 dakika (güvenlik)',
  needsSafetyNote: true,
  subjects: () => loadData().species.filter((s) => ['deadly', 'dangerous'].includes(s.danger)),
  key: (s) => s.id,
  build(s, lang) {
    const enc = T(lang, ENCOUNTER[s.group] ?? ENCOUNTER.snake);
    const nameTail = lang === 'tr' ? '' : ` (${s.commonName})`;
    const aid = FIRST_AID_BY_GROUP[s.group] ?? FIRST_AID_BY_GROUP.snake;
    const dos = lang === 'tr' ? (s.encounterDo ?? []).slice(0, 5) : (aid[lang] ?? aid.en).do;
    const donts = lang === 'tr' ? (s.encounterDont ?? []).slice(0, 4) : (aid[lang] ?? aid.en).dont;
    const months = monthRanges(s.activeMonths ?? [], lang);

    const title = T(lang, {
      tr: `${s.commonName} ${enc} ilk 10 dakika`,
      en: `The first 10 minutes after a ${enc}: ${s.scientificName}`,
      de: `Die ersten 10 Minuten nach einem ${enc}: ${s.scientificName}`,
      ru: `Первые 10 минут при ${enc}: ${s.scientificName}`,
    });

    const hook = pick(`${s.id}-first10-${lang}`, T(lang, {
      tr: [
        `Panik en hızlı zehir taşıyıcısıdır. ${s.commonName} için sıralama şu:`,
        `${s.commonName} ile karşılaştın. Sonraki on dakika, geri kalan her şeyden önemli.`,
        `${s.commonName}: ne yapacağını bilmek, ne olduğunu bilmekten daha çok işe yarar.`,
      ],
      en: [
        `Panic moves venom faster than anything else. For ${s.scientificName}${nameTail}, the order is this:`,
        `You have just met ${s.scientificName}${nameTail}. The next ten minutes matter more than the rest of the day.`,
        `${s.scientificName}${nameTail}: knowing what to do beats knowing what it was.`,
      ],
      de: [
        `Panik verteilt Gift schneller als alles andere. Für ${s.scientificName}${nameTail} gilt diese Reihenfolge:`,
        `Du bist ${s.scientificName}${nameTail} begegnet. Die nächsten zehn Minuten zählen mehr als der Rest des Tages.`,
        `${s.scientificName}${nameTail}: zu wissen, was zu tun ist, hilft mehr als zu wissen, was es war.`,
      ],
      ru: [
        `Паника разносит яд быстрее всего. Для ${s.scientificName}${nameTail} порядок такой:`,
        `Ты встретил ${s.scientificName}${nameTail}. Следующие десять минут важнее всего остального дня.`,
        `${s.scientificName}${nameTail}: знать, что делать, важнее, чем знать, кто это был.`,
      ],
    }));

    const idLines = lang === 'tr' ? (s.identification ?? []).slice(0, 3) : [];
    const doTitle = T(lang, { tr: 'Yap', en: 'Do', de: 'Tun', ru: 'Делать' });
    const dontTitle = T(lang, { tr: 'Yapma', en: 'Do not', de: 'Nicht tun', ru: 'Не делать' });
    const habitat = lang === 'tr' ? (s.habitats ?? []).slice(0, 3).join(', ') : '';
    const countries = (s.countryCodes ?? []).slice(0, 6).join(', ');
    const seasonLine = months
      ? T(lang, {
          tr: `Aktif dönem: ${months}.${habitat ? ` Görülme yeri: ${habitat}.` : ''}`,
          en: `Active ${months}. Recorded in: ${countries}. Active mostly ${s.activeHours === 'both' ? 'day and night' : s.activeHours === 'night' ? 'at night' : 'during the day'}.`,
          de: `Aktiv ${months}. Nachgewiesen in: ${countries}. Meist ${s.activeHours === 'both' ? 'tags und nachts' : s.activeHours === 'night' ? 'nachts' : 'tagsüber'} unterwegs.`,
          ru: `Активен ${months}. Встречается: ${countries}. Чаще ${s.activeHours === 'both' ? 'днём и ночью' : s.activeHours === 'night' ? 'ночью' : 'днём'}.`,
        })
      : '';

    return {
      title,
      hook,
      short: T(lang, {
        tr: `${s.commonName}: ${dos[0] ?? ''}${donts[0] ? ` Sakın: ${donts[0].toLocaleLowerCase('tr')}` : ''}`,
        en: `${s.scientificName}${nameTail}: ${dos[0] ?? ''} Never: ${donts[0] ?? ''}`,
        de: `${s.scientificName}${nameTail}: ${dos[0] ?? ''} Niemals: ${donts[0] ?? ''}`,
        ru: `${s.scientificName}${nameTail}: ${dos[0] ?? ''} Никогда: ${donts[0] ?? ''}`,
      }),
      medium: j([hook, '', `${doTitle}:`, ...dos.map((x) => `- ${x}`), '', `${dontTitle}:`, ...donts.map((x) => `- ${x}`), '', seasonLine]),
      long: j([
        hook,
        '',
        lang === 'tr' ? s.description : '',
        idLines.length ? T(lang, { tr: '**Nasıl tanınır**', en: '**How to recognise it**', de: '**So erkennst du es**', ru: '**Как узнать**' }) : '',
        ...idLines.map((x) => `- ${x}`),
        '',
        `**${doTitle}**`,
        ...(lang === 'tr' ? (s.encounterDo ?? []) : dos).map((x) => `- ${x}`),
        '',
        `**${dontTitle}**`,
        ...(lang === 'tr' ? (s.encounterDont ?? []) : donts).map((x) => `- ${x}`),
        '',
        lang === 'tr' && s.venomNote ? `${s.venomNote}` : '',
        seasonLine,
        lang === 'tr' && (s.lookalikes ?? []).length ? `Karıştırılan türler: ${s.lookalikes.join(', ')}.` : '',
        lang === 'tr'
          ? ''
          : T(lang, {
              en: 'Identification details and look-alike species are in the app’s offline species guide.',
              de: 'Bestimmungsmerkmale und Verwechslungsarten stehen im Offline-Artenführer der App.',
              ru: 'Признаки определения и похожие виды — в офлайн-определителе приложения.',
            }),
      ]),
      keywords: [s.commonName, s.scientificName, T(lang, { tr: 'ilk yardım', en: 'first aid', de: 'Erste Hilfe', ru: 'первая помощь' })],
      visual: {
        aspect: '9:16',
        brief: T(lang, {
          tr: `Kanca: ilk 1 saniyede yanlış hareket (yarayı emmek) — üstüne kırmızı çarpı. Sonra 4 kare: yap / yapma listesi, büyük altyazı. Kapanışta uygulamadaki "${s.firstAidSlug}" rehberi ekranı. Tür fotoğrafı kullanılacaksa Commons lisansı görselde yazsın.`,
          en: `Hook: the wrong move in the first second (sucking the wound) with a red cross over it. Then 4 cards: do / don’t, large captions. Close on the "${s.firstAidSlug}" guide screen. If you use a species photo, put the Commons licence line on the frame.`,
          de: `Hook: die falsche Bewegung in der ersten Sekunde (Wunde aussaugen), rot durchgestrichen. Dann 4 Karten: Tun / Nicht tun, große Untertitel. Abschluss: Screen des Leitfadens "${s.firstAidSlug}". Bei Artfoto die Commons-Lizenz einblenden.`,
          ru: `Хук: неверное действие в первую секунду (высасывать яд) — красный крест. Дальше 4 карточки: делать / не делать, крупные субтитры. В финале — экран инструкции «${s.firstAidSlug}». Если берёшь фото вида, укажи лицензию Commons в кадре.`,
        }),
        shots: [
          T(lang, { tr: 'Yakın plan: ısırık bölgesini işaretleyen kalem', en: 'Close-up: pen marking the swelling edge', de: 'Nahaufnahme: Stift markiert die Schwellung', ru: 'Крупный план: маркер на границе отёка' }),
          T(lang, { tr: 'Telefon ekranı: 112 arama + konum paylaşımı', en: 'Phone screen: calling 112 and sharing location', de: 'Handy: Notruf 112 und Standort teilen', ru: 'Экран: звонок 112 и отправка координат' }),
        ],
        alt: T(lang, {
          tr: `${s.commonName} için ilk yardım adımları kartı`,
          en: `First-aid steps card for ${s.scientificName}`,
          de: `Erste-Hilfe-Karte für ${s.scientificName}`,
          ru: `Карточка первой помощи: ${s.scientificName}`,
        }),
      },
      sources: s.sources ?? [],
      subject: { kind: 'species', slug: slugify(s.scientificName), name: s.commonName, group: s.group },
    };
  },
};

/* ------------------------------------------------------------------ */
/* 3 · Çıkmadan önce: tehlike özeti                                      */
/* ------------------------------------------------------------------ */

const hazardBrief = {
  id: 'hazard-brief',
  label: 'Çıkmadan önce tehlike özeti',
  needsSafetyNote: true,
  subjects: () => loadData().destinations.filter((d) => (d.risks ?? []).length >= 3),
  key: (d) => `${d.slug}-hazard`,
  build(d, lang) {
    const localized = localizeRisks(d.risks ?? [], lang);
    const risks = localized.lines.slice(0, 5);
    const hook = pick(`${d.slug}-hazard-${lang}`, T(lang, {
      tr: [
        `${d.name} kartpostalda sakin görünür. Kaza raporlarında tekrar eden beş şey şunlar:`,
        `Yola çıkmadan önce bu beş satırı oku — hepsi ${d.name} rotasında birilerinin başına geldi.`,
      ],
      en: [
        `${d.name} looks calm on a postcard. These five things keep showing up in incident reports:`,
        `Read these five lines before you go to ${d.name}. Every one of them happened to somebody.`,
      ],
      de: [
        `${d.name} sieht auf der Postkarte ruhig aus. Diese fünf Punkte tauchen in Unfallberichten immer wieder auf:`,
        `Lies diese fünf Zeilen, bevor du nach ${d.name} aufbrichst. Jede davon ist jemandem passiert.`,
      ],
      ru: [
        `${d.name} на открытке выглядит спокойно. В отчётах о происшествиях повторяются пять вещей:`,
        `Прочти эти пять строк перед выходом на ${d.name}. Каждая с кем-то случилась.`,
      ],
    }));
    const rescue = lang === 'tr'
      ? (d.rescueNote ?? '')
      : T(lang, {
          en: `Rescue: know the local emergency number before you start — the app shows it for ${d.countryCode} together with the nearest mountain rescue base.`,
          de: `Rettung: kenne die Notrufnummer vor dem Start — die App zeigt sie für ${d.countryCode} samt nächster Bergrettung.`,
          ru: `Спасение: узнай местный экстренный номер до выхода — приложение показывает его для ${d.countryCode} и ближайшую базу спасателей.`,
        });
    return {
      title: T(lang, {
        tr: `${d.name}: çıkmadan önce bilinmesi gereken ${risks.length} tehlike`,
        en: `${d.name}: ${risks.length} hazards to know before you go`,
        de: `${d.name}: ${risks.length} Gefahren, die du vorher kennen solltest`,
        ru: `${d.name}: ${risks.length} опасностей, о которых стоит знать заранее`,
      }),
      hook,
      short: T(lang, {
        tr: `${d.name}: ${risks[0]} Diğer dördü ve ne yapılacağı profilde.`,
        en: `${d.name}: ${risks[0]} The other four — and what to do — are in the guide.`,
        de: `${d.name}: ${risks[0]} Die anderen vier stehen im Leitfaden.`,
        ru: `${d.name}: ${risks[0]} Остальные четыре — в гиде.`,
      }),
      medium: j([hook, '', ...risks.map((r, i) => `${i + 1}. ${r}`), '', rescue]),
      long: j([
        hook,
        '',
        ...risks.map((r, i) => `${i + 1}. ${r}`),
        '',
        rescue,
        '',
        T(lang, {
          tr: `Uygulamada bu rotanın tehlike bildirimlerini haritada görebilir, kendi gördüğünü işaretleyebilirsin; işaret yakındaki kullanıcılara düşer.`,
          en: `In the app you can see community hazard reports for this route on the map and add your own; nearby users get the alert.`,
          de: `In der App siehst du Gefahrenmeldungen der Community auf der Karte und kannst eigene hinzufügen; Nutzer in der Nähe werden benachrichtigt.`,
          ru: `В приложении отметки опасностей по этому маршруту видны на карте, свою можно добавить — уведомление получат те, кто рядом.`,
        }),
      ]),
      keywords: [d.name, T(lang, { tr: 'güvenlik', en: 'safety', de: 'Sicherheit', ru: 'безопасность' })],
      visual: {
        aspect: '4:5',
        brief: T(lang, {
          tr: `Karusel: 1) ${d.name} manzarası + başlık 2–6) her karede tek tehlike, kısa çözüm satırı 7) tehlike haritası radar ekranı. Kırmızı şerit, emoji yok.`,
          en: `Carousel: 1) landscape of ${d.name} with the title 2–6) one hazard per card with the fix 7) hazard map radar screen. Red banner, no emoji.`,
          de: `Karussell: 1) Landschaft ${d.name} mit Titel 2–6) je eine Gefahr mit Lösung 7) Radar der Gefahrenkarte. Roter Balken, keine Emojis.`,
          ru: `Карусель: 1) пейзаж ${d.name} и заголовок 2–6) по одной опасности с решением 7) экран радара карты опасностей. Красная плашка, без эмодзи.`,
        }),
        shots: [],
        alt: T(lang, { tr: `${d.name} için tehlike listesi kartı`, en: `Hazard list card for ${d.name}`, de: `Gefahrenkarte für ${d.name}`, ru: `Карточка опасностей: ${d.name}` }),
      },
      sources: d.sources ?? [],
      translationNotes: localized.unmapped,
      subject: { kind: 'destination', slug: d.slug, name: d.name, country: d.countryCode },
    };
  },
};

/* ------------------------------------------------------------------ */
/* 4 · Patikanın yanındaki tarih                                         */
/* ------------------------------------------------------------------ */

const heritageDetour = {
  id: 'heritage-detour',
  label: 'Patikanın yanındaki tarihi alan',
  needsSafetyNote: false,
  subjects: () => loadData().heritage,
  key: (h) => h.slug,
  build(h, lang) {
    const rules = localizeRules(h.rules ?? [], lang);
    const eras = (h.eras ?? []).map((e) => era(e, lang)).join(', ');
    const kindName = heritageKind(h.kind, lang);
    const summary = lang === 'tr'
      ? h.summary
      : T(lang, {
          en: `${h.name} is ${h.isUnesco ? 'a UNESCO World Heritage ' : 'a '}${kindName} in ${h.region}${eras ? ` (${eras})` : ''}, ${h.elevationM ? `at ${num(h.elevationM, 'en')} m, ` : ''}about ${h.visitDurationMin ?? 60} minutes to walk properly.`,
          de: `${h.name} ist ${h.isUnesco ? 'eine UNESCO-Welterbestätte, ' : ''}${kindName} in ${h.region}${eras ? ` (${eras})` : ''}${h.elevationM ? `, auf ${num(h.elevationM, 'de')} m` : ''}; für den Rundgang rechne mit ${h.visitDurationMin ?? 60} Minuten.`,
          ru: `${h.name} — ${kindName} в ${h.region}${eras ? ` (${eras})` : ''}${h.isUnesco ? ', объект всемирного наследия ЮНЕСКО' : ''}${h.elevationM ? `, ${num(h.elevationM, 'ru')} м` : ''}; на осмотр — около ${h.visitDurationMin ?? 60} минут.`,
        });
    const firstPara = lang === 'tr' ? (String(h.history ?? '').split('\n\n')[0] ?? h.summary) : summary;
    const months = monthRanges(h.bestMonths ?? [], lang);
    const fee = h.entryFeeTry ? `₺${num(h.entryFeeTry)}` : T(lang, { tr: 'ücretsiz', en: 'free', de: 'kostenlos', ru: 'бесплатно' });
    const hook = pick(`${h.slug}-heritage-${lang}`, T(lang, {
      tr: [
        `${h.region} patikasında yürüyenlerin çoğu ${h.name} alanını yalnızca uzaktan görüyor.`,
        `${h.name}: rotanın hemen yanında, çoğu yürüyüşçünün atladığı ${h.visitDurationMin ?? 60} dakika.`,
      ],
      en: [
        `Most people walking in ${h.region} only see ${h.name} from a distance.`,
        `${h.name}: right next to the trail, and the ${h.visitDurationMin ?? 60} minutes most hikers skip.`,
      ],
      de: [
        `Die meisten, die in ${h.region} unterwegs sind, sehen ${h.name} nur aus der Ferne.`,
        `${h.name}: direkt am Weg — und die ${h.visitDurationMin ?? 60} Minuten, die fast alle auslassen.`,
      ],
      ru: [
        `Большинство идущих по ${h.region} видят ${h.name} только издалека.`,
        `${h.name}: прямо у тропы — и те ${h.visitDurationMin ?? 60} минут, которые почти все пропускают.`,
      ],
    }));
    const practical = T(lang, {
      tr: `Giriş ${fee}${h.openingHours ? `, saatler ${h.openingHours}` : ''}. En iyi dönem ${months}. Patika başı: ${h.nearestTrailhead ?? '—'}.`,
      en: `Entry ${fee}${h.openingHours ? `, hours ${h.openingHours}` : ''}. Best months: ${months}. Trailhead: ${h.nearestTrailhead ?? '—'}.`,
      de: `Eintritt ${fee}${h.openingHours ? `, Öffnung ${h.openingHours}` : ''}. Beste Zeit: ${months}. Einstieg: ${h.nearestTrailhead ?? '—'}.`,
      ru: `Вход ${fee}${h.openingHours ? `, часы ${h.openingHours}` : ''}. Лучшее время: ${months}. Начало тропы: ${h.nearestTrailhead ?? '—'}.`,
    });
    return {
      title: T(lang, {
        tr: `${h.name}: patikanın yanındaki ${h.isUnesco ? 'UNESCO' : 'tarihi'} alan`,
        en: `${h.name}: the ${h.isUnesco ? 'UNESCO' : 'historic'} site right beside the trail`,
        de: `${h.name}: die ${h.isUnesco ? 'UNESCO-' : 'historische '}Stätte direkt am Weg`,
        ru: `${h.name}: ${h.isUnesco ? 'объект UNESCO' : 'исторический памятник'} рядом с тропой`,
      }),
      hook,
      short: `${h.name} (${h.region}): ${summary}`,
      medium: j([hook, '', summary, '', practical]),
      long: j([
        hook,
        '',
        firstPara,
        '',
        practical,
        h.isUnesco ? T(lang, { tr: `UNESCO Dünya Mirası listesinde (${h.unescoYear}).`, en: `On the UNESCO World Heritage list since ${h.unescoYear}.`, de: `Seit ${h.unescoYear} UNESCO-Welterbe.`, ru: `В списке всемирного наследия ЮНЕСКО с ${h.unescoYear} года.` }) : '',
        rules.lines.length ? T(lang, { tr: '**Alan kuralları**', en: '**Site rules**', de: '**Regeln vor Ort**', ru: '**Правила на месте**' }) : '',
        ...rules.lines.map((r) => `- ${r}`),
      ]),
      keywords: [h.name, h.region, T(lang, { tr: 'tarihi alan', en: 'historic site', de: 'historische Stätte', ru: 'исторический объект' })],
      visual: {
        aspect: '4:5',
        brief: T(lang, {
          tr: `İki kare karşılaştırması: patikadan görünen manzara ↔ alanın içinden detay. Drone kullanma (${h.rules?.[0] ?? 'alan kuralları'}). Fotoğrafta insan varsa izin al.`,
          en: `Two-frame comparison: the view from the trail ↔ a detail inside the site. No drone (${h.rules?.[0] ?? 'site rules'}). Get consent for recognisable people.`,
          de: `Zwei Bilder: Blick vom Weg ↔ Detail innerhalb der Stätte. Keine Drohne (${h.rules?.[0] ?? 'Regeln vor Ort'}). Einwilligung bei erkennbaren Personen.`,
          ru: `Два кадра: вид с тропы ↔ деталь внутри объекта. Без дрона (${h.rules?.[0] ?? 'правила объекта'}). Согласие, если в кадре узнаваемые люди.`,
        }),
        shots: [],
        alt: T(lang, { tr: `${h.name} genel görünüm`, en: `General view of ${h.name}`, de: `Gesamtansicht ${h.name}`, ru: `Общий вид: ${h.name}` }),
      },
      sources: h.sources ?? [],
      translationNotes: rules.unmapped,
      subject: { kind: 'heritage', slug: h.slug, name: h.name, country: h.countryCode },
    };
  },
};

/* ------------------------------------------------------------------ */
/* 5 · Kaya alanı rehberi                                                */
/* ------------------------------------------------------------------ */

const cragGuide = {
  id: 'crag-guide',
  label: 'Kaya alanı rehberi',
  needsSafetyNote: false,
  subjects: () => loadData().crags,
  key: (c) => c.slug,
  build(c, lang) {
    const grades = c.sectors?.flatMap((s) => s.routes.map((r) => r.grade)).filter(Boolean) ?? [];
    const uniqueGrades = [...new Set(grades)].sort();
    const season = monthRanges(c.seasons ?? [], lang);
    const stars = c.sectors?.flatMap((s) => s.routes.filter((r) => (r.stars ?? 0) >= 4).map((r) => `${r.name} ${r.grade}`)) ?? [];
    const rock = rockTypeName(c.rockType, lang);
    const overview = lang === 'tr'
      ? c.description
      : T(lang, {
          en: `${c.name} sits above ${c.locationName}: ${rock}, ${c.approachMin} minutes from the car, ${c.routeCount}+ routes across ${(c.sectors ?? []).length} sectors, ${(c.climbTypes ?? []).join(' and ')} climbing.`,
          de: `${c.name} liegt über ${c.locationName}: ${rock}, ${c.approachMin} Minuten vom Auto, ${c.routeCount}+ Routen in ${(c.sectors ?? []).length} Sektoren, ${(c.climbTypes ?? []).join(' und ')}.`,
          ru: `${c.name} над ${c.locationName}: ${rock}, ${c.approachMin} минут от машины, ${c.routeCount}+ маршрутов в ${(c.sectors ?? []).length} секторах, ${(c.climbTypes ?? []).join(', ')}.`,
        });
    const hook = pick(`${c.slug}-crag-${lang}`, T(lang, {
      tr: [
        `${c.name}: ${rockTypeName(c.rockType, 'tr')}, ${c.approachMin} dakika yaklaşım, sezon ${season}.`,
        `${c.name} alanında ilk gün nereden başlanır? Cevap sektör sırasında.`,
      ],
      en: [
        `${c.name}: ${rockTypeName(c.rockType, 'en')}, ${c.approachMin} min approach, season ${season}.`,
        `Where to start on your first day at ${c.name}? The answer is in the sector order.`,
      ],
      de: [
        `${c.name}: ${rockTypeName(c.rockType, 'de')}, ${c.approachMin} min Zustieg, Saison ${season}.`,
        `Womit am ersten Tag in ${c.name} anfangen? Die Antwort liegt in der Sektorenreihenfolge.`,
      ],
      ru: [
        `${c.name}: ${rockTypeName(c.rockType, 'ru')}, подход ${c.approachMin} мин, сезон ${season}.`,
        `С чего начать первый день в ${c.name}? Ответ — в порядке секторов.`,
      ],
    }));
    const sectorLines = (c.sectors ?? []).slice(0, 4).map(
      (s) => `${s.name}${s.orientation ? ` (${s.orientation})` : ''} — ${s.routes.length} ${T(lang, { tr: 'rota', en: 'routes', de: 'Routen', ru: 'маршрутов' })}: ${s.routes.slice(0, 3).map((r) => `${r.name} ${r.grade}`).join(', ')}`,
    );
    return {
      title: T(lang, {
        tr: `${c.name}: ${c.routeCount}+ rota, ${uniqueGrades[0] ?? ''}–${uniqueGrades.at(-1) ?? ''}, sezon ${season}`,
        en: `${c.name}: ${c.routeCount}+ routes, ${uniqueGrades[0] ?? ''}–${uniqueGrades.at(-1) ?? ''}, season ${season}`,
        de: `${c.name}: ${c.routeCount}+ Routen, ${uniqueGrades[0] ?? ''}–${uniqueGrades.at(-1) ?? ''}, Saison ${season}`,
        ru: `${c.name}: ${c.routeCount}+ маршрутов, ${uniqueGrades[0] ?? ''}–${uniqueGrades.at(-1) ?? ''}, сезон ${season}`,
      }),
      hook,
      short: T(lang, {
        tr: `${c.name} — ${c.locationName}. ${c.approachMin} dk yaklaşım, ${uniqueGrades.length} farklı derece, sezon ${season}.`,
        en: `${c.name} — ${c.locationName}. ${c.approachMin} min approach, ${uniqueGrades.length} grades, season ${season}.`,
        de: `${c.name} — ${c.locationName}. ${c.approachMin} min Zustieg, ${uniqueGrades.length} Schwierigkeiten, Saison ${season}.`,
        ru: `${c.name} — ${c.locationName}. Подход ${c.approachMin} мин, ${uniqueGrades.length} категорий, сезон ${season}.`,
      }),
      medium: j([hook, '', ...sectorLines, '', stars.length ? T(lang, { tr: `Klasikler: ${stars.slice(0, 4).join(', ')}.`, en: `Classics: ${stars.slice(0, 4).join(', ')}.`, de: `Klassiker: ${stars.slice(0, 4).join(', ')}.`, ru: `Классика: ${stars.slice(0, 4).join(', ')}.` }) : '']),
      long: j([
        hook,
        '',
        overview,
        '',
        T(lang, { tr: '**Sektörler**', en: '**Sectors**', de: '**Sektoren**', ru: '**Секторы**' }),
        ...(c.sectors ?? []).map(
          (s) => `- ${s.name}${s.orientation ? ` (${s.orientation})` : ''}: ${s.routes.map((r) => `${r.name} ${r.grade}${r.lengthM ? ` · ${r.lengthM} m` : ''}`).join(' · ')}`,
        ),
        '',
        T(lang, {
          tr: `Uygulamadaki derece dönüştürücü Fransız / YDS / UIAA / Font / V sistemleri arasında çevirir; çıkışlarını logbook’a işaretleyip derece piramidini görebilirsin.`,
          en: `The in-app grade converter maps French / YDS / UIAA / Font / V; log your ascents and the grade pyramid builds itself.`,
          de: `Der Grad-Umrechner in der App verbindet Französisch / YDS / UIAA / Font / V; trag deine Begehungen ein, die Gradpyramide entsteht automatisch.`,
          ru: `Конвертер категорий в приложении переводит французскую / YDS / UIAA / Font / V; отмечай пролазы — пирамида строится сама.`,
        }),
      ]),
      keywords: [c.name, T(lang, { tr: 'tırmanış', en: 'climbing', de: 'Klettern', ru: 'скалолазание' }), c.locationName],
      visual: {
        aspect: '4:5',
        brief: T(lang, {
          tr: `Topo kadrajı: duvarın geniş fotoğrafı üzerine sektör adları; ikinci kare tırmanıcı hareket hâlinde (ip ve emniyet görünür olsun). Üçüncü kare uygulamadaki rota listesi.`,
          en: `Topo framing: wide wall shot with sector names overlaid; second frame a climber mid-move (rope and belay visible). Third frame: the route list in the app.`,
          de: `Topo-Ansicht: Weitwinkel der Wand mit Sektornamen; zweites Bild Kletterer in Bewegung (Seil und Sicherung sichtbar). Drittes Bild: Routenliste in der App.`,
          ru: `Топо-кадр: широкий вид стены с подписями секторов; второй кадр — лазающий в движении (видны верёвка и страховка). Третий — список маршрутов в приложении.`,
        }),
        shots: [],
        alt: T(lang, { tr: `${c.name} tırmanış duvarı`, en: `Climbing wall at ${c.name}`, de: `Kletterwand ${c.name}`, ru: `Скальная стена: ${c.name}` }),
      },
      sources: [`Zirtan tırmanış veritabanı · ${c.locationName}`],
      subject: { kind: 'crag', slug: c.slug, name: c.name, country: c.countryCode },
    };
  },
};

/* ------------------------------------------------------------------ */
/* 6 · Bu ay nereye? (mevsim penceresi)                                  */
/* ------------------------------------------------------------------ */

const seasonWindow = {
  id: 'season-window',
  label: 'Bu ay nereye',
  needsSafetyNote: false,
  subjects: () => Array.from({ length: 12 }, (_, i) => ({ month: i + 1 })),
  key: (m) => `month-${m.month}`,
  build(m, lang) {
    const month = m.month;
    const dests = destinationsInMonth(month).slice(0, 6);
    const crags = cragsInMonth(month).slice(0, 3);
    const risky = riskySpeciesInMonth(month).slice(0, 2);
    const name = monthName(month, lang);
    const hook = pick(`month-${month}-${lang}`, T(lang, {
      tr: [`${name} ayında sezonu açık olan rotalar — kütüphaneden süzülmüş hâli:`, `${name}: hangi rota açık, hangi kaya alanı çalışır?`],
      en: [`Routes whose season is open in ${name} — filtered from the library:`, `${name}: which trails are in season and which crags actually work?`],
      de: [`Routen mit offener Saison im ${name} — aus der Bibliothek gefiltert:`, `${name}: welche Wege sind in Saison, welche Felsen funktionieren?`],
      ru: [`Маршруты, у которых открыт сезон в ${name}е — выборка из библиотеки:`, `${name}: какие тропы в сезоне и какие скалы работают?`],
    }));
    return {
      title: T(lang, {
        tr: `${name} ayında nereye? ${dests.length} rota, ${crags.length} kaya alanı`,
        en: `Where to go in ${name}: ${dests.length} routes, ${crags.length} crags`,
        de: `Wohin im ${name}? ${dests.length} Routen, ${crags.length} Klettergebiete`,
        ru: `Куда в ${name}е: ${dests.length} маршрутов, ${crags.length} скальных района`,
      }),
      hook,
      short: T(lang, {
        tr: `${name}: ${dests.slice(0, 3).map((d) => d.name).join(', ')}. Sezonu açık tam liste kütüphanede.`,
        en: `${name}: ${dests.slice(0, 3).map((d) => d.name).join(', ')}. Full in-season list is in the library.`,
        de: `${name}: ${dests.slice(0, 3).map((d) => d.name).join(', ')}. Die ganze Liste steht in der Bibliothek.`,
        ru: `${name}: ${dests.slice(0, 3).map((d) => d.name).join(', ')}. Полный список — в библиотеке.`,
      }),
      medium: j([
        hook,
        '',
        ...dests.map((d) => `- ${d.name} (${d.region}) — ${d.typicalDays ?? '?'} ${T(lang, LABEL.days)}, ${dif(d.difficulty, lang)}`),
        crags.length ? '' : '',
        ...crags.map((c) => `- ${c.name} — ${rockTypeName(c.rockType, lang)}, ${c.approachMin} ${T(lang, { tr: 'dk yaklaşım', en: 'min approach', de: 'min Zustieg', ru: 'мин подхода' })}`),
        risky.length
          ? T(lang, {
              tr: `\nBu ay aktif: ${risky.map((s) => s.commonName).join(', ')} — ilk yardım rehberleri çevrimdışı hazır.`,
              en: `\nActive this month: ${risky.map((s) => s.scientificName).join(', ')} — the first-aid guides work offline.`,
              de: `\nDiesen Monat aktiv: ${risky.map((s) => s.scientificName).join(', ')} — die Erste-Hilfe-Leitfäden funktionieren offline.`,
              ru: `\nВ этом месяце активны: ${risky.map((s) => s.scientificName).join(', ')} — инструкции первой помощи доступны офлайн.`,
            })
          : '',
      ]),
      long: j([
        hook,
        '',
        ...dests.map(
          (d) =>
            `**${d.name}** (${d.region}) — ${d.typicalDays ?? '?'} ${T(lang, LABEL.days)}, ${Math.round(d.totalDistanceKm ?? 0)} km, ${dif(d.difficulty, lang)}${lang === 'tr' ? `. ${d.summary}` : `, ${T(lang, { en: 'high point', de: 'höchster Punkt', ru: 'верх' })} ${num(d.maxElevationM, lang)} m.`}`,
        ),
        '',
        ...crags.map((c) => `**${c.name}** — ${c.locationName}, ${c.routeCount}+ ${T(lang, { tr: 'rota', en: 'routes', de: 'Routen', ru: 'маршрутов' })}, ${rockTypeName(c.rockType, lang)}.`),
      ]),
      keywords: [name, T(lang, { tr: 'sezon', en: 'season', de: 'Saison', ru: 'сезон' })],
      visual: {
        aspect: '4:5',
        brief: T(lang, {
          tr: `Karusel: kapak "${name} ayında nereye?" + harita; her karede bir rota (fotoğraf + km/gün/zorluk şeridi). Son kare kütüphane ekranı.`,
          en: `Carousel: cover "Where to go in ${name}" + map; one route per card (photo + km/days/difficulty strip). Last card: library screen.`,
          de: `Karussell: Cover „Wohin im ${name}?“ + Karte; pro Karte eine Route (Foto + km/Tage/Schwierigkeit). Letzte Karte: Bibliothek.`,
          ru: `Карусель: обложка «Куда в ${name}е» + карта; по маршруту на карточку (фото + км/дни/сложность). Последняя карточка — экран библиотеки.`,
        }),
        shots: [],
        alt: T(lang, { tr: `${name} ayı rota listesi`, en: `Route list for ${name}`, de: `Routenliste für ${name}`, ru: `Список маршрутов на ${name}` }),
      },
      sources: ['Zirtan kütüphanesi · sezon verisi (destinasyon `bestMonths`)'],
      subject: { kind: 'season', slug: `ay-${month}`, name, month },
    };
  },
};

/* ------------------------------------------------------------------ */
/* 7 · Bütçe ve izin                                                     */
/* ------------------------------------------------------------------ */

const budgetPermit = {
  id: 'budget-permit',
  label: 'Bütçe ve izin',
  needsSafetyNote: false,
  subjects: () => loadData().destinations.filter((d) => d.budgetTry || (d.permits ?? []).length > 0),
  key: (d) => `${d.slug}-budget`,
  build(d, lang) {
    const permits = d.permits ?? [];
    const transports = (d.transports ?? []).slice(0, 3);
    const b = d.budgetTry ?? { low: 0, high: 0 };
    const hook = pick(`${d.slug}-budget-${lang}`, T(lang, {
      tr: [`${d.name} ne kadar tutar? Uydurma değil, kalem kalem:`, `${d.name} için "yeterli para" ne demek? Rakamlar şöyle:`],
      en: [`What does ${d.name} actually cost? Line by line:`, `“Enough money” for ${d.name} — here are the numbers:`],
      de: [`Was kostet ${d.name} wirklich? Posten für Posten:`, `„Genug Geld“ für ${d.name} — hier sind die Zahlen:`],
      ru: [`Сколько на самом деле стоит ${d.name}? По пунктам:`, `Сколько денег хватит на ${d.name}? Вот цифры:`],
    }));
    const lines = [
      ...permits.map((p) => `- ${p.name}: ₺${num(p.costTry, lang)}${lang === 'tr' ? ` — ${p.where}${p.note ? ` (${p.note})` : ''}` : ''}`),
      ...transports.map((t) => `- ${t.mode}: ${t.from} → ${t.to}, ${duration(t.durationMin, lang)}, ₺${num(t.costTry, lang)}`),
    ];
    return {
      title: T(lang, {
        tr: `${d.name} bütçesi: izin, ulaşım, günlük gider`,
        en: `${d.name} budget: permits, transport, daily spend`,
        de: `${d.name} Budget: Genehmigungen, Anreise, Tagesausgaben`,
        ru: `Бюджет ${d.name}: пермиты, дорога, расходы в день`,
      }),
      hook,
      short: T(lang, {
        tr: `${d.name}: toplam ₺${num(b.low)}–${num(b.high)}. ${permits.length ? `İzin: ${permits.map((p) => p.name).join(' + ')}.` : ''}`,
        en: `${d.name}: ₺${num(b.low, 'en')}–${num(b.high, 'en')} all in.${permits.length ? ` Permits: ${permits.map((p) => p.name).join(' + ')}.` : ''}`,
        de: `${d.name}: ₺${num(b.low, 'de')}–${num(b.high, 'de')} gesamt.${permits.length ? ` Genehmigungen: ${permits.map((p) => p.name).join(' + ')}.` : ''}`,
        ru: `${d.name}: ₺${num(b.low, 'ru')}–${num(b.high, 'ru')} всего.${permits.length ? ` Пермиты: ${permits.map((p) => p.name).join(' + ')}.` : ''}`,
      }),
      medium: j([hook, '', ...lines, '', T(lang, {
        tr: `Toplam: ₺${num(b.low)}–${num(b.high)} (kişi başı, ${d.typicalDays ?? '?'} gün).`,
        en: `Total: ₺${num(b.low, 'en')}–${num(b.high, 'en')} per person for ${d.typicalDays ?? '?'} days.`,
        de: `Gesamt: ₺${num(b.low, 'de')}–${num(b.high, 'de')} pro Person für ${d.typicalDays ?? '?'} Tage.`,
        ru: `Итого: ₺${num(b.low, 'ru')}–${num(b.high, 'ru')} на человека за ${d.typicalDays ?? '?'} дней.`,
      })]),
      long: j([hook, '', ...lines, '', d.insuranceRequired ? T(lang, {
        tr: 'Sigorta zorunlu: helikopter tahliyesini kapsayan poliçe olmadan izin/kurtarma süreci tıkanır.',
        en: 'Insurance is mandatory: without a policy covering helicopter evacuation the permit and rescue chain stalls.',
        de: 'Versicherung ist Pflicht: ohne Helikopter-Deckung stockt die Genehmigungs- und Rettungskette.',
        ru: 'Страховка обязательна: без покрытия эвакуации вертолётом всё встаёт.',
      }) : '', '', T(lang, {
        tr: 'Fiyatlar demo veriden gelir ve sezona göre değişir; güncel tutar için kaynak bağlantılarına bak.',
        en: 'Prices come from the demo dataset and shift by season; check the source links for current figures.',
        de: 'Preise stammen aus dem Demo-Datensatz und ändern sich saisonal; aktuelle Zahlen in den Quellen.',
        ru: 'Цены — из демо-данных и меняются по сезону; актуальные суммы смотри в источниках.',
      })]),
      keywords: [d.name, T(lang, { tr: 'bütçe', en: 'budget', de: 'Budget', ru: 'бюджет' }), T(lang, LABEL.permit)],
      visual: {
        aspect: '4:5',
        brief: T(lang, {
          tr: 'Tek görsel: kalem kalem tablo (izin / ulaşım / konaklama / yemek), toplam altta büyük. Sade tipografi, fotoğraf arka planda soluk.',
          en: 'Single graphic: itemised table (permit / transport / lodging / food) with the total large at the bottom. Clean type, faded photo behind.',
          de: 'Ein Bild: Aufstellung (Genehmigung / Anreise / Unterkunft / Essen), Summe groß unten. Klare Typo, Foto blass im Hintergrund.',
          ru: 'Одна графика: таблица по пунктам (пермит / дорога / ночлег / еда), итог крупно внизу. Чистая типографика, фото фоном.',
        }),
        shots: [],
        alt: T(lang, { tr: `${d.name} bütçe tablosu`, en: `${d.name} cost table`, de: `Kostentabelle ${d.name}`, ru: `Таблица расходов: ${d.name}` }),
      },
      sources: d.sources ?? [],
      subject: { kind: 'destination', slug: d.slug, name: d.name, country: d.countryCode },
    };
  },
};

/* ------------------------------------------------------------------ */
/* 8 · Rota kartı                                                        */
/* ------------------------------------------------------------------ */

const routeCard = {
  id: 'route-card',
  label: 'Rota kartı',
  needsSafetyNote: false,
  subjects: () => loadData().routes.filter((r) => r.distanceKm > 0),
  key: (r) => r.slug ?? r.id,
  build(r, lang) {
    const hook = pick(`${r.id}-route-${lang}`, T(lang, {
      tr: [`${r.name}: rakamlar önce, hikâye sonra.`, `${r.name} — ${r.distanceKm} km ve ${num(r.ascentM)} m tırmanış. Gerisi detay.`],
      en: [`${r.name}: numbers first, story later.`, `${r.name} — ${r.distanceKm} km and ${num(r.ascentM, 'en')} m of ascent. The rest is detail.`],
      de: [`${r.name}: erst die Zahlen, dann die Geschichte.`, `${r.name} — ${r.distanceKm} km und ${num(r.ascentM, 'de')} m Aufstieg. Der Rest ist Detail.`],
      ru: [`${r.name}: сначала цифры, потом история.`, `${r.name} — ${r.distanceKm} км и ${num(r.ascentM, 'ru')} м набора. Остальное — детали.`],
    }));
    const stats = T(lang, {
      tr: `${r.distanceKm} km · ${num(r.ascentM)} m tırmanış · ${duration(r.durationMin, 'tr')} · en yüksek ${num(r.maxElevationM)} m · ${dif(r.difficulty, 'tr')}`,
      en: `${r.distanceKm} km · ${num(r.ascentM, 'en')} m ascent · ${duration(r.durationMin, 'en')} · high point ${num(r.maxElevationM, 'en')} m · ${dif(r.difficulty, 'en')}`,
      de: `${r.distanceKm} km · ${num(r.ascentM, 'de')} m Aufstieg · ${duration(r.durationMin, 'de')} · Höchster Punkt ${num(r.maxElevationM, 'de')} m · ${dif(r.difficulty, 'de')}`,
      ru: `${r.distanceKm} км · ${num(r.ascentM, 'ru')} м набора · ${duration(r.durationMin, 'ru')} · верх ${num(r.maxElevationM, 'ru')} м · ${dif(r.difficulty, 'ru')}`,
    });
    return {
      title: T(lang, {
        tr: `${r.name}: ${r.distanceKm} km, ${num(r.ascentM)} m tırmanış`,
        en: `${r.name}: ${r.distanceKm} km, ${num(r.ascentM, 'en')} m ascent`,
        de: `${r.name}: ${r.distanceKm} km, ${num(r.ascentM, 'de')} m Aufstieg`,
        ru: `${r.name}: ${r.distanceKm} км, ${num(r.ascentM, 'ru')} м набора`,
      }),
      hook,
      short: `${r.name} (${r.locationName}) — ${stats}`,
      medium: j([hook, '', stats, '', T(lang, {
        tr: `GPX’i uygulamadan indir, çevrimdışı haritayı yükle, canlı konumu bir kişiyle paylaş. ${r.loop ? 'Rota halka; araç dönüşü sorun değil.' : 'Rota tek yön; dönüş ulaşımını önceden çöz.'}`,
        en: `Download the GPX in the app, load the offline map, share live location with one person. ${r.loop ? 'It is a loop, so the car stays where you left it.' : 'It is point-to-point — sort the return transport first.'}`,
        de: `GPX in der App laden, Offline-Karte herunterladen, Live-Standort mit einer Person teilen. ${r.loop ? 'Rundtour — das Auto bleibt am Start.' : 'Streckentour — klär den Rücktransport vorher.'}`,
        ru: `Скачай GPX в приложении, загрузи офлайн-карту, поделись координатами с одним человеком. ${r.loop ? 'Маршрут кольцевой — машина остаётся на старте.' : 'Маршрут линейный — заранее реши, как вернёшься.'}`,
      })]),
      long: j([hook, '', stats, '', T(lang, {
        tr: `GPX’i uygulamadan indir, çevrimdışı haritayı yükle, canlı konumu bir kişiyle paylaş. ${r.loop ? 'Rota halka; araç dönüşü sorun değil.' : 'Rota tek yön; dönüş ulaşımını önceden çöz.'}`,
        en: `Download the GPX in the app, load the offline map, share live location with one person. ${r.loop ? 'It is a loop, so the car stays where you left it.' : 'It is point-to-point — sort the return transport first.'}`,
        de: `GPX in der App laden, Offline-Karte herunterladen, Live-Standort mit einer Person teilen. ${r.loop ? 'Rundtour — das Auto bleibt am Start.' : 'Streckentour — klär den Rücktransport vorher.'}`,
        ru: `Скачай GPX в приложении, загрузи офлайн-карту, поделись координатами с одним человеком. ${r.loop ? 'Маршрут кольцевой — машина остаётся на старте.' : 'Маршрут линейный — заранее реши, как вернёшься.'}`,
      }), '', T(lang, {
        tr: `Etkinlik: ${activityName(r.activity, 'tr')}. Bölge: ${r.locationName}. GPX dosyası ve yükseklik profili uygulamada; tehlike bildirimleri aynı haritada görünür.`,
        en: `Activity: ${activityName(r.activity, 'en')}. Area: ${r.locationName}. The GPX and elevation profile are in the app; community hazard reports show on the same map.`,
        de: `Aktivität: ${activityName(r.activity, 'de')}. Gebiet: ${r.locationName}. GPX und Höhenprofil in der App; Gefahrenmeldungen auf derselben Karte.`,
        ru: `Активность: ${activityName(r.activity, 'ru')}. Район: ${r.locationName}. GPX и профиль высот — в приложении; отметки опасностей на той же карте.`,
      })]),
      keywords: [r.name, r.locationName, `${r.distanceKm} km`],
      visual: {
        aspect: '9:16',
        brief: T(lang, {
          tr: 'Dikey kart: üstte rota adı, ortada yükseklik profili grafiği, altta km / tırmanış / süre şeridi. Arkada rotanın gerçek fotoğrafı.',
          en: 'Vertical card: route name on top, elevation chart in the middle, km / ascent / time strip at the bottom over a real photo of the trail.',
          de: 'Hochformat: Name oben, Höhenprofil in der Mitte, km / Aufstieg / Zeit unten über einem echten Foto.',
          ru: 'Вертикальная карточка: название сверху, профиль высот по центру, км / набор / время внизу поверх реального фото.',
        }),
        shots: [],
        alt: T(lang, { tr: `${r.name} yükseklik profili`, en: `Elevation profile of ${r.name}`, de: `Höhenprofil ${r.name}`, ru: `Профиль высот: ${r.name}` }),
      },
      sources: ['Zirtan rota motoru · topluluk izleri', attribution(lang)],
      subject: { kind: 'route', slug: r.slug ?? r.id, name: r.name, country: r.countryCode },
    };
  },
};

/* ------------------------------------------------------------------ */
/* 9 · Kulüp çağrısı                                                     */
/* ------------------------------------------------------------------ */

const clubCall = {
  id: 'club-call',
  label: 'Üniversite kulübü çağrısı',
  needsSafetyNote: false,
  subjects: () => clubsByCountry('TR'),
  key: (c) => slugify(c.name),
  build(c, lang) {
    const age = new Date().getUTCFullYear() - (c.foundedYear ?? 2000);
    const hook = pick(`${c.id}-club-${lang}`, T(lang, {
      tr: [
        `${c.university}: ${age} yıllık bir kulübün etkinlik duyurusu hâlâ üç ayrı WhatsApp grubunda dolaşıyor.`,
        `${c.name} — ${num(c.memberCount)} üye, tek yerde toplanmış bir dönem programı.`,
      ],
      en: [
        `${c.university}: a ${age}-year-old club still announcing trips across three WhatsApp groups.`,
        `${c.name} — ${num(c.memberCount, 'en')} members and one place for the whole term’s plan.`,
      ],
      de: [
        `${c.university}: ein ${age} Jahre alter Verein, dessen Touren noch immer in drei WhatsApp-Gruppen angekündigt werden.`,
        `${c.name} — ${num(c.memberCount, 'de')} Mitglieder und ein Ort für das ganze Semesterprogramm.`,
      ],
      ru: [
        `${c.university}: клубу ${age} лет, а анонсы выходов до сих пор в трёх чатах.`,
        `${c.name} — ${num(c.memberCount, 'ru')} участников и одна страница на весь семестр.`,
      ],
    }));
    const activities = (c.adventureTypes ?? []).map((a) => activityName(a, lang)).join(', ');
    const about = lang === 'tr'
      ? c.description
      : T(lang, {
          en: `${c.name} (${c.city}, founded ${c.foundedYear}) runs ${activities} for ${num(c.memberCount, 'en')} members.`,
          de: `${c.name} (${c.city}, gegründet ${c.foundedYear}) organisiert ${activities} für ${num(c.memberCount, 'de')} Mitglieder.`,
          ru: `${c.name} (${c.city}, основан в ${c.foundedYear}) — ${activities} для ${num(c.memberCount, 'ru')} участников.`,
        });
    const offer = T(lang, {
      tr: 'Kulüp paketi ücretsiz: kulüp profili, etkinlik + RSVP, .edu ile öğrenci doğrulama, kulüp ligi ve üyelere 1 ay Pro.',
      en: 'The club pack is free: club profile, events with RSVP, .edu student verification, the club league and one month of Pro for members.',
      de: 'Das Vereinspaket ist kostenlos: Profil, Touren mit RSVP, .edu-Verifizierung, Vereinsliga und ein Monat Pro für Mitglieder.',
      ru: 'Пакет для клуба бесплатный: профиль, события с RSVP, .edu-подтверждение, лига клубов и месяц Pro участникам.',
    });
    return {
      title: T(lang, {
        tr: `${c.university} · ${c.name}: dönem programı tek yerde`,
        en: `${c.university} · ${c.name}: the whole term in one place`,
        de: `${c.university} · ${c.name}: das Semesterprogramm an einem Ort`,
        ru: `${c.university} · ${c.name}: весь семестр в одном месте`,
      }),
      hook,
      short: T(lang, {
        tr: `${c.university} kulübü için: etkinlik + RSVP + .edu doğrulama, ücretsiz.`,
        en: `For the ${c.university} club: events + RSVP + .edu verification, free.`,
        de: `Für die Gruppe der ${c.university}: Touren + RSVP + .edu-Verifizierung, kostenlos.`,
        ru: `Для клуба ${c.university}: события + RSVP + .edu-подтверждение, бесплатно.`,
      }),
      medium: j([hook, '', about, '', offer]),
      long: j([hook, '', about, '', offer, '', T(lang, {
        tr: 'Karşılığında beklediğimiz tek şey: dönem içinde bir ortak gönderi ve gezi sonrası fotoğraflar (izinle).',
        en: 'All we ask in return: one collab post during the term and photos after the trip (with permission).',
        de: 'Als Gegenleistung: ein gemeinsamer Beitrag im Semester und Fotos nach der Tour (mit Einwilligung).',
        ru: 'Взамен просим одно: совместный пост за семестр и фото после выхода (с разрешения).',
      })]),
      keywords: [c.university, T(lang, { tr: 'doğa sporları kulübü', en: 'outdoor club', de: 'Hochschulgruppe', ru: 'турклуб' })],
      visual: {
        aspect: '4:5',
        brief: T(lang, {
          tr: `Kulüp arşivinden bir gezi fotoğrafı (izinle) + uygulamadaki etkinlik/RSVP ekranı yan yana. Kulüp logosu yalnızca kulüp onayıyla.`,
          en: `A trip photo from the club archive (with permission) next to the event/RSVP screen. Club logo only with the club’s approval.`,
          de: `Ein Tourenfoto aus dem Vereinsarchiv (mit Erlaubnis) neben dem Event-/RSVP-Screen. Vereinslogo nur mit Zustimmung.`,
          ru: `Фото из архива клуба (с разрешения) рядом с экраном события и RSVP. Логотип клуба — только с согласия.`,
        }),
        shots: [],
        alt: T(lang, { tr: `${c.name} etkinlik duyurusu`, en: `${c.name} event announcement`, de: `${c.name} Tourenankündigung`, ru: `${c.name}: анонс события` }),
      },
      sources: [`Zirtan kulüp dizini · ${c.city}`],
      subject: { kind: 'club', slug: slugify(c.name), name: c.name, country: c.countryCode },
    };
  },
};

/* ------------------------------------------------------------------ */
/* 10 · Yer kartı (kamp, kaynak, sığınak)                                */
/* ------------------------------------------------------------------ */

const KIND_LABEL = {
  campsite: { tr: 'kamp alanı', en: 'campsite', de: 'Zeltplatz', ru: 'кемпинг' },
  shelter: { tr: 'sığınak / dağ evi', en: 'shelter / hut', de: 'Schutzhütte', ru: 'приют' },
  peak: { tr: 'zirve', en: 'summit', de: 'Gipfel', ru: 'вершина' },
  cave: { tr: 'mağara', en: 'cave', de: 'Höhle', ru: 'пещера' },
  climbing: { tr: 'tırmanış alanı', en: 'crag', de: 'Klettergebiet', ru: 'скальный сектор' },
  diving: { tr: 'dalış noktası', en: 'dive site', de: 'Tauchplatz', ru: 'дайв-сайт' },
};

const placeCard = {
  id: 'place-card',
  label: 'Yer kartı (kütüphane)',
  needsSafetyNote: false,
  subjects: () => [...placesOfKind('campsite'), ...placesOfKind('shelter'), ...placesOfKind('peak')],
  key: (p) => p.slug ?? p.id,
  build(p, lang) {
    const kind = T(lang, KIND_LABEL[p.kind] ?? { tr: p.kind, en: p.kind, de: p.kind, ru: p.kind });
    const tags = p.tags ?? {};
    const facts = [
      tags.fee ? T(lang, { tr: `ücret: ${tags.fee === 'yes' ? 'var' : 'yok'}`, en: `fee: ${tags.fee}`, de: `Gebühr: ${tags.fee}`, ru: `плата: ${tags.fee === 'yes' ? 'есть' : 'нет'}` }) : '',
      tags.drinking_water ? T(lang, { tr: `içme suyu: ${tags.drinking_water === 'yes' ? 'var' : 'yok'}`, en: `drinking water: ${tags.drinking_water}`, de: `Trinkwasser: ${tags.drinking_water}`, ru: `питьевая вода: ${tags.drinking_water === 'yes' ? 'есть' : 'нет'}` }) : '',
      tags.shower ? T(lang, { tr: `duş: ${tags.shower === 'yes' ? 'var' : 'yok'}`, en: `shower: ${tags.shower}`, de: `Dusche: ${tags.shower}`, ru: `душ: ${tags.shower === 'yes' ? 'есть' : 'нет'}` }) : '',
      p.elevationM ? `${num(p.elevationM, lang)} m` : '',
    ].filter(Boolean);
    const hook = pick(`${p.id}-place-${lang}`, T(lang, {
      tr: [`${p.name}: ${kind}, ${facts.slice(0, 2).join(', ')}.`, `${p.name} — kütüphaneden tek kart, gitmeden bilmen gerekenler.`],
      en: [`${p.name}: ${kind}, ${facts.slice(0, 2).join(', ')}.`, `${p.name} — one library card with what you need before you go.`],
      de: [`${p.name}: ${kind}, ${facts.slice(0, 2).join(', ')}.`, `${p.name} — eine Karte aus der Bibliothek mit dem Nötigsten.`],
      ru: [`${p.name}: ${kind}, ${facts.slice(0, 2).join(', ')}.`, `${p.name} — карточка из библиотеки с тем, что нужно знать заранее.`],
    }));
    return {
      title: T(lang, {
        tr: `${p.name}: ${kind} — su, ücret, yükseklik`,
        en: `${p.name}: ${kind} — water, fee, elevation`,
        de: `${p.name}: ${kind} — Wasser, Gebühr, Höhe`,
        ru: `${p.name}: ${kind} — вода, плата, высота`,
      }),
      hook,
      short: `${p.name} — ${kind}. ${facts.join(' · ')}`,
      medium: j([hook, '', lang === 'tr' ? (p.description ?? '') : '', facts.join(' · '), '', attribution(lang)]),
      long: j([hook, '', lang === 'tr' ? (p.description ?? '') : '', facts.join(' · '), '', T(lang, {
        tr: 'Bu kayıt açık veriden gelir; yanlış ya da eksikse uygulamadan düzeltme önerebilirsin.',
        en: 'This record comes from open data; if something is wrong you can suggest a fix from the app.',
        de: 'Dieser Eintrag stammt aus offenen Daten; Korrekturen kannst du in der App vorschlagen.',
        ru: 'Запись из открытых данных; если что-то не так, предложи правку прямо из приложения.',
      }), '', attribution(lang)]),
      keywords: [p.name, kind],
      visual: {
        aspect: '1:1',
        brief: T(lang, {
          tr: `Tek kare: yerin fotoğrafı + köşede bilgi rozetleri (su / ücret / yükseklik). Alt şeritte "${attribution('tr')}".`,
          en: `Single frame: photo of the place with info badges (water / fee / elevation) in the corner. Footer: "${attribution('en')}".`,
          de: `Ein Bild: Foto des Ortes mit Info-Badges (Wasser / Gebühr / Höhe). Fußzeile: „${attribution('de')}“.`,
          ru: `Один кадр: фото места с бейджами (вода / плата / высота). Внизу: «${attribution('ru')}».`,
        }),
        shots: [],
        alt: T(lang, { tr: `${p.name} genel görünüm`, en: `View of ${p.name}`, de: `Ansicht ${p.name}`, ru: `Вид: ${p.name}` }),
      },
      sources: [attribution(lang), p.license ?? 'ODbL-1.0'],
      subject: { kind: 'place', slug: p.slug ?? p.id, name: p.name, country: p.countryCode },
    };
  },
};

/* ------------------------------------------------------------------ */
/* 11 · UNESCO + rota birleşimi (SEO ağırlıklı uzun içerik)              */
/* ------------------------------------------------------------------ */

const unescoTrail = {
  id: 'unesco-trail',
  label: 'UNESCO alanı + rota birleşimi',
  needsSafetyNote: false,
  subjects: () => unescoSites().filter((h) => (h.adventureTypes ?? []).length > 0),
  key: (h) => `${h.slug}-trail`,
  build(h, lang) {
    const walking = routesOfActivity('hiking').filter((r) => r.countryCode === h.countryCode).slice(0, 3);
    const rules = localizeRules(h.rules ?? [], lang);
    const kindName = heritageKind(h.kind, lang);
    const summary = lang === 'tr'
      ? h.summary
      : T(lang, {
          en: `${h.name}: ${kindName} in ${h.region}, on the UNESCO list since ${h.unescoYear ?? '—'}; plan ${h.visitDurationMin ?? 90} minutes on site.`,
          de: `${h.name}: ${kindName} in ${h.region}, seit ${h.unescoYear ?? '—'} UNESCO-Welterbe; plane ${h.visitDurationMin ?? 90} Minuten vor Ort.`,
          ru: `${h.name}: ${kindName} в ${h.region}, в списке ЮНЕСКО с ${h.unescoYear ?? '—'}; на осмотр — ${h.visitDurationMin ?? 90} минут.`,
        });
    const hook = T(lang, {
      tr: `${h.name} listede bir satır değil; yanından geçen patikayla birlikte iki günlük bir plan.`,
      en: `${h.name} is more than a line on a list — with the trail beside it, it is a two-day plan.`,
      de: `${h.name} ist mehr als ein Listeneintrag — mit dem Weg daneben wird daraus ein Zwei-Tages-Plan.`,
      ru: `${h.name} — не строчка в списке: вместе с тропой рядом это план на два дня.`,
    });
    return {
      title: T(lang, {
        tr: `${h.name} + patika: iki günlük plan`,
        en: `${h.name} + the trail: a two-day plan`,
        de: `${h.name} + Weg: ein Zwei-Tages-Plan`,
        ru: `${h.name} + тропа: план на два дня`,
      }),
      hook,
      short: lang === 'tr' ? `${h.name} (${h.region}) — ${summary}` : summary,
      medium: j([hook, '', summary, '', walking.map((r) => `- ${r.name}: ${r.distanceKm} km, ${duration(r.durationMin, lang)}`).join('\n')]),
      long: j([
        hook,
        '',
        lang === 'tr' ? String(h.history ?? '').split('\n\n').slice(0, 2).join('\n\n') : summary,
        '',
        walking.map((r) => `- ${r.name}: ${r.distanceKm} km, ${duration(r.durationMin, lang)}, ${dif(r.difficulty, lang)}`).join('\n'),
        '',
        rules.lines.map((r) => `- ${r}`).join('\n'),
      ]),
      keywords: [h.name, 'UNESCO', h.region],
      visual: {
        aspect: '16:9',
        brief: T(lang, {
          tr: 'YouTube küçük resmi: alanın simge yapısı solda, patika sağda; 4 kelimelik başlık. Videoda drone yok (alan kuralları).',
          en: 'YouTube thumbnail: the landmark on the left, the trail on the right; four-word title. No drone footage (site rules).',
          de: 'YouTube-Thumbnail: das Bauwerk links, der Weg rechts; Titel mit vier Wörtern. Keine Drohne (Regeln vor Ort).',
          ru: 'Обложка YouTube: памятник слева, тропа справа; заголовок из четырёх слов. Без дрона (правила объекта).',
        }),
        shots: [],
        alt: T(lang, { tr: `${h.name} ve çevresindeki patika`, en: `${h.name} and the trail around it`, de: `${h.name} und der Weg drumherum`, ru: `${h.name} и тропа вокруг` }),
      },
      sources: h.sources ?? [],
      translationNotes: rules.unmapped,
      subject: { kind: 'heritage', slug: h.slug, name: h.name, country: h.countryCode },
    };
  },
};

export const ARCHETYPES = [
  itinerary,
  first10,
  hazardBrief,
  heritageDetour,
  cragGuide,
  seasonWindow,
  budgetPermit,
  routeCard,
  clubCall,
  placeCard,
  unescoTrail,
];

export const ARCHETYPE_IDS = ARCHETYPES.map((a) => a.id);

export function getArchetype(id) {
  const a = ARCHETYPES.find((x) => x.id === id);
  if (!a) throw new Error(`Bilinmeyen arketip: ${id}. Geçerli: ${ARCHETYPE_IDS.join(', ')}`);
  return a;
}
