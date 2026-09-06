#!/usr/bin/env node
/**
 * Davet ve referans sistemi — ürün tarafı sözleşmesi + viral döngü modeli.
 *
 *   node referral.mjs                          # varsayılan parametrelerle model + metinler
 *   node referral.mjs --users 1200 --invite-rate 0.35 --accept-rate 0.45 --weeks 12
 *   node referral.mjs --json
 *
 * Bu betik **uygulama koduna dokunmaz**. Ürettiği şey: davet kodu şeması, ödül tablosu,
 * K faktörü simülasyonu, dört dilde paylaşım metinleri ve backend'in uygulaması gereken
 * API sözleşmesi (KOORDİNATÖR GEREKLİ maddeleriyle birlikte).
 */

import { numberFlag, parseArgs, usage } from './lib/args.mjs';
import { BRAND, CONTENT_LANGS } from './lib/brand.mjs';
import { outPath, toCsv, Writer } from './lib/fsx.mjs';
import { lines, mdTable, num, pct } from './lib/text.mjs';

/* ------------------------------------------------------------------ */
/* Davet kodu şeması                                                     */
/* ------------------------------------------------------------------ */

/** Karıştırılması kolay karakterler (0/O, 1/I/L) çıkarılmış alfabe. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

/** Kod uzayı ve çakışma olasılığı (doğum günü yaklaşımı). */
export function codeSpace(length = CODE_LENGTH, users = 1_000_000) {
  const space = CODE_ALPHABET.length ** length;
  const collisionProbability = 1 - Math.exp((-users * (users - 1)) / (2 * space));
  return { alphabet: CODE_ALPHABET.length, length, space, users, collisionProbability };
}

/* ------------------------------------------------------------------ */
/* Ödül tablosu                                                          */
/* ------------------------------------------------------------------ */

export const REWARDS = [
  {
    trigger: 'Davet edilen kişi kaydolur ve e-postasını doğrular',
    inviter: '—',
    invitee: '7 gün Pro',
    note: 'Ödül davetliye peşin; davet eden için sayaç işlemez (sahte hesap teşviki olmasın).',
  },
  {
    trigger: 'Davet edilen kişi ilk maceraya çıkar (rota tamamlar ya da eşleşme kabul eder)',
    inviter: '7 gün Pro',
    invitee: '+7 gün Pro (toplam 14)',
    note: 'Gerçek kullanım şartı: davet çiftliğini ekonomik olarak anlamsız kılar.',
  },
  { trigger: '3 davet nitelikli olur', inviter: '1 ay Pro', invitee: '—', note: 'Kilometre taşı; kümülatif.' },
  {
    trigger: '10 davet nitelikli olur',
    inviter: '“Kurucu” rozeti + zirve pasaportu damgası + 3 ay Pro',
    invitee: '—',
    note: 'Rozet kalıcı; statü ödülü nakit ödülden ucuz ve daha etkili.',
  },
  {
    trigger: 'Kulüp kodu ile gelen üye nitelikli olur',
    inviter: 'Kulübe 50 XP (kulüp ligi sıralaması)',
    invitee: '1 ay Pro (öğrenci doğrulaması ile)',
    note: 'Kulüp lideri kişisel ödül almaz — kulüp kazanır; iç çatışmayı önler.',
  },
  {
    trigger: 'Rehber kodu ile gelen müşteri rezervasyon yapar',
    inviter: 'O rezervasyonda komisyon %5 → %3',
    invitee: '14 gün Pro',
    note: 'Rehber için nakit değil, komisyon indirimi: muhasebe basit kalır.',
  },
];

/** Kötüye kullanım engelleri — backend'in uygulaması gereken kurallar. */
export const ABUSE_RULES = [
  'Aynı cihaz kimliği (installation id) ile en fazla 1 davet ödülü.',
  'Davet eden ve edilen aynı IP /24 bloğunda ise ödül 72 saat beklemeye alınır ve elle onaya düşer.',
  'Nitelikli davet için e-posta doğrulama + en az bir gerçek etkinlik (rota tamamlama ya da kabul edilmiş eşleşme) şart.',
  'Kullanıcı başına ödüllendirilen davet üst sınırı: ayda 20.',
  'Kod paylaşımı halka açık kupon sitelerinde tespit edilirse kod döndürülür (rotate), verilen ödüller geri alınmaz.',
  'Silinen hesabın daveti geriye dönük iptal edilir; verilen Pro günü geri alınmaz (iyi niyet).',
];

/* ------------------------------------------------------------------ */
/* Viral döngü modeli                                                    */
/* ------------------------------------------------------------------ */

/**
 * K faktörü = davet oranı × davet başına ortalama davet sayısı × kabul oranı × nitelik oranı.
 * Basit kohort simülasyonu: her hafta yeni kullanıcılar davet gönderir, bir kısmı geri döner.
 */
export function simulate({ users = 1000, inviteRate = 0.3, invitesPerInviter = 3, acceptRate = 0.35, qualifyRate = 0.6, weeklyOrganic = 250, weeks = 12, churn = 0.08 } = {}) {
  const k = inviteRate * invitesPerInviter * acceptRate * qualifyRate;
  const rows = [];
  let active = users;
  let cumulative = users;
  for (let week = 1; week <= weeks; week += 1) {
    const invitesSent = Math.round(active * inviteRate * invitesPerInviter);
    const accepted = Math.round(invitesSent * acceptRate);
    const qualified = Math.round(accepted * qualifyRate);
    const lost = Math.round(active * churn);
    const newUsers = qualified + weeklyOrganic;
    active = Math.max(0, active + newUsers - lost);
    cumulative += newUsers;
    rows.push({
      week,
      active,
      invitesSent,
      accepted,
      qualified,
      organic: weeklyOrganic,
      newUsers,
      churned: lost,
      cumulative,
      referralShare: newUsers > 0 ? qualified / newUsers : 0,
    });
  }
  return { k, rows, params: { users, inviteRate, invitesPerInviter, acceptRate, qualifyRate, weeklyOrganic, weeks, churn } };
}

/** Hedefe göre okuma: K < 0.2 zayıf, 0.2–0.4 destekleyici, > 0.4 hedefte, > 1 kendi kendine büyür. */
export function readK(k) {
  if (k >= 1) return 'kendi kendine büyüyen döngü (nadir; ölçüm hatası olup olmadığını kontrol et)';
  if (k >= 0.4) return 'hedefte: organik büyümenin yaklaşık üçte birini referans taşır';
  if (k >= 0.2) return 'destekleyici: döngü çalışıyor ama tek başına büyütmez';
  return 'zayıf: paylaşım anı ya da ödül yanlış yerde — önce davet oranına bak';
}

/* ------------------------------------------------------------------ */
/* Paylaşım metinleri                                                    */
/* ------------------------------------------------------------------ */

export const SHARE_COPY = {
  tr: {
    sheet: 'Zirtan’da rota planlıyorum. Kodumla gel, ikimiz de Pro kazanalım: {code}',
    story: 'Bu hafta {route} — birlikte çıkalım mı?',
    card: '{name} seni Zirtan’a davet ediyor. Kod: {code} → 7 gün Pro.',
    milestone: '{count}. davetin nitelikli oldu. Kurucu rozetine {left} kaldı.',
    push: 'Davet ettiğin kişi ilk rotasını tamamladı — 7 gün Pro hesabına eklendi.',
  },
  en: {
    sheet: 'I plan my routes in Zirtan. Join with my code and we both get Pro: {code}',
    story: 'Heading out to {route} this week — want to come?',
    card: '{name} invited you to Zirtan. Code: {code} → 7 days of Pro.',
    milestone: 'That is invite number {count}. {left} to go for the Founder badge.',
    push: 'Someone you invited finished their first route — 7 days of Pro added to your account.',
  },
  de: {
    sheet: 'Ich plane meine Touren in Zirtan. Komm mit meinem Code dazu, wir bekommen beide Pro: {code}',
    story: 'Diese Woche {route} — kommst du mit?',
    card: '{name} lädt dich zu Zirtan ein. Code: {code} → 7 Tage Pro.',
    milestone: 'Das war Einladung {count}. Noch {left} bis zum Gründer-Abzeichen.',
    push: 'Jemand, den du eingeladen hast, hat die erste Tour abgeschlossen — 7 Tage Pro gutgeschrieben.',
  },
  ru: {
    sheet: 'Планирую маршруты в Zirtan. Заходи по моему коду — оба получим Pro: {code}',
    story: 'На этой неделе {route} — идёшь?',
    card: '{name} приглашает тебя в Zirtan. Код: {code} → 7 дней Pro.',
    milestone: 'Это приглашение №{count}. До значка «Основатель» осталось {left}.',
    push: 'Приглашённый тобой человек прошёл первый маршрут — 7 дней Pro зачислены.',
  },
};

/** Paylaşımın doğal olduğu anlar — ürün tarafında düğme buraya konur. */
export const SHARE_MOMENTS = [
  { moment: 'Rota tamamlandı kartı', why: 'Duygusal zirve; kart zaten paylaşılabilir görsel.', surface: 'Rota özeti ekranı, "Paylaş" + "Arkadaşını davet et"' },
  { moment: 'Rozet kazanıldı', why: 'Statü paylaşımı doğal.', surface: 'Rozet modalı' },
  { moment: 'Haftalık özet', why: 'Kişisel veri + karşılaştırma paylaşımı tetikler.', surface: 'Pazar akşamı bildirimi → özet kartı' },
  { moment: 'Eşleşme isteği gönderildi ama karşı taraf uygulamada değil', why: 'Doğrudan ihtiyaç: "arkadaşın yoksa çağır".', surface: 'ZMatch boş durum ekranı' },
  { moment: 'Kulüp etkinliği oluşturuldu', why: 'Kulüp lideri zaten üyeleri çağıracak.', surface: 'Etkinlik oluşturma sonrası paylaşım sayfası' },
  { moment: 'Tehlike bildirimi onaylandı', why: 'Katkı hissi; "arkandan gelen görsün".', surface: 'Bildirim onay ekranı' },
];

/* ------------------------------------------------------------------ */
/* API sözleşmesi (KOORDİNATÖR GEREKLİ)                                  */
/* ------------------------------------------------------------------ */

function apiContract() {
  return lines(
    '# Referans sistemi — API sözleşmesi',
    '',
    '> Bu belge pazarlama tarafının ihtiyacını tanımlar. Uygulama ve backend kodu **bu betikle',
    '> yazılmaz**; aşağıdaki uçlar ürün ekibi tarafından uygulanmalıdır (KOORDİNATÖR GEREKLİ).',
    '',
    '## Uçlar',
    '',
    '### `GET /v1/referral/me`',
    '',
    '```json',
    '{',
    '  "code": "K7M4PQ",',
    '  "link": "https://zirtan.app/i/K7M4PQ",',
    '  "invitedCount": 7,',
    '  "qualifiedCount": 4,',
    '  "pendingCount": 1,',
    '  "proDaysEarned": 28,',
    '  "nextMilestone": { "at": 10, "reward": "founder_badge" }',
    '}',
    '```',
    '',
    '### `POST /v1/referral/claim`',
    '',
    'Gövde: `{ "code": "K7M4PQ", "installationId": "…" }` · Yanıt: `{ "ok": true, "reward": { "type": "pro_days", "value": 7 } }`',
    '',
    'Hatalar: `already_claimed`, `self_referral`, `code_not_found`, `code_rotated`, `rate_limited`.',
    '',
    '### `POST /v1/referral/qualify` (iç olay)',
    '',
    'Kullanıcı ilk niteliği tamamladığında (rota tamamlama ya da kabul edilmiş eşleşme) tetiklenir;',
    'davet edene ödülü yazar ve `referral_qualified` olayını yayınlar.',
    '',
    '### `GET /v1/referral/leaderboard?scope=club`',
    '',
    'Kulüp ligi için toplam nitelikli davet sayısı (kişi adı değil, kulüp adı döner).',
    '',
    '## Derin bağlantı',
    '',
    '- Web: `https://zirtan.app/i/<code>` → mağazaya yönlendirir, kodu saklar (deferred deep link).',
    '- Uygulama: `zirtan://invite/<code>`.',
    '- Kurulum sonrası ilk açılışta kod otomatik doldurulur; kullanıcı elle de girebilir.',
    '',
    '## Olaylar (analitik)',
    '',
    mdTable(
      ['Olay', 'Ne zaman', 'Alanlar'],
      [
        ['`invite_shared`', 'Paylaş düğmesine basıldığında', 'code, surface, channel'],
        ['`invite_opened`', 'Davet bağlantısı açıldığında', 'code, platform, referrer'],
        ['`invite_claimed`', 'Kod bir hesaba bağlandığında', 'code, inviterId, inviteeId'],
        ['`referral_qualified`', 'Nitelik koşulu sağlandığında', 'code, inviterId, inviteeId, qualifier'],
        ['`reward_granted`', 'Ödül yazıldığında', 'userId, type, value, reason'],
      ],
    ),
    '',
    '## KOORDİNATÖR GEREKLİ',
    '',
    '1. **Ürün ekibi:** yukarıdaki dört ucu ve beş olayı uygulasın; kod üretimi sunucu tarafında olsun (istemci üretmesin).',
    '2. **Ürün ekibi:** paylaşım düğmesi altı yüzeye eklensin (bkz. `share-moments` tablosu); metinler `share-copy.md` dosyasından alınsın.',
    '3. **Backend:** kötüye kullanım kuralları (aşağıdaki liste) ödül yazma yolunda uygulansın; elle onay kuyruğu gereksin.',
    '4. **Hukuk/finans:** Pro gün hediyesi muhasebede gelir tanınmayan promosyon olarak izlensin; kampanya koşulları sayfası yayınlansın.',
    '5. **Veri:** `referral_qualified` olayı analitiğe düşsün; haftalık K faktörü `report.mjs` girdisine yazılsın.',
    '6. **Tasarım:** paylaşım kartı 1080×1920 (story) ve 1080×1350 (gönderi) şablonları; kod büyük ve okunur.',
    '7. **Yasal:** davet metinlerinde ödül koşulu net yazılmalı ("ilk maceradan sonra"), aksi hâlde yanıltıcı promosyon riski.',
  );
}

export function buildReferralPack(options = {}) {
  const sim = simulate(options);
  const space = codeSpace();
  return { sim, space };
}

export function main(argv = process.argv.slice(2)) {
  const { flags } = parseArgs(argv);
  if (flags.help) {
    console.log(
      usage('referral.mjs — davet sistemi tasarımı ve viral döngü modeli', [
        '--users 1000          başlangıç aktif kullanıcı',
        '--invite-rate 0.3     davet gönderen kullanıcı oranı',
        '--invites 3           davet eden başına davet sayısı',
        '--accept-rate 0.35    davetin kabul (kurulum) oranı',
        '--qualify-rate 0.6    kurulumun nitelikli olma oranı',
        '--organic 250         haftalık organik kurulum',
        '--weeks 12            simülasyon süresi',
        '--out <klasör>        çıktı klasörü (varsayılan out/referral)',
      ]),
    );
    return 0;
  }

  const options = {
    users: numberFlag(flags.users, 1000),
    inviteRate: Number(flags['invite-rate'] ?? 0.3),
    invitesPerInviter: Number(flags.invites ?? 3),
    acceptRate: Number(flags['accept-rate'] ?? 0.35),
    qualifyRate: Number(flags['qualify-rate'] ?? 0.6),
    weeklyOrganic: numberFlag(flags.organic, 250),
    weeks: numberFlag(flags.weeks, 12),
  };
  const { sim, space } = buildReferralPack(options);

  const writer = new Writer();
  const dir = typeof flags.out === 'string' ? flags.out : outPath('referral');
  const last = sim.rows[sim.rows.length - 1];

  writer.text(
    `${dir}/README.md`,
    lines(
      '# Davet ve referans sistemi',
      '',
      `K faktörü: **${sim.k.toFixed(3)}** — ${readK(sim.k)}`,
      '',
      `Parametreler: davet oranı ${pct(options.inviteRate)}, kişi başı ${options.invitesPerInviter} davet, kabul ${pct(options.acceptRate)}, nitelik ${pct(options.qualifyRate)}, haftalık organik ${num(options.weeklyOrganic)}.`,
      '',
      `${options.weeks}. hafta sonunda: ${num(last.active)} aktif kullanıcı, ${num(last.cumulative)} kümülatif, yeni kullanıcıların ${pct(last.referralShare)} kadarı referanstan.`,
      '',
      '## Kod şeması',
      '',
      `- Alfabe: \`${CODE_ALPHABET}\` (${space.alphabet} karakter; 0/O ve 1/I/L çıkarıldı — telefonda okunur)`,
      `- Uzunluk: ${space.length} → ${num(space.space)} olası kod`,
      `- 1.000.000 kullanıcıda çakışma olasılığı: ${(space.collisionProbability * 100).toFixed(4)}% (sunucu yine de tekillik denetler)`,
      '- Kod büyük harf saklanır, girişte küçük harf ve boşluk normalleştirilir.',
      '- Kulüp kodu ayrı ön ek alır: `KLP-<kulüp kısaltması>` (ör. `KLP-ODTU`).',
      '',
      '## Ödül tablosu',
      '',
      mdTable(['Tetikleyici', 'Davet eden', 'Davet edilen', 'Not'], REWARDS.map((r) => [r.trigger, r.inviter, r.invitee, r.note])),
      '',
      '## Kötüye kullanım engelleri',
      '',
      ...ABUSE_RULES.map((r) => `- ${r}`),
      '',
      '## Paylaşım anları',
      '',
      mdTable(['An', 'Neden işe yarar', 'Nerede'], SHARE_MOMENTS.map((m) => [m.moment, m.why, m.surface])),
      '',
      '## Hedefler',
      '',
      mdTable(
        ['Metrik', 'Hedef', 'Neden'],
        [
          ['Davet başına kurulum', '> 0,30', 'Altındaysa paylaşım metni ya da anı yanlış'],
          ['Nitelik oranı', '> 0,55', 'Altındaysa ilk deneyim (onboarding) tıkanıyor'],
          ['K faktörü', '> 0,40', 'Organik büyümenin ~%30’unu taşır'],
          ['Ödül maliyeti / kurulum', '< ₺15', 'Pro gün maliyeti; nakit ödül yok'],
        ],
      ),
      '',
      `Marka: ${BRAND.name} · davet bağlantısı: ${BRAND.site}/i/<kod>`,
    ),
  );

  writer.text(`${dir}/api-contract.md`, apiContract());
  writer.text(
    `${dir}/share-copy.md`,
    lines(
      '# Paylaşım metinleri',
      '',
      'Değişkenler: `{code}` davet kodu · `{name}` davet eden ad · `{route}` rota adı · `{count}`, `{left}` kilometre taşı sayaçları.',
      '',
      ...CONTENT_LANGS.flatMap((lang) => [
        `## ${lang}`,
        '',
        mdTable(
          ['Yüzey', 'Metin'],
          Object.entries(SHARE_COPY[lang]).map(([k, v]) => [k, v]),
        ),
        '',
      ]),
      '## Kurallar',
      '',
      '- Ödül koşulu metinde açık: "ilk maceradan sonra" ibaresi düşürülmez.',
      '- Davet metni otomatik gönderilmez; kullanıcı paylaş düğmesine basar (spam koruması).',
      '- Rehber ve kulüp kodları farklı metin kullanır; ticari ilişki gizlenmez.',
    ),
  );
  writer.text(
    `${dir}/k-factor.csv`,
    toCsv(
      ['week', 'active', 'invites_sent', 'accepted', 'qualified', 'organic', 'new_users', 'churned', 'cumulative', 'referral_share'],
      sim.rows.map((r) => [r.week, r.active, r.invitesSent, r.accepted, r.qualified, r.organic, r.newUsers, r.churned, r.cumulative, r.referralShare.toFixed(3)]),
    ),
  );
  writer.json(`${dir}/referral.json`, { k: sim.k, params: sim.params, codeSpace: space, rewards: REWARDS, abuseRules: ABUSE_RULES, rows: sim.rows });

  console.log(`K = ${sim.k.toFixed(3)} (${readK(sim.k)})`);
  console.log(`${options.weeks}. hafta: ${num(last.active)} aktif, ${num(last.cumulative)} kümülatif.`);
  console.log(writer.summary().join('\n'));
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
