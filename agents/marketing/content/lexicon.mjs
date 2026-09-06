/**
 * Yerelleştirme sözlüğü.
 *
 * Kütüphane verisi Türkçe yazılmıştır (risk cümleleri, alan kuralları, ilk yardım adımları).
 * Türkçe dışındaki içerikte bu cümleleri **olduğu gibi kullanmak yerine** burada yazılmış
 * karşılıklarını kullanırız: veriden yalnızca kategori/olgu okunur, cümle bu dosyadan gelir.
 * Böylece EN/DE/RU çıktı gerçekten o dilde olur, çeviri kokmaz ve yanlış bilgi taşımaz.
 *
 * Eşleşmeyen bir Türkçe cümle çıktıda **yer almaz**; motor bunu `translationNotes` ile bildirir.
 */

/* ------------------------------------------------------------------ */
/* Tür grubuna göre ilk yardım (standart, kaynaklı bilgi)               */
/* ------------------------------------------------------------------ */

export const FIRST_AID_BY_GROUP = {
  snake: {
    en: {
      do: [
        'Back off at least two metres and let the snake leave; most bites happen while trying to handle it.',
        'Keep the bitten limb still and at heart level, and stay as calm as you can.',
        'Take off rings and watches before the swelling starts; mark the edge of the swelling and note the time.',
        'Call the emergency number and get to a hospital — antivenom exists nowhere else.',
      ],
      dont: [
        'Do not cut, suck or squeeze the wound, and never use a tourniquet or ice.',
        'Do not try to catch, photograph up close or kill the snake.',
        'No alcohol, no caffeine, no aspirin or ibuprofen.',
      ],
    },
    de: {
      do: [
        'Geh mindestens zwei Meter zurück und lass die Schlange abziehen; die meisten Bisse passieren beim Hantieren.',
        'Halte die gebissene Extremität ruhig und auf Herzhöhe, bleib so ruhig wie möglich.',
        'Ringe und Uhren vor der Schwellung abnehmen; Schwellungsrand markieren und Uhrzeit notieren.',
        'Notruf wählen und ins Krankenhaus — Antivenin gibt es nur dort.',
      ],
      dont: [
        'Wunde nicht schneiden, aussaugen oder ausdrücken; kein Abbinden, kein Eis.',
        'Die Schlange nicht fangen, aus der Nähe fotografieren oder töten.',
        'Kein Alkohol, kein Koffein, kein Aspirin oder Ibuprofen.',
      ],
    },
    ru: {
      do: [
        'Отойди минимум на два метра и дай змее уйти: большинство укусов случается при попытке её тронуть.',
        'Держи укушенную конечность неподвижно на уровне сердца и постарайся не паниковать.',
        'Сними кольца и часы до отёка, отметь границу отёка и запиши время укуса.',
        'Звони в экстренную службу и в больницу — сыворотка есть только там.',
      ],
      dont: [
        'Не режь, не отсасывай и не выдавливай рану; никаких жгутов и льда.',
        'Не пытайся поймать, снять вблизи или убить змею.',
        'Никакого алкоголя, кофеина, аспирина и ибупрофена.',
      ],
    },
  },
  arachnid: {
    en: {
      do: [
        'Wash the site with soap and water and keep the limb still.',
        'Cold pack wrapped in cloth, 10 minutes on, 10 minutes off.',
        'For a tick: grip it at the skin with fine tweezers and pull straight out, then disinfect.',
        'Watch for fever, spreading pain or muscle cramps over the next two weeks and seek help early.',
      ],
      dont: [
        'Do not crush or twist a tick, and do not smother it with oil, alcohol or a flame.',
        'Do not cut or suck the wound.',
        'Do not wait it out if breathing, vision or muscle control changes.',
      ],
    },
    de: {
      do: [
        'Stelle mit Wasser und Seife reinigen, Extremität ruhig halten.',
        'Kühlpack im Tuch, 10 Minuten kühlen, 10 Minuten Pause.',
        'Zecke mit feiner Pinzette hautnah fassen und gerade herausziehen, dann desinfizieren.',
        'Zwei Wochen auf Fieber, wandernde Schmerzen oder Muskelkrämpfe achten und früh Hilfe holen.',
      ],
      dont: [
        'Zecke nicht quetschen oder drehen, nicht mit Öl, Alkohol oder Feuer behandeln.',
        'Wunde nicht schneiden oder aussaugen.',
        'Bei Atem-, Seh- oder Muskelproblemen nicht abwarten.',
      ],
    },
    ru: {
      do: [
        'Промой место укуса водой с мылом и держи конечность неподвижно.',
        'Холод через ткань: 10 минут держать, 10 минут перерыв.',
        'Клеща захвати тонким пинцетом у самой кожи и вытяни прямо, затем обработай ранку.',
        'Две недели следи за температурой, распространяющейся болью и судорогами — при них сразу к врачу.',
      ],
      dont: [
        'Не дави и не выкручивай клеща, не заливай маслом, спиртом и не прижигай.',
        'Не режь и не отсасывай рану.',
        'Не жди, если меняются дыхание, зрение или контроль над мышцами.',
      ],
    },
  },
  insect: {
    en: {
      do: [
        'Scrape the sting out sideways with a card instead of pulling it with fingers.',
        'Cool the area and keep it still; an antihistamine helps the itch.',
        'If the person carries an adrenaline auto-injector for allergy, use it at the first sign of a whole-body reaction.',
        'Call the emergency number for swelling of the face, lips or throat, or any breathing difficulty.',
      ],
      dont: [
        'Do not squeeze the venom sac — it pumps the rest in.',
        'Do not ignore hives spreading away from the sting.',
        'Do not treat a swollen mouth or throat at camp; that is an evacuation.',
      ],
    },
    de: {
      do: [
        'Stachel seitlich mit einer Karte abstreifen, nicht mit den Fingern ziehen.',
        'Kühlen und ruhig halten; ein Antihistaminikum lindert den Juckreiz.',
        'Bei bekannter Allergie das Adrenalin-Autoinjektor beim ersten Ganzkörperzeichen einsetzen.',
        'Notruf bei Schwellung von Gesicht, Lippen oder Hals und bei Atemnot.',
      ],
      dont: [
        'Giftblase nicht ausdrücken — sonst wird der Rest injiziert.',
        'Ausbreitende Quaddeln nicht ignorieren.',
        'Schwellung im Mund- oder Rachenraum nicht im Camp behandeln — das ist eine Evakuierung.',
      ],
    },
    ru: {
      do: [
        'Жало соскобли карточкой вбок, а не тяни пальцами.',
        'Охлади место и держи в покое; антигистаминное снимет зуд.',
        'При известной аллергии используй автоинжектор адреналина при первых общих симптомах.',
        'Звони в экстренную службу при отёке лица, губ, горла или затруднённом дыхании.',
      ],
      dont: [
        'Не сдавливай мешочек с ядом — остаток попадёт внутрь.',
        'Не игнорируй сыпь, расходящуюся от места укуса.',
        'Отёк во рту или горле не лечат в лагере — это эвакуация.',
      ],
    },
  },
  marine: {
    en: {
      do: [
        'Get out of the water before anything else; a second sting in deep water is the real danger.',
        'For a weeverfish or stonefish spine: immerse in hot water (about 45 °C, as hot as the hand tolerates) for 30–90 minutes.',
        'For jellyfish: rinse with seawater and lift tentacles off with tweezers or a card edge.',
        'Go to a clinic for spines left in the wound, growing pain, or any weakness.',
      ],
      dont: [
        'Do not rinse a jellyfish sting with fresh water and do not rub it with sand or a towel.',
        'Urine and alcohol do nothing except make it worse.',
        'Do not dive again the same day after a serious envenomation.',
      ],
    },
    de: {
      do: [
        'Zuerst aus dem Wasser: der zweite Stich im Tiefen ist die eigentliche Gefahr.',
        'Petermännchen- oder Steinfischstachel: 30–90 Minuten in heißes Wasser (ca. 45 °C, so heiß wie erträglich).',
        'Quallen: mit Meerwasser spülen, Tentakel mit Pinzette oder Kartenkante abheben.',
        'Zur Klinik bei steckengebliebenen Stacheln, zunehmendem Schmerz oder Schwäche.',
      ],
      dont: [
        'Quallenkontakt nicht mit Süßwasser spülen und nicht mit Sand oder Handtuch reiben.',
        'Urin und Alkohol helfen nicht, sie verschlimmern.',
        'Nach schwerer Vergiftung am selben Tag nicht wieder tauchen.',
      ],
    },
    ru: {
      do: [
        'Сначала выйди из воды: второй укол на глубине опаснее первого.',
        'Шип морского дракончика или бородавчатки: 30–90 минут в горячей воде (около 45 °C, насколько терпит рука).',
        'Медуза: промыть морской водой, щупальца снять пинцетом или краем карты.',
        'В клинику — если шип остался в ране, боль нарастает или появилась слабость.',
      ],
      dont: [
        'Не промывай ожог медузы пресной водой и не три песком или полотенцем.',
        'Моча и спирт не помогают, только хуже.',
        'После серьёзного отравления в тот же день не ныряй.',
      ],
    },
  },
  mammal: {
    en: {
      do: [
        'Stop, stay visible and speak in a low, steady voice so the animal knows what you are.',
        'Back away slowly on the path you came, keeping the animal in sight.',
        'Group up and make yourselves look large; pick up small children.',
        'Cook and store food away from the tent, and hang or lock it overnight.',
      ],
      dont: [
        'Do not run — running turns you into prey and you are slower than everything out here.',
        'Never get between a mother and her young, and never feed or bait wildlife for a photo.',
        'Do not corner an animal; always leave it an exit.',
      ],
    },
    de: {
      do: [
        'Stehen bleiben, sichtbar bleiben und ruhig und tief sprechen, damit das Tier dich einordnen kann.',
        'Langsam auf dem eigenen Weg zurückweichen, das Tier im Blick behalten.',
        'Zusammenrücken und groß wirken; kleine Kinder hochnehmen.',
        'Kochen und Essen abseits vom Zelt, nachts aufhängen oder einschließen.',
      ],
      dont: [
        'Nicht rennen — Rennen macht dich zur Beute, und du bist langsamer als alles hier.',
        'Nie zwischen Muttertier und Jungtier geraten, nie füttern oder für ein Foto anlocken.',
        'Das Tier nicht in die Enge treiben; lass ihm immer einen Ausweg.',
      ],
    },
    ru: {
      do: [
        'Остановись, оставайся на виду и говори низко и ровно — пусть зверь поймёт, кто ты.',
        'Медленно отходи по своему следу, не выпуская животное из вида.',
        'Соберитесь в группу и выглядите крупнее; маленьких детей возьмите на руки.',
        'Готовь и храни еду в стороне от палатки, на ночь подвешивай или запирай.',
      ],
      dont: [
        'Не беги — бег делает тебя добычей, а ты медленнее всех здесь.',
        'Никогда не вставай между самкой и детёнышем и не подкармливай зверя ради кадра.',
        'Не загоняй животное в угол — всегда оставляй ему выход.',
      ],
    },
  },
  plant: {
    en: {
      do: [
        'Wash the skin with plenty of cool water and soap within the first ten minutes.',
        'Take off and bag the clothing that touched the plant; the oil transfers for days.',
        'Cool compress for the itch; see a doctor if the rash spreads or reaches the eyes.',
        'If any part was eaten, call the emergency number and the poison centre and keep a sample.',
      ],
      dont: [
        'Do not scratch — you spread it and open the skin to infection.',
        'Do not use hot water, which opens the pores and makes it worse.',
        'Never burn the plant: the smoke carries the toxin into the lungs.',
      ],
    },
    de: {
      do: [
        'Haut in den ersten zehn Minuten mit viel kühlem Wasser und Seife waschen.',
        'Kleidung, die die Pflanze berührt hat, ausziehen und einpacken; das Öl haftet tagelang.',
        'Kühle Kompresse gegen den Juckreiz; zum Arzt, wenn der Ausschlag wandert oder die Augen erreicht.',
        'Bei Verzehr Notruf und Giftnotruf anrufen und eine Probe aufbewahren.',
      ],
      dont: [
        'Nicht kratzen — das verteilt den Stoff und öffnet die Haut.',
        'Kein heißes Wasser, es öffnet die Poren und verschlimmert alles.',
        'Die Pflanze niemals verbrennen: der Rauch trägt das Gift in die Lunge.',
      ],
    },
    ru: {
      do: [
        'В первые десять минут промой кожу большим количеством прохладной воды с мылом.',
        'Сними и убери в пакет одежду, коснувшуюся растения: масло держится днями.',
        'Холодный компресс от зуда; к врачу, если сыпь расползается или дошла до глаз.',
        'Если что-то съедено — звони в скорую и токсикологический центр, сохрани образец.',
      ],
      dont: [
        'Не чеши — так ты разносишь вещество и открываешь кожу для инфекции.',
        'Не мой горячей водой: поры раскрываются, становится хуже.',
        'Никогда не сжигай растение: дым несёт яд в лёгкие.',
      ],
    },
  },
  fungus: {
    en: {
      do: [
        'Call the emergency number and the poison centre immediately, even if the person feels fine.',
        'Keep a piece of the mushroom (or a clear photo) for identification.',
        'Note the exact time it was eaten and how much.',
        'Watch for symptoms that start 6–24 hours later — the dangerous species are the late ones.',
      ],
      dont: [
        'Do not wait for symptoms to pass; the quiet phase is part of the poisoning.',
        'Do not induce vomiting unless a doctor tells you to.',
        'Do not rely on folk tests (silver spoon, animals eating it) — none of them work.',
      ],
    },
    de: {
      do: [
        'Sofort Notruf und Giftnotruf anrufen, auch wenn es der Person gut geht.',
        'Ein Stück des Pilzes (oder ein scharfes Foto) zur Bestimmung aufbewahren.',
        'Uhrzeit und Menge des Verzehrs notieren.',
        'Auf Symptome nach 6–24 Stunden achten — die gefährlichen Arten wirken spät.',
      ],
      dont: [
        'Nicht abwarten, bis die Beschwerden vergehen; die ruhige Phase gehört zur Vergiftung.',
        'Kein Erbrechen auslösen ohne ärztliche Anweisung.',
        'Keine Hausmittel-Tests (Silberlöffel, „Tiere fressen es auch“) — sie funktionieren nicht.',
      ],
    },
    ru: {
      do: [
        'Сразу звони в скорую и в токсикологический центр, даже если человек чувствует себя нормально.',
        'Сохрани кусочек гриба (или чёткое фото) для определения.',
        'Запиши точное время и количество съеденного.',
        'Следи за симптомами через 6–24 часа — опасные виды действуют поздно.',
      ],
      dont: [
        'Не жди, пока «пройдёт»: тихая фаза — часть отравления.',
        'Не вызывай рвоту без указания врача.',
        'Не верь народным пробам (серебряная ложка, «звери едят») — они не работают.',
      ],
    },
  },
  bird: {
    en: {
      do: ['Keep your distance from the nest, especially in the breeding season.', 'Use a long lens instead of getting closer.', 'Leave the area if the bird starts circling and calling.'],
      dont: ['Do not climb to a nest for a photo.', 'Do not feed wild raptors.', 'Do not share the exact coordinates of a nest.'],
    },
    de: {
      do: ['Abstand zum Horst halten, besonders in der Brutzeit.', 'Lieber ein langes Objektiv als ein Schritt näher.', 'Weggehen, wenn der Vogel kreist und ruft.'],
      dont: ['Nicht zum Nest klettern für ein Foto.', 'Keine Greifvögel füttern.', 'Keine exakten Nestkoordinaten teilen.'],
    },
    ru: {
      do: ['Держи дистанцию от гнезда, особенно в сезон размножения.', 'Лучше длинный объектив, чем шаг ближе.', 'Уходи, если птица начала кружить и кричать.'],
      dont: ['Не лезь к гнезду ради кадра.', 'Не подкармливай хищных птиц.', 'Не публикуй точные координаты гнезда.'],
    },
  },
};

/* ------------------------------------------------------------------ */
/* Risk kategorileri (Türkçe risk cümlesi → kategori → yerel cümle)     */
/* ------------------------------------------------------------------ */

export const RISK_CATEGORIES = [
  {
    id: 'altitude',
    match: /irtifa|yükseklik|AMS|HAPE|HACE|akut dağ/iu,
    en: 'Altitude sickness: the usual cause of evacuation here — climb slowly, sleep low, descend at the first neurological sign.',
    de: 'Höhenkrankheit: der häufigste Evakuierungsgrund — langsam aufsteigen, tief schlafen, bei ersten neurologischen Zeichen absteigen.',
    ru: 'Горная болезнь: самая частая причина эвакуации — набирай медленно, спи ниже, при первых неврологических признаках вниз.',
  },
  {
    id: 'storm',
    match: /yıldırım|dolu|fırtına|rüzgâr|rüzgar|sis|beyaz-karanlık|hava kaynaklı|şimşek/iu,
    en: 'Afternoon storms and whiteout: be off the ridge by early afternoon and know your bail-out line.',
    de: 'Nachmittagsgewitter und Whiteout: sei am frühen Nachmittag vom Grat herunter und kenne deinen Notabstieg.',
    ru: 'Послеобеденные грозы и белая мгла: уходи с гребня до полудня-часа и держи в голове путь отхода.',
  },
  {
    id: 'cold',
    match: /soğuk|donma|hipotermi|buz|çığ|kar fırtınası|kar yamaç|-\d+\s?°C/iu,
    en: 'Cold, ice and avalanche terrain: check the forecast, carry a real insulation layer, and turn around on time.',
    de: 'Kälte, Eis und Lawinengelände: Lagebericht prüfen, echte Isolationsschicht mitnehmen, rechtzeitig umkehren.',
    ru: 'Холод, лёд и лавиноопасный рельеф: смотри прогноз, бери настоящий утеплитель и вовремя разворачивайся.',
  },
  {
    id: 'water',
    match: /sel|nehir|dere|geçiş|akıntı|dalga|su seviyesi|muson/iu,
    en: 'River crossings and flash floods: cross early in the day, unbuckle the hip belt, and never cross alone above the knee.',
    de: 'Flussquerungen und Sturzfluten: früh am Tag queren, Hüftgurt öffnen, oberhalb des Knies nie allein.',
    ru: 'Броды и паводки: переходи рано утром, расстегни поясной ремень, выше колена — не в одиночку.',
  },
  {
    id: 'terrain',
    match: /kaya düşmesi|taş|heyelan|düşme|kayma|dik|yamaç|basamak|serpantin|dar patika/iu,
    en: 'Rockfall and exposed steps: helmet where the guidebook says so, and keep distance in the fall line of the party above.',
    de: 'Steinschlag und ausgesetzte Stufen: Helm dort, wo der Führer es sagt, und Abstand in der Falllinie der Seilschaft über dir.',
    ru: 'Камнепад и открытые ступени: каска там, где советует описание, и не стой под идущими выше.',
  },
  {
    id: 'wildlife',
    match: /ayı|yılan|köpek|domuz|akrep|kene|sülük|hayvan|sıtma|böcek/iu,
    en: 'Wildlife and insect-borne illness: store food away from the tent, check for ticks daily, and know the first-aid steps before you need them.',
    de: 'Wildtiere und Insektenkrankheiten: Essen abseits vom Zelt lagern, täglich auf Zecken prüfen, Erste-Hilfe-Schritte vorher kennen.',
    ru: 'Дикие животные и укусы насекомых: еду храни вдали от палатки, каждый вечер проверяй на клещей, шаги первой помощи знай заранее.',
  },
  {
    id: 'navigation',
    match: /kaybol|yön|işaret|patika|iz kayb|labirent|rota bulma/iu,
    en: 'Navigation: waymarking fades in places — carry the offline map and a compass, and set a turnaround time.',
    de: 'Orientierung: die Markierung verblasst stellenweise — Offline-Karte und Kompass mitnehmen, Umkehrzeit festlegen.',
    ru: 'Ориентирование: маркировка местами стёрта — офлайн-карта, компас и заранее назначенное время разворота.',
  },
  {
    id: 'health',
    match: /enfeksiyon|mide|hijyen|su arıt|giardia|dehidrasyon|susuz|güneş|öksürük|sülük/iu,
    en: 'Stomach bugs and dehydration: treat all water, plan four litres a day in the heat, and do not share bottles.',
    de: 'Magen-Darm-Infekte und Dehydrierung: Wasser immer aufbereiten, in der Hitze vier Liter am Tag einplanen, Flaschen nicht teilen.',
    ru: 'Кишечные инфекции и обезвоживание: воду всегда обеззараживай, в жару планируй четыре литра в день, не пей из чужой бутылки.',
  },
  {
    id: 'logistics',
    match: /uçuş|iptal|tahliye|rehber kural|izin|kontrol nokta|yalnız yürüyüş|geri çevril|trafik|yol/iu,
    en: 'Logistics: flights, permits and guide rules can stop a trip cold — build two buffer days and carry the paperwork.',
    de: 'Logistik: Flüge, Genehmigungen und Guide-Regeln können alles stoppen — zwei Pufferbtage einplanen und Papiere mitführen.',
    ru: 'Логистика: рейсы, пермиты и правила по гидам могут сорвать план — заложи два запасных дня и вози документы.',
  },
];

/** Türkçe risk cümlesini kategoriye eşler (bulunamazsa null). */
export function riskCategory(text) {
  return RISK_CATEGORIES.find((c) => c.match.test(String(text))) ?? null;
}

/**
 * Türkçe risk listesini hedef dile çevirir: kategorileri bulur, tekrarları eler.
 * @returns {{ lines: string[], unmapped: string[] }}
 */
export function localizeRisks(risks, lang) {
  if (lang === 'tr') return { lines: [...risks], unmapped: [] };
  const seen = new Set();
  const out = [];
  const unmapped = [];
  for (const r of risks) {
    const cat = riskCategory(r);
    if (!cat) {
      unmapped.push(r);
      continue;
    }
    if (seen.has(cat.id)) continue;
    seen.add(cat.id);
    out.push(cat[lang] ?? cat.en);
  }
  return { lines: out, unmapped };
}

/* ------------------------------------------------------------------ */
/* Alan kuralları (tarihi alanlar)                                       */
/* ------------------------------------------------------------------ */

const RULE_MAP = [
  { match: /drone.*(yasak|izne)/iu, en: 'Drone flights are banned or need a permit.', de: 'Drohnenflüge sind verboten oder genehmigungspflichtig.', ru: 'Полёты дронов запрещены или требуют разрешения.' },
  { match: /dokun/iu, en: 'Do not touch the stone: columns, reliefs and statues are off limits.', de: 'Steine, Reliefs und Statuen nicht berühren.', ru: 'Не трогай камень: колонны, рельефы и статуи.' },
  { match: /(yürüyüş yolu|patika dışı|şerit|platform)/iu, en: 'Stay on the marked walkway; leaving it is prohibited.', de: 'Auf dem markierten Weg bleiben; Verlassen ist untersagt.', ru: 'Иди только по размеченной дорожке, сходить с неё нельзя.' },
  { match: /flaş/iu, en: 'Flash photography is restricted.', de: 'Blitzlicht ist eingeschränkt.', ru: 'Съёмка со вспышкой ограничена.' },
  { match: /(tırman|basamak.*çık)/iu, en: 'Climbing on the ruins, tombs or seating is not allowed.', de: 'Klettern auf Ruinen, Gräbern oder Sitzreihen ist verboten.', ru: 'Лазать по руинам, гробницам и рядам сидений нельзя.' },
  { match: /ateş/iu, en: 'No open fire anywhere on the site.', de: 'Offenes Feuer ist auf dem Gelände verboten.', ru: 'Открытый огонь на территории запрещён.' },
  { match: /(ayakkabı|kaygan)/iu, en: 'Sturdy shoes required — the surface is slippery.', de: 'Feste Schuhe nötig — der Untergrund ist rutschig.', ru: 'Нужна устойчивая обувь — поверхность скользкая.' },
  { match: /(profesyonel çekim|izin gerek)/iu, en: 'Professional shoots need written permission.', de: 'Professionelle Aufnahmen brauchen eine schriftliche Genehmigung.', ru: 'Профессиональная съёмка — только с письменным разрешением.' },
  { match: /(su|1,5 l)/iu, en: 'Carry your own water; there is none on site.', de: 'Eigenes Wasser mitnehmen; vor Ort gibt es keines.', ru: 'Бери воду с собой — на месте её нет.' },
];

export function localizeRules(rules, lang) {
  if (lang === 'tr') return { lines: [...rules], unmapped: [] };
  const seen = new Set();
  const out = [];
  const unmapped = [];
  for (const r of rules) {
    const m = RULE_MAP.find((x) => x.match.test(String(r)));
    if (!m) {
      unmapped.push(r);
      continue;
    }
    const line = m[lang] ?? m.en;
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return { lines: out, unmapped };
}

/* ------------------------------------------------------------------ */
/* Kaya türü, alan türü, dönem                                           */
/* ------------------------------------------------------------------ */

const ROCK_MAP = {
  Kireçtaşı: { en: 'limestone', de: 'Kalkstein', ru: 'известняк' },
  'Kireçtaşı (alpin)': { en: 'alpine limestone', de: 'alpiner Kalkstein', ru: 'альпийский известняк' },
  'Tüf (volkanik)': { en: 'volcanic tuff', de: 'vulkanischer Tuff', ru: 'вулканический туф' },
  Andezit: { en: 'andesite', de: 'Andesit', ru: 'андезит' },
  Kumtaşı: { en: 'sandstone', de: 'Sandstein', ru: 'песчаник' },
  Granit: { en: 'granite', de: 'Granit', ru: 'гранит' },
};

export function rockType(value, lang) {
  if (lang === 'tr') return String(value).toLocaleLowerCase('tr');
  const m = ROCK_MAP[value];
  return m ? m[lang] ?? m.en : String(value);
}

const HERITAGE_KIND = {
  temple: { tr: 'tapınak alanı', en: 'temple site', de: 'Tempelanlage', ru: 'храмовый комплекс' },
  ancient_city: { tr: 'antik kent', en: 'ancient city', de: 'antike Stadt', ru: 'античный город' },
  tomb: { tr: 'anıt mezar', en: 'monumental tomb', de: 'Grabmal', ru: 'гробница' },
  monastery: { tr: 'manastır', en: 'monastery', de: 'Kloster', ru: 'монастырь' },
  rock_art: { tr: 'kaya resimleri', en: 'rock art', de: 'Felsbilder', ru: 'наскальные рисунки' },
  underground_city: { tr: 'yeraltı şehri', en: 'underground city', de: 'unterirdische Stadt', ru: 'подземный город' },
  sunken_city: { tr: 'batık kent', en: 'sunken city', de: 'versunkene Stadt', ru: 'затонувший город' },
};

export function heritageKind(kind, lang) {
  const m = HERITAGE_KIND[kind];
  return m ? m[lang] ?? m.en : String(kind).replace(/_/gu, ' ');
}

const ERA = {
  prehistoric: { tr: 'tarih öncesi', en: 'prehistoric', de: 'vorgeschichtlich', ru: 'доисторический' },
  hellenistic: { tr: 'Helenistik', en: 'Hellenistic', de: 'hellenistisch', ru: 'эллинистический' },
  roman: { tr: 'Roma', en: 'Roman', de: 'römisch', ru: 'римский' },
  byzantine: { tr: 'Bizans', en: 'Byzantine', de: 'byzantinisch', ru: 'византийский' },
  seljuk: { tr: 'Selçuklu', en: 'Seljuk', de: 'seldschukisch', ru: 'сельджукский' },
  ottoman: { tr: 'Osmanlı', en: 'Ottoman', de: 'osmanisch', ru: 'османский' },
  lycian: { tr: 'Likya', en: 'Lycian', de: 'lykisch', ru: 'ликийский' },
  hittite: { tr: 'Hitit', en: 'Hittite', de: 'hethitisch', ru: 'хеттский' },
};

export function era(value, lang) {
  const m = ERA[value];
  return m ? m[lang] ?? m.en : String(value);
}

/**
 * Metinde Türkçe **cümle** var mı? (QA: dil sızıntısı denetimi)
 * Özel adlar (Kaçkar, İTÜ, Şanlıurfa) Türkçe harf taşır ama sızıntı değildir; bu yüzden
 * yalnızca Türkçe işlev sözcükleri aranır.
 */
const TURKISH_FUNCTION_WORDS =
  /(^|[\s(«"'])(ve|için|ile|değil|yoktur|vardır|sonra|önce|yasaktır|gerekir|olabilir|edilir|yapılır|bulunur|üzerinde|arasında|nasıl|nerede|çıkma|almaz)([\s,.;:!?)»"']|$)/iu;

/**
 * @param {string} text denetlenecek metin
 * @param {readonly string[]} [ignore] özel adlar (kulüp/yer adı) — denetimden çıkarılır
 */
export function looksTurkish(text, ignore = []) {
  let t = String(text);
  for (const name of ignore) if (name) t = t.split(name).join(' ');
  return TURKISH_FUNCTION_WORDS.test(t);
}

/* ------------------------------------------------------------------ */
/* Etap türü, etkinlik türü, atıf                                        */
/* ------------------------------------------------------------------ */

const STAGE_KIND = {
  trailhead: { tr: 'patika başı', en: 'trailhead', de: 'Einstieg', ru: 'начало тропы' },
  teahouse: { tr: 'teahouse', en: 'teahouse', de: 'Teahouse', ru: 'ти-хаус' },
  village: { tr: 'köy', en: 'village', de: 'Dorf', ru: 'деревня' },
  base_camp: { tr: 'ana kamp', en: 'base camp', de: 'Basislager', ru: 'базовый лагерь' },
  viewpoint: { tr: 'seyir noktası', en: 'viewpoint', de: 'Aussichtspunkt', ru: 'смотровая' },
  pass: { tr: 'geçit', en: 'pass', de: 'Pass', ru: 'перевал' },
  camp: { tr: 'kamp', en: 'camp', de: 'Lager', ru: 'лагерь' },
  summit: { tr: 'zirve', en: 'summit', de: 'Gipfel', ru: 'вершина' },
  hut: { tr: 'dağ evi', en: 'hut', de: 'Hütte', ru: 'приют' },
};

export function stageKind(kind, lang) {
  const m = STAGE_KIND[kind];
  return m ? m[lang] ?? m.en : String(kind).replace(/_/gu, ' ');
}

const ACTIVITY = {
  hiking: { tr: 'yürüyüş', en: 'hiking', de: 'Wandern', ru: 'треккинг' },
  climbing: { tr: 'tırmanış', en: 'climbing', de: 'Klettern', ru: 'скалолазание' },
  skiing: { tr: 'kayak', en: 'ski touring', de: 'Skitour', ru: 'ски-тур' },
  cycling: { tr: 'bisiklet', en: 'cycling', de: 'Radfahren', ru: 'велосипед' },
  diving: { tr: 'dalış', en: 'diving', de: 'Tauchen', ru: 'дайвинг' },
  canoe: { tr: 'kano', en: 'paddling', de: 'Paddeln', ru: 'каяк' },
  rafting: { tr: 'rafting', en: 'rafting', de: 'Rafting', ru: 'рафтинг' },
  paragliding: { tr: 'yamaç paraşütü', en: 'paragliding', de: 'Gleitschirm', ru: 'параплан' },
};

export function activityName(value, lang) {
  const m = ACTIVITY[value];
  return m ? m[lang] ?? m.en : String(value);
}

/** Açık veri atfı — dile göre. */
export function attribution(lang) {
  return {
    tr: '© OpenStreetMap katkıcıları (ODbL 1.0) · Wikidata (CC0)',
    en: '© OpenStreetMap contributors (ODbL 1.0) · Wikidata (CC0)',
    de: '© OpenStreetMap-Mitwirkende (ODbL 1.0) · Wikidata (CC0)',
    ru: '© Участники OpenStreetMap (ODbL 1.0) · Wikidata (CC0)',
  }[lang] ?? '© OpenStreetMap contributors (ODbL 1.0)';
}
