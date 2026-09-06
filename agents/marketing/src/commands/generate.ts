import { checkBrandCompliance, type Lang } from '../brand.js';
import { generateStructured } from '../client.js';
import { generateSystem } from '../prompts.js';
import { postFileName, renderPost, renderWeekIndex } from '../render.js';
import {
  PLAN_SCHEMA,
  POST_SCHEMA,
  assertValid,
  type ChannelId,
  type JsonSchema,
  type Plan,
  type PlanItem,
  type Post,
  type PostsFile,
} from '../schemas.js';
import { readJson, weekDir, writeJson, writeText } from '../util/fs.js';
import { join } from 'node:path';

export interface GenerateOptions {
  plan: string;
  week: number;
  outDir: string;
  channels: string | undefined;
  lang: Lang | undefined;
  log: (line: string) => void;
}

const GENERATE_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: { posts: { type: 'array', minItems: 1, maxItems: 20, items: POST_SCHEMA } },
  required: ['posts'],
};

const CHUNK_ITEMS = 6;

export async function runGenerate(options: GenerateOptions): Promise<PostsFile> {
  const plan = assertValid<Plan>(PLAN_SCHEMA, readJson(options.plan), 'plan.json');
  const week = plan.weeks.find((w) => w.week === options.week);
  if (!week) throw new Error(`Planda ${options.week}. hafta yok (1–${plan.weeks.length}).`);

  const wanted = options.channels
    ? new Set(options.channels.split(',').map((s) => s.trim()))
    : null;
  const items = week.items.filter((i) => !wanted || wanted.has(i.channel));
  if (items.length === 0) throw new Error('Seçilen kanallar için plan öğesi yok.');

  const channels = [...new Set(items.map((i) => i.channel))] as ChannelId[];
  const system = generateSystem(channels, options.lang ?? 'tr');
  const posts: Post[] = [];

  for (let i = 0; i < items.length; i += CHUNK_ITEMS) {
    const chunk = items.slice(i, i + CHUNK_ITEMS);
    options.log(
      `Hafta ${week.week}: ${i + 1}–${i + chunk.length}/${items.length} gönderi üretiliyor…`,
    );
    const user = [
      `Hafta ${week.week} (${week.startDate}) — tema: ${week.theme}. Hedef: ${week.goal}.`,
      `Her plan öğesi için tam olarak bir gönderi üret (${chunk.length} gönderi), sıra aynı:`,
      ...chunk.map((it, n) => describeItem(n + 1, it)),
      `Bağlantı UTM: utm_campaign=w${String(week.week).padStart(2, '0')}.`,
      posts.length > 0
        ? `Bu haftada zaten üretilen id'ler (tekrar kullanma): ${posts.map((p) => p.id).join(', ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
    const result = await generateStructured<{ posts: Post[] }>({
      system,
      user,
      schema: GENERATE_SCHEMA,
      label: `hafta ${week.week} gönderiler`,
      onProgress: (chars) => {
        if (chars % 2000 < 40) process.stderr.write('.');
      },
    });
    process.stderr.write('\n');
    posts.push(...result.posts);
  }

  const file: PostsFile = {
    week: week.week,
    generatedAt: new Date().toISOString(),
    posts: dedupeIds(posts).map(flagCompliance),
  };
  const dir = join(options.outDir, weekDir(week.week));
  writeJson(join(dir, 'posts.json'), file);
  for (const post of file.posts) writeText(join(dir, postFileName(post)), renderPost(post));
  writeText(join(dir, 'README.md'), renderWeekIndex(file));
  options.log(`${file.posts.length} gönderi → ${dir}/`);
  const flagged = file.posts.filter((p) => p.notes.includes('[marka-uyarı]'));
  if (flagged.length > 0)
    options.log(
      `Marka uyarısı olan gönderiler: ${flagged.map((p) => p.id).join(', ')} (notes alanına bak)`,
    );
  return file;
}

function describeItem(n: number, it: PlanItem): string {
  return `${n}. ${it.date} · ${it.channel} · ${it.format} · dil ${it.lang} · kitle ${it.audience} · amaç ${it.objective} · tema: ${it.theme} · KPI ${it.kpi.metric}=${it.kpi.target}${it.notes ? ` · not: ${it.notes}` : ''}`;
}

export function dedupeIds(posts: Post[]): Post[] {
  const seen = new Map<string, number>();
  return posts.map((p) => {
    const count = seen.get(p.id) ?? 0;
    seen.set(p.id, count + 1);
    return count === 0 ? p : { ...p, id: `${p.id}-${count + 1}` };
  });
}

/** Yasak ifade bulunursa notes alanına işaret düşer (gönderi silinmez; insan karar verir). */
export function flagCompliance(post: Post): Post {
  const issues = checkBrandCompliance([post.title, post.body, post.cta].join('\n'));
  if (issues.length === 0) return post;
  const note = `[marka-uyarı] ${issues.map((i) => `"${i.phrase}" (${i.reason})`).join('; ')}`;
  return { ...post, notes: post.notes ? `${note}\n${post.notes}` : note };
}
