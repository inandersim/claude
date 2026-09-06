import { existsSync } from 'node:fs';

import { generateStructured } from '../client.js';
import { normalizeRows, summarize, summaryToMarkdown, type InsightsSummary } from '../metrics.js';
import { analyzeSystem } from '../prompts.js';
import { ANALYSIS_SCHEMA, type Analysis, type Plan } from '../schemas.js';
import { parseCsv } from '../util/csv.js';
import { readJson, readText, todayIso, writeJson, writeText } from '../util/fs.js';

export interface AnalyzeOptions {
  input: string;
  plan: string | undefined;
  out: string | undefined;
  log: (line: string) => void;
}

export async function runAnalyze(options: AnalyzeOptions): Promise<Analysis> {
  const rows = normalizeRows(parseCsv(readText(options.input)));
  if (rows.length === 0) throw new Error('CSV boş ya da başlık satırı okunamadı.');
  const summary = summarize(rows);
  options.log(
    `${rows.length} satır · ${summary.byChannel.length} kanal · dönem ${summary.period.from || '?'} → ${summary.period.to || '?'}`,
  );

  let planContext = '';
  const planFile = options.plan ?? 'content/plan.json';
  if (existsSync(planFile)) {
    const plan = readJson<Plan>(planFile);
    planContext = `Plan temaları:\n${plan.weeks.map((w) => `- Hafta ${w.week} (${w.startDate}): ${w.theme}`).join('\n')}`;
  }

  const analysis = await generateStructured<Analysis>({
    system: analyzeSystem(),
    user: [
      `Dönem: ${summary.period.from} → ${summary.period.to}.`,
      'Özet metrikler (hesaplanmış):',
      summaryToMarkdown(summary),
      '',
      'Ham özet JSON:',
      JSON.stringify(compact(summary)),
      planContext,
      'Performans özeti ve gelecek hafta için somut öneriler üret.',
    ]
      .filter(Boolean)
      .join('\n'),
    schema: ANALYSIS_SCHEMA,
    label: 'analiz',
  });

  const base = options.out ?? `content/analysis-${todayIso()}`;
  writeJson(`${base}.json`, { summary, analysis });
  writeText(`${base}.md`, renderAnalysis(summary, analysis));
  options.log(`Analiz → ${base}.md`);
  return analysis;
}

function compact(s: InsightsSummary): unknown {
  return {
    period: s.period,
    total: s.total,
    byChannel: s.byChannel,
    byFormat: s.byFormat,
    byChannelFormat: s.byChannelFormat.slice(0, 20),
    byWeek: s.byWeek,
    topPosts: s.topPosts,
    bottomPosts: s.bottomPosts,
  };
}

export function renderAnalysis(summary: InsightsSummary, a: Analysis): string {
  const lines = [`# Performans analizi — ${a.period}`, '', a.summary, ''];
  if (a.highlights.length) {
    lines.push('## Öne çıkanlar', '');
    for (const h of a.highlights) lines.push(`- ${h}`);
    lines.push('');
  }
  lines.push('## Kanal kanal', '');
  for (const c of a.byChannel) {
    lines.push(`### ${c.channel}`, '', c.verdict, '');
    if (c.keepDoing.length) lines.push(`- Devam: ${c.keepDoing.join('; ')}`);
    if (c.stopDoing.length) lines.push(`- Bırak: ${c.stopDoing.join('; ')}`);
    lines.push('');
  }
  lines.push('## Gelecek hafta için öneriler', '');
  lines.push('| Öncelik | Kanal | Aksiyon | Neden | KPI |');
  lines.push('| ------- | ----- | ------- | ----- | --- |');
  for (const r of a.recommendations)
    lines.push(
      `| ${r.priority} | ${r.channel} | ${r.action.replace(/\|/g, '/')} | ${r.rationale.replace(/\|/g, '/')} | ${r.kpi} |`,
    );
  lines.push('');
  if (a.nextWeekThemes.length) {
    lines.push('## Gelecek hafta temaları', '');
    for (const t of a.nextWeekThemes) lines.push(`- ${t}`);
    lines.push('');
  }
  lines.push('## Hesaplanan metrikler', '', summaryToMarkdown(summary), '');
  return lines.join('\n');
}
