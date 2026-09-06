import type { Lang } from '../brand.js';
import { generateStructured } from '../client.js';
import { parseChannelList } from '../channels/index.js';
import { planSystem } from '../prompts.js';
import { PLAN_SCHEMA, type Plan, type PlanWeek } from '../schemas.js';
import { addDays, nextMonday, todayIso, writeJson } from '../util/fs.js';

export interface PlanOptions {
  weeks: number;
  lang: Lang;
  channels: string | undefined;
  start: string | undefined;
  out: string;
  log: (line: string) => void;
}

const CHUNK_WEEKS = 4;

/** Haftaları parça parça (4'er) üretir; önceki haftaların temaları bağlam olarak verilir. */
export async function runPlan(options: PlanOptions): Promise<Plan> {
  const channels = parseChannelList(options.channels);
  const startDate = nextMonday(options.start ?? todayIso());
  const system = planSystem(channels, options.lang);
  const weeks: PlanWeek[] = [];
  let title = '';

  for (let first = 1; first <= options.weeks; first += CHUNK_WEEKS) {
    const last = Math.min(options.weeks, first + CHUNK_WEEKS - 1);
    const ranges = [];
    for (let w = first; w <= last; w += 1) {
      const ws = addDays(startDate, (w - 1) * 7);
      ranges.push(`- Hafta ${w}: ${ws} → ${addDays(ws, 6)}`);
    }
    const previous = weeks.map((w) => `- Hafta ${w.week}: ${w.theme} — ${w.goal}`).join('\n');
    const user = [
      `Toplam ${options.weeks} haftalık plan; şimdi yalnızca ${first}–${last}. haftaları üret (weeks dizisinde tam olarak ${last - first + 1} hafta).`,
      `Ana dil: ${options.lang}. Kanallar: ${channels.join(', ')}. Plan başlangıcı: ${startDate}.`,
      'Hafta aralıkları (tarihler bu aralıkta olmalı):',
      ...ranges,
      previous
        ? `Önceki haftalar (tekrar etme, üzerine kur):\n${previous}`
        : 'Bu ilk parça; title alanına planın adını yaz.',
      `startDate alanına ${startDate} yaz.`,
    ].join('\n');

    options.log(`Hafta ${first}–${last} planlanıyor…`);
    const chunk = await generateStructured<Plan>({
      system,
      user,
      schema: PLAN_SCHEMA,
      label: `plan h${first}-${last}`,
      onProgress: (chars) => {
        if (chars % 2000 < 40) process.stderr.write('.');
      },
    });
    process.stderr.write('\n');
    if (!title) title = chunk.title;
    for (const week of chunk.weeks) weeks.push(fixWeek(week, startDate));
  }

  weeks.sort((a, b) => a.week - b.week);
  const plan: Plan = {
    title: title || `Zirve ${options.weeks} haftalık büyüme planı`,
    startDate,
    weeks,
  };
  writeJson(options.out, plan);
  options.log(
    `Plan yazıldı: ${options.out} (${weeks.length} hafta, ${weeks.reduce((n, w) => n + w.items.length, 0)} öğe)`,
  );
  return plan;
}

/** Hafta başlangıcını ve aralık dışına taşan tarihleri düzeltir (model hatasına tolerans). */
export function fixWeek(week: PlanWeek, planStart: string): PlanWeek {
  const ws = addDays(planStart, (week.week - 1) * 7);
  const we = addDays(ws, 6);
  const items = week.items.map((item) => {
    if (item.date < ws || item.date > we) return { ...item, date: ws };
    return item;
  });
  return { ...week, startDate: ws, items };
}
