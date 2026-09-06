#!/usr/bin/env node
/**
 * Performans nöbeti (bağımlılıksız, Node 22).
 *
 * Üç bütçeyi denetler ve aşımları bulguya çevirir:
 *   1. Paket boyutu   — JS gzip ve toplam gzip (kaynak: docs/health/bundle-size.json)
 *   2. Ekran açılışı  — ekran başına p75 ms (kaynak: telemetri `slow_screen` olayları)
 *   3. Sorgu sayısı   — ekran açılırken atılan istek sayısı
 *
 * Bütçeler `agents/selfheal/budgets.json` içindedir ve self-heal hattı tarafından
 * değiştirilemez (kendi klasörü DENY listesindedir) — bütçe gevşetmek insan kararıdır.
 *
 * Kullanım:
 *   node agents/selfheal/perf.mjs [--measurements <dosya>] [--budgets <dosya>] [--json]
 * Ölçüm kaynağı sırası: --measurements > docs/health/bundle-size.json + telemetri > fixture.
 * Çıkış kodu: bütçe aşımı varsa 1.
 */
import { join } from 'node:path';
import { parseArgs, readJsonSafe, ROOT, SELFHEAL_DIR, clamp01, round, slug, kb, cell } from './lib/util.mjs';
import { loadTelemetry, groupBySignature } from './lib/telemetry.mjs';

export const BUDGETS_PATH = join(SELFHEAL_DIR, 'budgets.json');
const FIXTURE_PATH = join(SELFHEAL_DIR, 'fixtures', 'perf-measurements.json');

/** Bütçeleri okur. */
export function loadBudgets(path = BUDGETS_PATH) {
  const budgets = readJsonSafe(path);
  if (!budgets) throw new Error(`Bütçe dosyası okunamadı: ${path}`);
  return budgets;
}

/** Bir ekran için geçerli bütçeyi döner (özel varsa o, yoksa varsayılan). */
export function budgetForScreen(screen, budgets) {
  const ozel = budgets?.screens?.ozel?.[screen];
  const varsayilan = budgets?.screens?.varsayilan ?? { p75Ms: Infinity, queries: Infinity };
  return { ...varsayilan, ...(ozel ?? {}), ozel: Boolean(ozel) };
}

/**
 * Ölçümleri bütçelerle karşılaştırır ve aşımları bulgu olarak döner.
 * Saf fonksiyon — dosya okumaz; birim testlerinin ana hedefi.
 *
 * @param {{bundle?:object, screens?:object[]}} measurements
 * @param {object} budgets
 * @returns {object[]} bulgular (kind: 'perf_budget')
 */
export function checkBudgets(measurements, budgets) {
  const findings = [];
  const bundleBudget = budgets?.bundle ?? {};

  // 1. Paket boyutu
  const jsGzipKb = (measurements?.bundle?.jsGzipBytes ?? 0) / 1024;
  if (bundleBudget.jsGzipKb && jsGzipKb > bundleBudget.jsGzipKb) {
    const asimYuzde = ((jsGzipKb - bundleBudget.jsGzipKb) / bundleBudget.jsGzipKb) * 100;
    findings.push({
      id: 'perf-paket-js-gzip',
      source: 'performans',
      kind: 'perf_budget',
      title: `Paket bütçesi aşıldı: JS gzip ${jsGzipKb.toFixed(0)} KB > ${bundleBudget.jsGzipKb} KB`,
      detail: `Bütçe %${asimYuzde.toFixed(1)} aşıldı (${kb(measurements.bundle.jsGzipBytes)} gzip, ${measurements.bundle.files ?? '?'} dosya).`,
      files: [],
      metrics: { count: Math.round(jsGzipKb), sessions: 0, budget: bundleBudget.jsGzipKb, actual: round(jsGzipKb, 1), asimYuzde: round(asimYuzde, 1) },
      evidence: { olcum: measurements.bundle, butce: bundleBudget },
      suggestedFix:
        'En büyük modülleri `node agents/devops/bundle-size.mjs` ile listele; ağır bağımlılıkları ertelemeli içe aktar (dynamic import) ya da daha küçük bir alternatifle değiştir.',
      frequencyOverride: clamp01(asimYuzde / 50),
      autoFixable: false,
    });
  }
  const totalGzipKb = (measurements?.bundle?.totalGzipBytes ?? 0) / 1024;
  if (bundleBudget.totalGzipKb && totalGzipKb > bundleBudget.totalGzipKb) {
    const asimYuzde = ((totalGzipKb - bundleBudget.totalGzipKb) / bundleBudget.totalGzipKb) * 100;
    findings.push({
      id: 'perf-paket-toplam-gzip',
      source: 'performans',
      kind: 'perf_budget',
      title: `Paket bütçesi aşıldı: toplam gzip ${totalGzipKb.toFixed(0)} KB > ${bundleBudget.totalGzipKb} KB`,
      detail: `Bütçe %${asimYuzde.toFixed(1)} aşıldı.`,
      files: [],
      metrics: { count: Math.round(totalGzipKb), sessions: 0, budget: bundleBudget.totalGzipKb, actual: round(totalGzipKb, 1), asimYuzde: round(asimYuzde, 1) },
      evidence: { olcum: measurements.bundle, butce: bundleBudget },
      suggestedFix: 'Varlıkları (font, görsel) ve kaynak haritalarını gözden geçir.',
      frequencyOverride: clamp01(asimYuzde / 50),
      autoFixable: false,
    });
  }

  // 2 ve 3. Ekran açılışı ve sorgu sayısı
  for (const m of measurements?.screens ?? []) {
    const budget = budgetForScreen(m.screen, budgets);
    if (budget.p75Ms && m.p75Ms > budget.p75Ms) {
      const asimYuzde = ((m.p75Ms - budget.p75Ms) / budget.p75Ms) * 100;
      findings.push({
        id: `perf-acilis-${slug(m.screen)}`,
        subject: `ekran-acilis:${m.screen}`,
        source: 'performans',
        kind: 'perf_budget',
        title: `Açılış bütçesi aşıldı: ${m.screen} ${m.p75Ms} ms > ${budget.p75Ms} ms`,
        detail: `p75 açılış süresi bütçeyi %${asimYuzde.toFixed(0)} aşıyor${budget.ozel ? ` (özel bütçe: ${budget.gerekce})` : ''}.`,
        files: screenToFiles(m.screen),
        metrics: { count: m.p75Ms, sessions: m.sessions ?? 0, budget: budget.p75Ms, actual: m.p75Ms, asimYuzde: round(asimYuzde, 1) },
        evidence: { olcum: m, butce: budget },
        suggestedFix:
          'Ekranın ilk boyamasını ölç: ağır alt bileşenleri `Suspense`/ertelemeli yükleme ile ayır, liste sanallaştırmasını (FlashList) doğrula.',
        frequencyOverride: clamp01(asimYuzde / 100),
      });
    }
    if (budget.queries && m.queries > budget.queries) {
      const fazla = m.queries - budget.queries;
      findings.push({
        id: `perf-sorgu-${slug(m.screen)}`,
        subject: `ekran-sorgu:${m.screen}`,
        source: 'performans',
        kind: 'perf_budget',
        title: `Sorgu bütçesi aşıldı: ${m.screen} ${m.queries} sorgu > ${budget.queries}`,
        detail: `Ekran açılışında ${fazla} fazla istek atılıyor.`,
        files: screenToFiles(m.screen),
        metrics: { count: m.queries, sessions: m.sessions ?? 0, budget: budget.queries, actual: m.queries, fazla },
        evidence: { olcum: m, butce: budget },
        suggestedFix:
          'İstekleri tek bir React Query anahtarında birleştir ya da `staleTime` ile paylaşılan önbelleğe al; N+1 sorgu desenini ara.',
        frequencyOverride: clamp01(fazla / 10),
      });
    }
  }
  return findings;
}

/** Rota adından olası özellik klasörünü tahmin eder. */
function screenToFiles(screen) {
  const seg = String(screen)
    .replace(/^\/?\((app|auth)\)\//, '')
    .split('/')
    .filter((s) => s && !s.startsWith('['))[0];
  return seg ? [`src/features/${seg}/`] : [];
}

/**
 * Ölçümleri toplar: önce gerçek yerel artefaktlar (bundle-size.json + telemetri),
 * eksik kalan kısımlar için fixture.
 */
export async function collectMeasurements({ measurementsPath, useTelemetry = true } = {}) {
  if (measurementsPath) {
    const m = readJsonSafe(measurementsPath);
    if (!m) throw new Error(`Ölçüm dosyası okunamadı: ${measurementsPath}`);
    return { ...m, kaynak: `dosya:${measurementsPath}` };
  }
  const fixture = readJsonSafe(FIXTURE_PATH, {});
  const kaynaklar = [];
  let bundle = fixture.bundle;
  const history = readJsonSafe(join(ROOT, 'docs', 'health', 'bundle-size.json'));
  const last = history?.entries?.at(-1);
  if (last) {
    bundle = { jsGzipBytes: last.jsGzip, totalGzipBytes: last.totalGzip, files: last.files };
    kaynaklar.push('bundle:docs/health/bundle-size.json');
  } else {
    kaynaklar.push('bundle:fixture');
  }

  let screens = fixture.screens ?? [];
  if (useTelemetry) {
    try {
      const { events, window } = await loadTelemetry();
      const slow = groupBySignature(events.filter((e) => e.kind === 'slow_screen'));
      if (slow.length) {
        screens = slow.map((g) => ({
          screen: g.sample.detail.screen,
          p75Ms: g.sample.detail.ms,
          queries: g.sample.detail.queries ?? 0,
          sessions: g.sessions,
        }));
        kaynaklar.push(`ekranlar:telemetri (${window.totalSessions} oturum)`);
      }
    } catch {
      kaynaklar.push('ekranlar:fixture (telemetri okunamadı)');
    }
  }
  return { bundle, screens, kaynak: kaynaklar.join(' · ') };
}

/** Bulguları okunabilir tabloya çevirir. */
export function renderPerfMarkdown(findings, measurements) {
  const lines = [];
  lines.push(`Ölçüm kaynağı: ${measurements.kaynak ?? 'bilinmiyor'}`);
  lines.push('');
  if (findings.length === 0) {
    lines.push('Tüm performans bütçeleri içinde.');
    return lines.join('\n');
  }
  lines.push('| Bütçe | Ölçüm | Sınır | Aşım |');
  lines.push('| --- | ---: | ---: | ---: |');
  for (const f of findings) {
    const m = f.metrics;
    lines.push(`| ${cell(f.title.split(':')[1]?.trim() ?? f.title)} | ${m.actual} | ${m.budget} | ${m.asimYuzde != null ? `%${m.asimYuzde}` : `+${m.fazla}`} |`);
  }
  return lines.join('\n');
}

/* ------------------------------ CLI ------------------------------ */
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const { flag, opt } = parseArgs();
  const budgets = loadBudgets(opt('budgets', BUDGETS_PATH));
  const measurements = await collectMeasurements({ measurementsPath: opt('measurements') });
  const findings = checkBudgets(measurements, budgets);
  if (flag('json')) {
    process.stdout.write(JSON.stringify({ measurements, findings }, null, 2) + '\n');
  } else {
    process.stdout.write(`# Performans nöbeti\n\n${renderPerfMarkdown(findings, measurements)}\n`);
    if (findings.length) {
      process.stdout.write(`\n${findings.length} bütçe aşımı bulundu.\n`);
      for (const f of findings) process.stdout.write(`\n- ${f.title}\n  → ${f.suggestedFix}\n`);
    }
  }
  process.exitCode = findings.length ? 1 : 0;
}
