#!/usr/bin/env node
/**
 * Kanal gönderim ve paketleme aracı — tüm adaptörlerin ortak arayüzünü çalıştırır.
 *
 *   node dispatch.mjs publish  --input out/content/content.json --channels x,reddit
 *   node dispatch.mjs schedule --input out/calendar/calendar.json
 *   node dispatch.mjs metrics  --channels all --since 2026-10-01 --until 2026-10-07
 *   node dispatch.mjs reply    --input content/example-mentions.json
 *
 * Varsayılan **kuru çalışma**: hiçbir ağ çağrısı yapılmaz, `out/packets/<kanal>/…` altına
 * elle yayınlanacak paket (metin + hashtag + görsel talimatı + en iyi saat + adımlar) yazılır.
 * `--live` bayrağı ve kanalın ortam değişkenleri tamsa gerçek yayın denenir.
 */

import { boolFlag, listFlag, numberFlag, parseArgs, usage } from './lib/args.mjs';
import { makeContext } from './channels/base.mjs';
import { CHANNEL_IDS, channelBrief, CHANNELS, resolveChannels } from './channels/index.mjs';
import { generateContent, toPost } from './content/engine.mjs';
import { outPath, readJson, Writer } from './lib/fsx.mjs';
import { lines, mdTable } from './lib/text.mjs';

const COMMANDS = ['publish', 'schedule', 'metrics', 'reply', 'channels'];

/** Girdi dosyasından (içerik ya da takvim) gönderi listesi çıkarır. */
export function loadItems(path, options = {}) {
  if (!path) return generateContent({ langs: options.langs ?? ['tr'], perArchetype: 1, limit: options.limit ?? 8 });
  const data = readJson(path);
  if (!data) throw new Error(`Girdi bulunamadı: ${path}`);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.slots)) return data.slots;
  throw new Error(`Girdi biçimi tanınmadı: ${path}`);
}

async function cmdPublish(flags) {
  const writer = new Writer();
  const dir = typeof flags.out === 'string' ? flags.out : outPath('packets');
  const channels = resolveChannels(listFlag(flags.channels, CHANNEL_IDS));
  const live = boolFlag(flags.live, false);
  const items = loadItems(typeof flags.input === 'string' ? flags.input : '', {
    langs: listFlag(flags.langs ?? flags.lang, ['tr']),
    limit: numberFlag(flags.limit, 8),
  });
  const limited = items.slice(0, numberFlag(flags.limit, items.length));

  const ctx = makeContext({ live, writer, outDir: dir, log: (l) => console.log(`  ${l}`) });
  const results = [];
  for (const channel of channels) {
    for (const item of limited) {
      // Takvim slot'u zaten kanal-özel; içerik nesnesi ise kanala uyarlanır.
      const post = item.channel && item.body ? item : toPost(item, channel.id, { date: item.date, campaign: flags.campaign });
      if (post.channel && post.channel !== channel.id) continue;
      const res = await channel.publish(post, ctx);
      results.push(res);
    }
  }

  const ok = results.filter((r) => r.ok).length;
  const blocked = results.filter((r) => !r.ok);
  writer.json(`${dir}/publish-log.json`, { generatedAt: new Date().toISOString(), live, results });
  writer.text(
    `${dir}/README.md`,
    lines(
      '# Yayın paketleri',
      '',
      `${results.length} gönderi · mod: ${live ? 'canlı denendi' : 'kuru çalışma'} · uyarısız: ${ok}`,
      '',
      mdTable(
        ['Kanal', 'Gönderi', 'Mod', 'En iyi saat', 'Uyarı'],
        results.map((r) => [r.channel, r.postId, r.mode, r.bestTime, r.warnings.length]),
      ),
      '',
      '## Elle yayın sırası',
      '',
      'Her kanal klasöründeki `.md` dosyası kopyala-yapıştır için hazırdır: metin, hashtag,',
      'görsel talimatı, en iyi saat ve adım adım yayın yönergesi içerir.',
    ),
  );
  console.log(`\n${results.length} gönderi işlendi, ${writer.count} dosya yazıldı.`);
  if (blocked.length > 0) {
    console.error(`Marka denetiminden geçmeyen ${blocked.length} gönderi var:`);
    for (const b of blocked) console.error(`  ${b.channel}/${b.postId}: ${b.reason}`);
    return 2;
  }
  return 0;
}

function cmdSchedule(flags) {
  const writer = new Writer();
  const dir = typeof flags.out === 'string' ? flags.out : outPath('packets');
  const channels = resolveChannels(listFlag(flags.channels, CHANNEL_IDS));
  const items = loadItems(typeof flags.input === 'string' ? flags.input : '', { limit: numberFlag(flags.limit, 12) });
  const ctx = makeContext({ writer, outDir: dir });
  const all = [];
  for (const channel of channels) {
    const posts = items
      .filter((i) => !i.channel || i.channel === channel.id)
      .map((i) => (i.body ? i : toPost(i, channel.id, { date: i.date })));
    if (posts.length === 0) continue;
    const { entries } = channel.schedule(posts, ctx);
    all.push(...entries);
  }
  all.sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date < b.date ? -1 : 1));
  writer.json(`${dir}/schedule.json`, all);
  const over = all.filter((e) => e.overCadence);
  console.log(`${all.length} yayın zamanı planlandı (${channels.length} kanal).`);
  if (over.length > 0) console.log(`Uyarı: ${over.length} slot günlük kanal kadansını aşıyor.`);
  console.log(writer.summary().join('\n'));
  return 0;
}

async function cmdMetrics(flags) {
  const writer = new Writer();
  const dir = typeof flags.out === 'string' ? flags.out : outPath('metrics');
  const channels = resolveChannels(listFlag(flags.channels, CHANNEL_IDS));
  const ctx = makeContext({ live: boolFlag(flags.live, false) });
  const range = { since: flags.since, until: flags.until };
  const out = [];
  for (const channel of channels) out.push(await channel.metrics(range, ctx));
  writer.json(`${dir}/metrics.json`, out);
  writer.text(
    `${dir}/nasil-toplanir.md`,
    lines(
      '# Metrik toplama yönergesi',
      '',
      'Her kanal için dışa aktarma yolu ve `report.mjs` girdisine dönüştürme kuralı:',
      '',
      mdTable(
        ['Kanal', 'Alanlar', 'Nereden dışa aktarılır'],
        out.map((m) => [m.channel, (m.fields ?? []).join(', '), m.manualExport ?? '—']),
      ),
      '',
      '## Birleşik CSV başlığı',
      '',
      '```csv',
      'date,channel,post_id,reach,impressions,engagements,link_clicks,installs,saves,shares,comments,followers_delta',
      '```',
      '',
      'Bu başlıkla kaydedilen dosyayı `node report.mjs --input <dosya>.csv` okur.',
    ),
  );
  console.log(`${out.length} kanal için metrik durumu yazıldı (${out.filter((m) => m.mode === 'live').length} canlı).`);
  console.log(writer.summary().join('\n'));
  return 0;
}

function cmdReply(flags) {
  const writer = new Writer();
  const dir = typeof flags.out === 'string' ? flags.out : outPath('replies');
  const path = typeof flags.input === 'string' ? flags.input : '';
  const mentions = path ? readJson(path, []) : [];
  if (mentions.length === 0) throw new Error('Yanıt için girdi gerekir: --input <mentions.json>');
  const ctx = makeContext();
  const drafts = mentions.map((m) => {
    const channel = CHANNELS[m.channel] ?? CHANNELS.instagram;
    return { ...channel.reply(m, ctx), author: m.author ?? '', text: m.text };
  });
  writer.json(`${dir}/replies.json`, drafts);
  writer.text(
    `${dir}/replies.md`,
    lines(
      '# Yanıt taslakları',
      '',
      'Hepsi **taslaktır**; yayınlamadan önce insan onayı gerekir. Güvenlik ve şikâyet başlıkları yükseltilir.',
      '',
      ...drafts.flatMap((d) => [
        `## ${d.channel} · ${d.intent}${d.escalate ? ' · YÜKSELT' : ''}`,
        '',
        `> ${d.text}`,
        '',
        d.draft,
        d.escalate ? `\n_${d.escalateReason}_` : '',
        d.channelNote ? `\n_${d.channelNote}_` : '',
        '',
      ]),
    ),
  );
  const esc = drafts.filter((d) => d.escalate).length;
  console.log(`${drafts.length} yanıt taslağı (${esc} yükseltme). ${writer.summary().join(' · ')}`);
  return 0;
}

export async function main(argv = process.argv.slice(2)) {
  const { flags, positionals } = parseArgs(argv);
  const command = positionals[0] ?? 'publish';
  if (flags.help || !COMMANDS.includes(command)) {
    console.log(
      usage('dispatch.mjs — kanal adaptörlerini çalıştırır (kuru çalışma varsayılan)', [
        'publish   içerik/takvim → kanal paketleri (out/packets)',
        'schedule  gönderileri en iyi saatlere yerleştirir (+ .ics)',
        'metrics   metrik durumu ve elle dışa aktarma yönergesi',
        'reply     yorum/DM yanıt taslakları',
        'channels  kanal kurallarını yazdırır',
        '',
        '--input <dosya>     içerik (content.json) / takvim (calendar.json) / mentions.json',
        '--channels a,b      kanal süzgeci (varsayılan hepsi)',
        `                    geçerli: ${CHANNEL_IDS.join(', ')}`,
        '--langs tr,en       girdi üretilecekse diller',
        '--limit 8           gönderi sayısı',
        '--live              gerçek yayın dener (anahtar yoksa yine kuru çalışır)',
        '--out <klasör>      çıktı klasörü',
      ]),
    );
    return flags.help ? 0 : 1;
  }
  if (command === 'channels') {
    console.log(channelBrief(listFlag(flags.channels, CHANNEL_IDS)));
    return 0;
  }
  if (command === 'publish') return cmdPublish(flags);
  if (command === 'schedule') return cmdSchedule(flags);
  if (command === 'metrics') return cmdMetrics(flags);
  return cmdReply(flags);
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(await main());
