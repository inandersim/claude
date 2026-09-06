/**
 * Denetlenebilirlik: her otomatik değişiklik docs/health/self/CHANGELOG.md dosyasına
 * **kim / ne / neden / kanıt** olarak yazılır.
 *
 * Kayıt eklenir, asla değiştirilmez ya da silinmez (append-only). Bir kaydı geri almak
 * için yeni bir "geri alındı" kaydı yazılır — geçmiş yeniden yazılmaz.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { OUT_DIR } from './util.mjs';

export const CHANGELOG_PATH = join(OUT_DIR, 'CHANGELOG.md');

/** Günlük dosyasının başlığı (dosya yoksa yazılır). */
export const HEADER = `# Self-heal değişiklik günlüğü

Bu dosyaya **yalnızca ekleme** yapılır. Her satır otomatik hattın (analiz → düzeltme → kanarya)
attığı bir adımı kim/ne/neden/kanıt olarak kaydeder; bir adımı geri almak için yeni bir
"geri alma" kaydı yazılır, eski kayıt silinmez.

Alanlar:

- **kim** — adımı atan ajan ya da betik (\`analyze.mjs\`, \`propose-fix.mjs\`, \`root-cause\`, \`canary.mjs\`, insan kullanıcı adı).
- **ne** — yapılan iş (bir cümle).
- **neden** — hangi bulgu ve hangi ölçüm bunu tetikledi.
- **kanıt** — kırmızı → yeşil test kaydı, rapor yolu, PR/koşu bağlantısı.

`;

/** Bir kaydı Markdown'a çevirir (saf fonksiyon — testler bunu doğrular). */
export function formatAuditEntry({ who, what, why, evidence, findingId, at = new Date().toISOString(), extra = {} }) {
  if (!who || !what || !why) {
    throw new Error('Denetim kaydı eksik: kim (who), ne (what) ve neden (why) zorunludur');
  }
  const lines = [];
  lines.push(`## ${at} — ${what}`);
  lines.push('');
  lines.push(`- **kim:** ${who}`);
  lines.push(`- **ne:** ${what}`);
  lines.push(`- **neden:** ${why}`);
  lines.push(`- **kanıt:** ${evidence || '_kanıt yok_'}`);
  if (findingId) lines.push(`- **bulgu:** \`${findingId}\``);
  for (const [key, value] of Object.entries(extra)) {
    if (value != null && value !== '') lines.push(`- **${key}:** ${value}`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Kaydı CHANGELOG'a ekler (dosya yoksa başlıkla oluşturur).
 * @returns {string} yazılan dosya yolu
 */
export function appendAudit(entry, { path = CHANGELOG_PATH } = {}) {
  const text = formatAuditEntry(entry);
  mkdirSync(dirname(path), { recursive: true });
  if (!existsSync(path)) appendFileSync(path, HEADER);
  appendFileSync(path, text);
  return path;
}

/** Günlükteki kayıt sayısını sayar (denetim için). */
export function countAuditEntries({ path = CHANGELOG_PATH } = {}) {
  if (!existsSync(path)) return 0;
  return (readFileSync(path, 'utf8').match(/^## /gm) ?? []).length;
}
