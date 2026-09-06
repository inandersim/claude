/**
 * Self-heal betikleri için ortak yardımcılar (bağımlılıksız, Node 22).
 *
 * Buradaki her şey saf ve yan etkisizdir; dosya yazan tek fonksiyon `writeJson`/`writeText`.
 * Ağ çağrısı yoktur — ağ yalnızca lib/telemetry.mjs içinde, yalnızca ZIRTAN_TELEMETRY_URL
 * verildiğinde ve yalnızca GET olarak yapılır.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Depo kökü (agents/selfheal/lib → ../../..). */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** `agents/selfheal` klasörü. */
export const SELFHEAL_DIR = resolve(ROOT, 'agents', 'selfheal');

/** Raporların yazıldığı klasör. */
export const OUT_DIR = resolve(ROOT, 'docs', 'health', 'self');

/**
 * `--flag`, `--key=value` ve `--key value` biçimlerini okuyan basit argüman ayrıştırıcı.
 * agents/devops betikleriyle aynı sözleşme.
 */
export function parseArgs(argv = process.argv.slice(2)) {
  const flag = (name) => argv.includes(`--${name}`);
  const opt = (name, fallback) => {
    const eq = argv.find((a) => a.startsWith(`--${name}=`));
    if (eq) return eq.slice(name.length + 3);
    const i = argv.indexOf(`--${name}`);
    if (i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
    return fallback;
  };
  const positional = argv.filter((a) => !a.startsWith('--'));
  return { argv, flag, opt, positional, command: positional[0] };
}

/** Bugünün UTC tarihi (YYYY-MM-DD). */
export function today(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** JSON dosyasını okur; yoksa ya da bozuksa `fallback` döner (asla fırlatmaz). */
export function readJsonSafe(path, fallback = null) {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

/** JSON'u klasörünü oluşturarak yazar. */
export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
  return path;
}

/** Metni klasörünü oluşturarak yazar. */
export function writeText(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text.endsWith('\n') ? text : text + '\n');
  return path;
}

/** 0..1 aralığına kırpar. */
export function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * Logaritmik normalizasyon: 0 → 0, `soft` → ~0.5, çok büyük → 1'e yaklaşır.
 * Sıklık puanında az sayıda uç olayın skoru domine etmesini engeller.
 */
export function logNorm(value, soft = 1) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return clamp01(Math.log1p(value) / Math.log1p(soft * 2 || 2));
}

/**
 * Oran tabanlı logaritmik normalizasyon: "toplamın kaçta kaçı etkilendi" sorusunu
 * 0..1 aralığına taşır. `k` eğriyi belirler (varsayılan 1000):
 *   %0.1 → ~0.10 · %1 → ~0.35 · %10 → ~0.70 · %50 → ~0.90 · %100 → 1
 * Doğrudan orana göre üstünlük sağlar: küçük ama gerçek etkiler görünür kalır,
 * büyük olaylar da listeyi tek başına domine etmez.
 */
export function ratioNorm(part, total, k = 1000) {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0 || part <= 0) return 0;
  const ratio = Math.min(1, part / total);
  return clamp01(Math.log1p(ratio * k) / Math.log1p(k));
}

/** Yuvarlama (varsayılan 3 basamak). */
export function round(n, digits = 3) {
  const f = 10 ** digits;
  return Math.round((Number(n) || 0) * f) / f;
}

/** Bayt → okunabilir KB. */
export function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Kararlı, kısa özet (id üretmek için). Kriptografik değildir; yalnızca
 * aynı girdinin aynı bulgu kimliğini üretmesi için kullanılır.
 */
export function slug(text, max = 48) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '');
}

/** Markdown tablo hücresinde boru işaretini kaçırır. */
export function cell(text) {
  return String(text ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
