import { existsSync } from 'node:fs';

import { checkBrandCompliance } from '../brand.js';
import { getChannel } from '../channels/index.js';
import type { PublishContext, PublishResult } from '../channels/types.js';
import { POSTS_FILE_SCHEMA, assertValid, type PostsFile } from '../schemas.js';
import { readJson, writeJson } from '../util/fs.js';

export interface PostOptions {
  channel: string;
  file: string;
  dryRun: boolean;
  ids: string[] | undefined;
  force: boolean;
  env: Record<string, string | undefined>;
  fetchImpl: typeof fetch;
  log: (line: string) => void;
  logFile?: string;
}

export async function runPost(options: PostOptions): Promise<PublishResult[]> {
  const channel = getChannel(options.channel);
  if (!channel.publisher)
    throw new Error(`${channel.spec.label} API ile yayınlanamıyor; içerik dosyasından elle yükle.`);
  const file = assertValid<PostsFile>(POSTS_FILE_SCHEMA, readJson(options.file), options.file);
  const posts = file.posts.filter(
    (p) => p.channel === channel.spec.id && (!options.ids || options.ids.includes(p.id)),
  );
  if (posts.length === 0) {
    options.log(`${options.file} içinde ${channel.spec.id} gönderisi yok.`);
    return [];
  }
  const ctx: PublishContext = {
    env: options.dryRun ? withPlaceholders(options.env, channel.spec.id, options.log) : options.env,
    fetchImpl: options.fetchImpl,
    dryRun: options.dryRun,
    log: options.log,
  };
  options.log(
    options.dryRun
      ? `DRY-RUN: ${posts.length} gönderi için istekler planlanıyor (gerçek gönderim için --yes).`
      : `CANLI: ${posts.length} gönderi ${channel.spec.label} hesabına gönderiliyor.`,
  );
  const results: PublishResult[] = [];
  for (const post of posts) {
    const formatted = channel.format(post);
    options.log(`\n— ${post.id} (${post.format}, ${post.date} ${post.bestTime})`);
    for (const w of formatted.warnings) options.log(`  uyarı: ${w}`);
    const issues = checkBrandCompliance(`${post.title}\n${formatted.text}`);
    if (issues.length > 0 && !options.force) {
      const error = `marka ihlali: ${issues.map((i) => `"${i.phrase}" (${i.reason})`).join('; ')} — düzelt ya da --force`;
      options.log(`  ATLANDI — ${error}`);
      results.push({
        channel: channel.spec.id,
        postId: post.id,
        ok: false,
        remoteIds: [],
        requests: [],
        error,
      });
      continue;
    }
    const result = await channel.publisher.publish(post, formatted, ctx);
    results.push(result);
    options.log(
      result.ok
        ? `  ${options.dryRun ? 'planlandı' : 'yayınlandı'}: ${result.remoteIds.join(', ')}`
        : `  HATA: ${result.error ?? 'bilinmiyor'}`,
    );
  }
  if (!options.dryRun && options.logFile) appendLog(options.logFile, results);
  return results;
}

/** Kanal başına gereken ortam değişkenleri (dry-run'da eksikse yer tutucu kullanılır). */
export const REQUIRED_ENV: Record<string, string[]> = {
  instagram: ['META_ACCESS_TOKEN', 'IG_USER_ID'],
  facebook: ['META_ACCESS_TOKEN', 'FB_PAGE_ID'],
  vk: ['VK_ACCESS_TOKEN', 'VK_GROUP_ID'],
  telegram: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHANNEL'],
};

function withPlaceholders(
  env: Record<string, string | undefined>,
  channel: string,
  log: (line: string) => void,
): Record<string, string | undefined> {
  const out = { ...env };
  for (const name of REQUIRED_ENV[channel] ?? []) {
    if (!out[name]?.trim()) {
      out[name] = `<${name}>`;
      log(`  not: ${name} tanımsız; dry-run için yer tutucu kullanıldı`);
    }
  }
  return out;
}

function appendLog(file: string, results: PublishResult[]): void {
  const existing = existsSync(file) ? readJson<unknown[]>(file) : [];
  const entries = results.map((r) => ({
    at: new Date().toISOString(),
    channel: r.channel,
    postId: r.postId,
    ok: r.ok,
    remoteIds: r.remoteIds,
    error: r.error ?? null,
  }));
  writeJson(file, [...(Array.isArray(existing) ? existing : []), ...entries]);
}
