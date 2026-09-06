import { checkBrandCompliance } from '../brand.js';
import { generateStructured } from '../client.js';
import { replySystem } from '../prompts.js';
import {
  CHANNEL_IDS,
  REPLIES_SCHEMA,
  type Mention,
  type RepliesFile,
  type Reply,
} from '../schemas.js';
import { readJson, todayIso, writeJson, writeText } from '../util/fs.js';

export interface ReplyOptions {
  input: string;
  out: string | undefined;
  log: (line: string) => void;
}

const CHUNK = 20;

export function parseMentions(raw: unknown): Mention[] {
  const list = Array.isArray(raw) ? raw : (raw as { mentions?: unknown })?.mentions;
  if (!Array.isArray(list))
    throw new Error('mentions.json: dizi ya da { mentions: [...] } bekleniyor');
  return list.map((m, i) => {
    const obj = (m ?? {}) as Record<string, unknown>;
    const text = typeof obj.text === 'string' ? obj.text : '';
    if (!text) throw new Error(`mentions[${i}].text eksik`);
    const channel =
      typeof obj.channel === 'string' && (CHANNEL_IDS as readonly string[]).includes(obj.channel)
        ? (obj.channel as Mention['channel'])
        : 'instagram';
    const kindRaw =
      typeof obj.kind === 'string' ? obj.kind : typeof obj.type === 'string' ? obj.type : 'comment';
    const kind = (['comment', 'dm', 'mention', 'review'] as const).includes(
      kindRaw as Mention['kind'],
    )
      ? (kindRaw as Mention['kind'])
      : 'comment';
    return {
      id: typeof obj.id === 'string' && obj.id ? obj.id : `m${i + 1}`,
      channel,
      kind,
      author: typeof obj.author === 'string' ? obj.author : 'anon',
      text,
      lang: typeof obj.lang === 'string' ? obj.lang : undefined,
      postId: typeof obj.postId === 'string' ? obj.postId : undefined,
    };
  });
}

export async function runReply(options: ReplyOptions): Promise<RepliesFile> {
  const mentions = parseMentions(readJson(options.input));
  const system = replySystem();
  const replies: Reply[] = [];
  for (let i = 0; i < mentions.length; i += CHUNK) {
    const chunk = mentions.slice(i, i + CHUNK);
    options.log(`${i + 1}–${i + chunk.length}/${mentions.length} yorum/DM için yanıt üretiliyor…`);
    const user = [
      'Aşağıdaki yorum/DM’ler için yanıt önerisi üret; her girdi için tam olarak bir reply (aynı id).',
      ...chunk.map(
        (m) =>
          `- id=${m.id} · ${m.channel} · ${m.kind} · @${m.author}${m.lang ? ` · dil ${m.lang}` : ''}${m.postId ? ` · gönderi ${m.postId}` : ''}\n  "${m.text.replace(/\n/g, ' ')}"`,
      ),
    ].join('\n');
    const result = await generateStructured<RepliesFile>({
      system,
      user,
      schema: REPLIES_SCHEMA,
      label: 'yanıtlar',
      effort: 'medium',
    });
    replies.push(...result.replies);
  }

  const file: RepliesFile = { replies: replies.map(flag) };
  const base = options.out ?? `content/replies-${todayIso()}`;
  writeJson(`${base}.json`, file);
  writeText(`${base}.md`, renderReplies(mentions, file));
  const escalations = file.replies.filter((r) => r.escalate);
  options.log(
    `${file.replies.length} yanıt → ${base}.md${escalations.length ? ` · ${escalations.length} yükseltme (escalate)` : ''}`,
  );
  return file;
}

function flag(reply: Reply): Reply {
  const issues = checkBrandCompliance(reply.reply);
  if (issues.length === 0) return reply;
  return {
    ...reply,
    escalate: true,
    escalateReason: `${reply.escalateReason ? `${reply.escalateReason}; ` : ''}marka uyarısı: ${issues.map((i) => i.phrase).join(', ')}`,
  };
}

export function renderReplies(mentions: Mention[], file: RepliesFile): string {
  const byId = new Map(mentions.map((m) => [m.id, m]));
  const lines = ['# Yanıt önerileri', ''];
  for (const r of file.replies) {
    const m = byId.get(r.id);
    lines.push(
      `## ${r.id} · ${m?.channel ?? '?'} · ${m?.kind ?? '?'} · @${m?.author ?? '?'}${r.escalate ? ' · **YÜKSELT**' : ''}`,
    );
    lines.push('');
    if (m) lines.push(`> ${m.text.replace(/\n/g, '\n> ')}`);
    lines.push('');
    lines.push(`**Niyet:** ${r.intent} · **Dil:** ${r.language}`);
    lines.push('');
    lines.push(r.reply || '_(yanıt verme)_');
    if (r.escalate) lines.push('', `Yükseltme nedeni: ${r.escalateReason}`);
    if (r.followUp) lines.push('', `Takip işi: ${r.followUp}`);
    lines.push('');
  }
  return lines.join('\n');
}
