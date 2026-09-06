#!/usr/bin/env node
/**
 * Regresyon kalkanı (bağımlılıksız, Node 22).
 *
 * Kural: her otomatik düzeltme için önce **başarısız olan bir test** yazılır.
 * Kanıt zinciri (kırmızı → yeşil) olmadan `propose-fix.mjs` PR açmaz.
 *
 * Kanıt dosyası: docs/health/self/evidence/<bulguId>.json
 *   {
 *     "findingId": "...",
 *     "testFile": "src/domain/__tests__/x.test.ts",
 *     "command": "npm test -- --ci src/domain/__tests__/x.test.ts",
 *     "red":   { "at": "...", "exitCode": 1, "commit": "abc1234", "tail": "..." },
 *     "green": { "at": "...", "exitCode": 0, "commit": "def5678", "tail": "..." }
 *   }
 *
 * Kırmızı kayıt düzeltmeden ÖNCE, yeşil kayıt düzeltmeden SONRA alınır. Kırmızı adım
 * gerçekten başarısız olmazsa kayıt reddedilir — "zaten geçen" bir test kanıt sayılmaz.
 *
 * Kullanım:
 *   node agents/selfheal/guard.mjs record --finding <id> --test <dosya> --phase red|green [--cmd "..."]
 *   node agents/selfheal/guard.mjs verify --finding <id>
 *   node agents/selfheal/guard.mjs scan-diff [--base origin/main]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs, readJsonSafe, writeJson, ROOT, OUT_DIR } from './lib/util.mjs';

export const EVIDENCE_DIR = join(OUT_DIR, 'evidence');

/** Bir bulgunun kanıt dosyası yolu. */
export function evidencePath(findingId) {
  return join(EVIDENCE_DIR, `${String(findingId).replace(/[^\w.-]/g, '_')}.json`);
}

/** Test dosyası gibi görünüyor mu? */
export function isTestFile(path) {
  const p = String(path).replace(/\\/g, '/');
  return /(^|\/)__tests__\//.test(p) || /\.test\.[jt]sx?$/.test(p) || /\.test\.mjs$/.test(p);
}

/**
 * Kanıt zincirini doğrular. Saf fonksiyon — dosya sistemi okumaz.
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateEvidence(evidence) {
  const errors = [];
  if (!evidence || typeof evidence !== 'object') {
    return { ok: false, errors: ['kanıt dosyası yok ya da okunamadı'] };
  }
  if (!evidence.findingId) errors.push('findingId eksik');
  if (!evidence.testFile) errors.push('testFile eksik');
  else if (!isTestFile(evidence.testFile)) {
    errors.push(`testFile bir test dosyası değil: ${evidence.testFile}`);
  }
  if (!evidence.command) errors.push('command eksik (hangi komutun koşturulduğu kayıtlı değil)');

  const red = evidence.red;
  const green = evidence.green;
  if (!red) errors.push('kırmızı kayıt yok — düzeltmeden önce başarısız olan test çalıştırılmamış');
  if (!green) errors.push('yeşil kayıt yok — düzeltmeden sonra test çalıştırılmamış');

  if (red && green) {
    if (red.exitCode === 0) {
      errors.push('kırmızı adım başarılı olmuş (exitCode 0) — test düzeltmeden önce de geçiyordu, kanıt geçersiz');
    }
    if (green.exitCode !== 0) {
      errors.push(`yeşil adım başarısız (exitCode ${green.exitCode}) — düzeltme testi geçirmiyor`);
    }
    const redAt = Date.parse(red.at ?? '');
    const greenAt = Date.parse(green.at ?? '');
    if (!Number.isFinite(redAt) || !Number.isFinite(greenAt)) {
      errors.push('kayıt zaman damgaları okunamadı');
    } else if (greenAt <= redAt) {
      errors.push('yeşil kayıt kırmızıdan önce ya da aynı anda alınmış — sıra bozuk');
    }
    if (red.testFile && green.testFile && red.testFile !== green.testFile) {
      errors.push('kırmızı ve yeşil kayıtlar farklı test dosyalarına ait');
    }
    if (red.command && green.command && red.command !== green.command) {
      errors.push('kırmızı ve yeşil kayıtlar farklı komutlarla alınmış');
    }
  }
  return { ok: errors.length === 0, errors };
}

const TAMPER_RULES = [
  { rx: /\b(it|test|describe)\.skip\s*\(/, reason: 'test atlanmış (.skip)' },
  { rx: /\b(xit|xdescribe|xtest)\s*\(/, reason: 'test atlanmış (x-önekli)' },
  { rx: /\b(it|test)\.todo\s*\(/, reason: 'test todo bırakılmış' },
  { rx: /--passWithNoTests/, reason: 'test yokken geçme bayrağı eklenmiş' },
  { rx: /@ts-(ignore|nocheck)/, reason: 'tip denetimi susturulmuş' },
  { rx: /eslint-disable(?!-next-line\s+@typescript-eslint\/no-unused-vars\b)/, reason: 'lint kuralı susturulmuş' },
  { rx: /\.only\s*\(/, reason: 'yalnızca tek test koşturulacak şekilde bırakılmış (.only)' },
];

/**
 * Birleşik diff metnini tarar: eklenen satırlarda test yumuşatma, silinen test dosyası,
 * azalan `expect(` sayısı. Saf fonksiyon.
 *
 * @param {string} diffText  `git diff -U0` ya da `git diff` çıktısı
 * @returns {{ok:boolean, violations:{file:string, line:string, reason:string}[], warnings:string[]}}
 */
export function detectTestTampering(diffText = '') {
  const violations = [];
  const warnings = [];
  let file = '(bilinmiyor)';
  let deletedTarget = null;
  let expectAdded = 0;
  let expectRemoved = 0;

  for (const raw of String(diffText).split('\n')) {
    if (raw.startsWith('diff --git')) {
      const m = raw.match(/ b\/(.+)$/);
      file = m ? m[1] : '(bilinmiyor)';
      deletedTarget = null;
      continue;
    }
    if (raw.startsWith('--- ')) continue;
    if (raw.startsWith('+++ ')) {
      deletedTarget = raw.trim() === '+++ /dev/null';
      if (deletedTarget && isTestFile(file)) {
        violations.push({ file, line: '', reason: 'test dosyası silinmiş' });
      }
      continue;
    }
    if (raw.startsWith('+') && !raw.startsWith('+++')) {
      const line = raw.slice(1);
      for (const rule of TAMPER_RULES) {
        if (rule.rx.test(line)) violations.push({ file, line: line.trim().slice(0, 160), reason: rule.reason });
      }
      if (/\bexpect\s*\(/.test(line)) expectAdded++;
      if (/\bjest\.mock\s*\(/.test(line) && !isTestFile(file)) {
        warnings.push(`${file}: üretim kodunda jest.mock — gözden geçir`);
      }
    } else if (raw.startsWith('-') && !raw.startsWith('---')) {
      const line = raw.slice(1);
      if (/\bexpect\s*\(/.test(line)) expectRemoved++;
    }
  }
  if (expectRemoved > expectAdded) {
    violations.push({
      file: '(diff geneli)',
      line: `-${expectRemoved} / +${expectAdded} expect()`,
      reason: 'net olarak beklenti (assertion) silinmiş — testler yumuşatılmış olabilir',
    });
  }
  return { ok: violations.length === 0, violations, warnings };
}

/** Kanıt dosyasını okur. */
export function readEvidence(findingId) {
  return readJsonSafe(evidencePath(findingId));
}

/** Kanıt dosyasını okur, doğrular ve test dosyasının hâlâ var/dolu olduğunu kontrol eder. */
export function verifyFinding(findingId, { root = ROOT } = {}) {
  const evidence = readEvidence(findingId);
  const { ok, errors } = validateEvidence(evidence);
  const allErrors = [...errors];
  if (evidence?.testFile) {
    const abs = join(root, evidence.testFile);
    if (!existsSync(abs)) allErrors.push(`kanıttaki test dosyası artık yok: ${evidence.testFile}`);
    else if (statSync(abs).size < 40) allErrors.push(`kanıttaki test dosyası boşaltılmış: ${evidence.testFile}`);
  }
  return { ok: allErrors.length === 0, errors: allErrors, evidence };
}

/* ------------------------------ CLI ------------------------------ */
function gitRef() {
  return (
    spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout?.trim() || null
  );
}

function runTest(command) {
  const started = Date.now();
  const r = spawnSync(command, {
    cwd: ROOT,
    shell: true,
    encoding: 'utf8',
    env: { ...process.env, CI: '1', FORCE_COLOR: '0', NO_COLOR: '1' },
    maxBuffer: 32 * 1024 * 1024,
  });
  const output = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
  return {
    at: new Date().toISOString(),
    exitCode: r.status ?? 1,
    durationMs: Date.now() - started,
    commit: gitRef(),
    tail: output.trimEnd().split('\n').slice(-25).join('\n'),
  };
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const { command, opt, flag } = parseArgs();
  const findingId = opt('finding');

  if (command === 'record') {
    const testFile = opt('test');
    const phase = opt('phase');
    if (!findingId || !testFile || !['red', 'green'].includes(phase)) {
      process.stderr.write('Kullanım: guard.mjs record --finding <id> --test <dosya> --phase red|green [--cmd "..."]\n');
      process.exit(2);
    }
    if (!isTestFile(testFile)) {
      process.stderr.write(`HATA: ${testFile} bir test dosyası değil. Kanıt yalnızca test dosyasıyla verilir.\n`);
      process.exit(1);
    }
    if (!existsSync(join(ROOT, testFile))) {
      process.stderr.write(`HATA: test dosyası bulunamadı: ${testFile}\n`);
      process.exit(1);
    }
    const cmd = opt('cmd', `npm test -- --ci ${testFile}`);
    process.stdout.write(`▶ [${phase}] ${cmd}\n`);
    const result = runTest(cmd);

    if (phase === 'red' && result.exitCode === 0) {
      process.stderr.write(
        '\nHATA: kırmızı adımda test GEÇTİ. Kanıt reddedildi.\n' +
          'Önce hatayı gösteren (başarısız olan) bir test yaz; kalkanın amacı budur.\n',
      );
      process.exit(1);
    }
    if (phase === 'green' && result.exitCode !== 0) {
      process.stderr.write(`\nHATA: yeşil adımda test BAŞARISIZ (kod ${result.exitCode}). Düzeltme tamamlanmamış.\n`);
      process.stderr.write(result.tail + '\n');
      process.exit(1);
    }

    const existing = readEvidence(findingId) ?? { findingId, testFile, command: cmd };
    if (phase === 'green' && !existing.red) {
      process.stderr.write('\nHATA: kırmızı kayıt olmadan yeşil kayıt alınamaz (kırmızı → yeşil sırası zorunlu).\n');
      process.exit(1);
    }
    const evidence = {
      ...existing,
      findingId,
      testFile,
      command: cmd,
      [phase]: { ...result, testFile, command: cmd },
    };
    const path = writeJson(evidencePath(findingId), evidence);
    process.stdout.write(`\n[${phase}] kaydedildi (kod ${result.exitCode}) → ${path}\n`);
    if (phase === 'green') {
      const v = validateEvidence(evidence);
      process.stdout.write(v.ok ? 'Kanıt zinciri tamam: kırmızı → yeşil.\n' : `UYARI: ${v.errors.join('; ')}\n`);
      process.exitCode = v.ok ? 0 : 1;
    }
  } else if (command === 'verify') {
    if (!findingId) {
      process.stderr.write('Kullanım: guard.mjs verify --finding <id>\n');
      process.exit(2);
    }
    const { ok, errors, evidence } = verifyFinding(findingId);
    if (ok) {
      process.stdout.write(
        `Kanıt geçerli: ${evidence.testFile}\n  kırmızı ${evidence.red.at} (kod ${evidence.red.exitCode}, ${evidence.red.commit ?? '?'})\n  yeşil   ${evidence.green.at} (kod ${evidence.green.exitCode}, ${evidence.green.commit ?? '?'})\n`,
      );
    } else {
      process.stderr.write(`Kanıt GEÇERSİZ (${findingId}):\n${errors.map((e) => `  - ${e}`).join('\n')}\n`);
    }
    process.exitCode = ok ? 0 : 1;
  } else if (command === 'scan-diff') {
    const base = opt('base');
    const args = base ? ['diff', `${base}...HEAD`] : ['diff', 'HEAD'];
    const diff = opt('file')
      ? readFileSync(opt('file'), 'utf8')
      : (spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout ?? '');
    const { ok, violations, warnings } = detectTestTampering(diff);
    if (violations.length) {
      process.stderr.write('Test yumuşatma tespit edildi:\n');
      for (const v of violations) process.stderr.write(`  - ${v.file}: ${v.reason}${v.line ? ` → ${v.line}` : ''}\n`);
    } else {
      process.stdout.write('Test yumuşatma yok.\n');
    }
    for (const w of warnings) process.stdout.write(`  uyarı: ${w}\n`);
    process.exitCode = ok ? 0 : 1;
  } else {
    process.stdout.write(
      [
        'Regresyon kalkanı — kırmızı → yeşil kanıtı olmadan düzeltme PR açılmaz.',
        '',
        '  record --finding <id> --test <dosya> --phase red    düzeltmeden ÖNCE (test başarısız olmalı)',
        '  record --finding <id> --test <dosya> --phase green  düzeltmeden SONRA (test geçmeli)',
        '  verify --finding <id>                               kanıt zincirini doğrula',
        '  scan-diff [--base origin/main] [--file <diff>]      test atlama/silme taraması',
        '',
        `Kanıt klasörü: ${EVIDENCE_DIR}`,
      ].join('\n') + '\n',
    );
    if (flag('help') || !command) process.exitCode = 0;
  }
}
