/**
 * Node module hook: `@/` takma adını `src/` altına çözer ve uzantısız
 * göreli TypeScript içe aktarımlarını (.ts / .tsx / index.ts) tamamlar.
 * Tip silme işini Node'un kendi `--experimental-transform-types` desteği yapar;
 * ek bağımlılık gerekmez.
 */
import { statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT =
  process.env.ZIRVE_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function isFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

function withExtension(base) {
  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')];
  return candidates.find(isFile) ?? null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const found = withExtension(path.join(ROOT, 'src', specifier.slice(2)));
    if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
  }
  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    context.parentURL?.startsWith('file:')
  ) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const found = withExtension(path.resolve(parentDir, specifier));
    if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
