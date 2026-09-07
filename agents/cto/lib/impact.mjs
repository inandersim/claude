/**
 * Etki analizinin **depoya bakan** tarafı.
 *
 * Modül listesi uydurulmaz; depodan okunur (`src/features/*`, `src/domain/*.ts`,
 * `supabase/migrations/*.sql` içindeki tablo adları). Böylece yeni bir modül
 * eklendiğinde bu dosyayı güncellemek gerekmez ve analiz var olmayan bir modülü
 * gösteremez.
 *
 * Eşleşme kuralları `impact-core.mjs` içindedir; tarayıcıdaki yönetim paneli de
 * onu kullanır, böylece kuralın ikinci bir uygulaması olmaz.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { analyzeImpact as analyzeImpactCore } from './impact-core.mjs';
import { ROOT } from './policy.mjs';

export { ALIASES, containsTerm } from './impact-core.mjs';

/** Deponun gerçek modül listesi. */
export function listModules(root = ROOT) {
  const featureDir = resolve(root, 'src', 'features');
  const features = existsSync(featureDir)
    ? readdirSync(featureDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];
  const domainDir = resolve(root, 'src', 'domain');
  const domains = existsSync(domainDir)
    ? readdirSync(domainDir)
        .filter((f) => f.endsWith('.ts') && !['index.ts', 'types.ts', 'enums.ts'].includes(f))
        .map((f) => f.replace(/\.ts$/, ''))
    : [];
  return [...new Set([...features, ...domains])].sort();
}

/** Şemadaki tablo adları (migration dosyalarındaki `CREATE TABLE`'lardan). */
export function listTables(root = ROOT) {
  const dir = resolve(root, 'supabase', 'migrations');
  if (!existsSync(dir)) return [];
  const names = new Set();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(join(dir, file), 'utf8');
    for (const m of sql.matchAll(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"?([a-z0-9_]+)"?/gi)) {
      names.add(m[1].toLowerCase());
    }
  }
  return [...names].sort();
}

/** Depo listelerini okuyup saf çekirdeğe geçirir. */
export function analyzeImpact(
  text,
  { root = ROOT, modules = listModules(root), tables = listTables(root) } = {},
) {
  return analyzeImpactCore(text, { modules, tables });
}

/** Etkilenen modüllerden olası dosya yollarını türetir (kaba, plan için yeterli). */
export function likelyPaths(modules, { root = ROOT } = {}) {
  const paths = [];
  for (const m of modules) {
    if (existsSync(resolve(root, 'src', 'features', m))) paths.push(`src/features/${m}/**`);
    if (existsSync(resolve(root, 'src', 'domain', `${m}.ts`))) paths.push(`src/domain/${m}.ts`);
    if (existsSync(resolve(root, 'src', 'app', '(app)', m))) paths.push(`src/app/(app)/${m}/**`);
  }
  return [...new Set(paths)].sort();
}
