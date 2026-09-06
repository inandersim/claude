/** posts.json → kanal başına okunur Markdown (content/week-NN/*.md). Deterministik; test edilir. */
import { formatPost } from './channels/index.js';
import type { Post, PostsFile } from './schemas.js';

export function postFileName(post: Post): string {
  return `${post.date}-${post.channel}-${post.id}.md`;
}

export function renderPost(post: Post): string {
  const f = formatPost(post);
  const lines: string[] = [];
  lines.push(`# ${post.title || post.id}`);
  lines.push('');
  lines.push(
    `- Kanal: **${post.channel}** · Biçim: **${post.format}** · Dil: **${post.lang}** · Tarih: **${post.date}** · Saat: **${post.bestTime}**`,
  );
  if (post.link) lines.push(`- Bağlantı: ${post.link}`);
  if (f.warnings.length > 0) lines.push(`- Uyarılar: ${f.warnings.join(' · ')}`);
  lines.push('');
  lines.push('## Yayın metni');
  lines.push('');
  lines.push('```text');
  lines.push(f.text);
  lines.push('```');
  if (post.scenes.length > 0) {
    lines.push('');
    lines.push('## Senaryo (sahne sahne)');
    lines.push('');
    lines.push('| # | Süre | Görsel | Ekran metni | Seslendirme |');
    lines.push('| - | ---- | ------ | ----------- | ----------- |');
    for (const s of post.scenes)
      lines.push(
        `| ${s.n} | ${s.durationSec}s | ${cell(s.visual)} | ${cell(s.onScreenText)} | ${cell(s.voiceover)} |`,
      );
  }
  if (post.frames.length > 0) {
    lines.push('');
    lines.push('## Kareler');
    lines.push('');
    post.frames.forEach((frame, i) => lines.push(`${i + 1}. ${frame}`));
  }
  if (post.visualBrief) {
    lines.push('');
    lines.push('## Görsel brief');
    lines.push('');
    lines.push(post.visualBrief);
  }
  if (post.media.length > 0) {
    lines.push('');
    lines.push('## Medya');
    lines.push('');
    for (const m of post.media)
      lines.push(`- ${m.type}: ${m.url || m.path || '(eksik)'} — ${m.alt}`);
  }
  if (post.notes) {
    lines.push('');
    lines.push('## Notlar');
    lines.push('');
    lines.push(post.notes);
  }
  return `${lines.join('\n')}\n`;
}

function cell(text: string): string {
  return text.replace(/\|/gu, '\\|').replace(/\n+/gu, ' ');
}

export function renderWeekIndex(file: PostsFile): string {
  const lines: string[] = [
    `# Hafta ${file.week} — gönderi takvimi`,
    '',
    `Üretim: ${file.generatedAt}`,
    '',
  ];
  lines.push('| Tarih | Saat | Kanal | Biçim | Dil | Başlık | Dosya |');
  lines.push('| ----- | ---- | ----- | ----- | --- | ------ | ----- |');
  const sorted = [...file.posts].sort((a, b) =>
    `${a.date} ${a.bestTime}`.localeCompare(`${b.date} ${b.bestTime}`),
  );
  for (const p of sorted)
    lines.push(
      `| ${p.date} | ${p.bestTime} | ${p.channel} | ${p.format} | ${p.lang} | ${cell(p.title)} | ${postFileName(p)} |`,
    );
  return `${lines.join('\n')}\n`;
}
