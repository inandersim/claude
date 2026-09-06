#!/usr/bin/env node
/**
 * Zirve pazarlama ajanları — CLI.
 *   plan | generate | reply | analyze | post
 * Claude API'ye giden komutlar ANTHROPIC_API_KEY ister; `post` yalnızca kanal token'ları ister.
 */
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { describeApiError, usageSummary, usageTotals } from './client.js';
import { runAnalyze } from './commands/analyze.js';
import { runGenerate } from './commands/generate.js';
import { runPlan } from './commands/plan.js';
import { runPost } from './commands/post.js';
import { runReply } from './commands/reply.js';
import type { Lang } from './brand.js';
import { loadEnv } from './util/env.js';

const HELP = `Zirve pazarlama ajanları (Claude API)

Kullanım: zirve-marketing <komut> [seçenekler]

Komutlar
  plan      --weeks 12 --lang tr --channels instagram,vk,... [--start YYYY-MM-DD] [--out content/plan.json]
  generate  --plan content/plan.json --week 1 [--channels instagram,telegram] [--lang tr] [--out content]
  reply     --input mentions.json [--out content/replies-<tarih>]
  analyze   --input insights.csv [--plan content/plan.json] [--out content/analysis-<tarih>]
  post      --channel instagram|facebook|vk|telegram --file content/week-01/posts.json [--ids a,b] [--dry-run|--yes] [--force]

Genel
  --help    bu metin
Ortam: .env (ANTHROPIC_API_KEY, META_ACCESS_TOKEN, IG_USER_ID, FB_PAGE_ID, VK_ACCESS_TOKEN, VK_GROUP_ID, TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL)
`;

const log = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

function asLang(value: string | undefined): Lang {
  const v = (value ?? 'tr').toLowerCase();
  if (v === 'tr' || v === 'en' || v === 'ru') return v;
  throw new Error(`--lang tr|en|ru olmalı (gelen: ${value})`);
}

function asInt(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} pozitif tam sayı olmalı`);
  return n;
}

export async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      weeks: { type: 'string' },
      lang: { type: 'string' },
      channels: { type: 'string' },
      channel: { type: 'string' },
      start: { type: 'string' },
      out: { type: 'string' },
      plan: { type: 'string' },
      week: { type: 'string' },
      input: { type: 'string' },
      file: { type: 'string' },
      ids: { type: 'string' },
      'dry-run': { type: 'boolean' },
      yes: { type: 'boolean' },
      force: { type: 'boolean' },
    },
  });
  const command = positionals[0];
  if (values.help || !command) {
    process.stdout.write(HELP);
    return command ? 0 : 1;
  }
  const envFile = loadEnv();
  if (envFile) log(`.env yüklendi: ${envFile}`);

  try {
    switch (command) {
      case 'plan':
        await runPlan({
          weeks: asInt(values.weeks, 12, '--weeks'),
          lang: asLang(values.lang),
          channels: values.channels,
          start: values.start,
          out: values.out ?? 'content/plan.json',
          log,
        });
        break;
      case 'generate':
        await runGenerate({
          plan: values.plan ?? 'content/plan.json',
          week: asInt(values.week, 1, '--week'),
          outDir: values.out ?? 'content',
          channels: values.channels,
          lang: values.lang ? asLang(values.lang) : undefined,
          log,
        });
        break;
      case 'reply':
        if (!values.input) throw new Error('--input mentions.json gerekli');
        await runReply({ input: values.input, out: values.out, log });
        break;
      case 'analyze':
        if (!values.input) throw new Error('--input insights.csv gerekli');
        await runAnalyze({ input: values.input, plan: values.plan, out: values.out, log });
        break;
      case 'post': {
        if (!values.channel) throw new Error('--channel instagram|facebook|vk|telegram gerekli');
        if (!values.file) throw new Error('--file posts.json gerekli');
        const dryRun = !values.yes;
        const results = await runPost({
          channel: values.channel,
          file: values.file,
          dryRun,
          ids: values.ids ? values.ids.split(',').map((s) => s.trim()) : undefined,
          force: values.force ?? false,
          env: process.env,
          fetchImpl: fetch,
          log,
          logFile: 'content/post-log.json',
        });
        const failed = results.filter((r) => !r.ok);
        log(
          `\n${results.length - failed.length}/${results.length} başarılı${dryRun ? ' (dry-run)' : ''}.`,
        );
        return failed.length > 0 ? 2 : 0;
      }
      default:
        process.stdout.write(HELP);
        throw new Error(`Bilinmeyen komut: ${command}`);
    }
  } catch (error) {
    log(`Hata: ${describeApiError(error)}`);
    return 1;
  } finally {
    if (usageTotals.inputTokens + usageTotals.outputTokens > 0) log(usageSummary());
  }
  return 0;
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      log(
        `Beklenmeyen hata: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
      );
      process.exitCode = 1;
    },
  );
}
