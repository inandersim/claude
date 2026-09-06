#!/usr/bin/env node
/**
 * Otomatik düzeltme hattı (bağımlılıksız, Node 22).
 *
 * Akış:  bulgu → görev tarifi (plan) → [ajan düzeltmeyi uygular] → kapılar (verify) → taslak PR (pr)
 *
 * Bu betik **kodu kendisi yazmaz**. Düzeltmeyi `root-cause` ajanı (ya da insan) çalışma
 * ağacında uygular; betik yalnızca kapıları işletir ve yalnızca hepsi yeşilse PR açar.
 * Böylece "düzeltmeyi yapan" ile "düzeltmeyi onaylayan" ayrı kalır.
 *
 * Kapılar (hepsi zorunlu, atlanamaz):
 *   1. Yetki    — değişen her dosya ALLOW listesinde, hiçbiri DENY listesinde olmayacak (lib/risk.mjs)
 *   2. Kalkan   — diff'te test atlama/silme/yumuşatma olmayacak (guard.mjs scan-diff)
 *   3. Kanıt    — bulguya ait kırmızı → yeşil test kanıtı olacak (guard.mjs verify)
 *   4. Doğrulama— `npm run lint` + `npm run typecheck` + `npm test` üçü de geçecek
 *
 * Riskli alan (ödeme / SOS / kimlik) dokunulmuşsa PR `needs-human` etiketiyle ve taslak
 * olarak açılır, otomatik birleştirilmez.
 *
 * Kullanım:
 *   node agents/selfheal/propose-fix.mjs plan   --finding <id> [--report <dosya>]
 *   node agents/selfheal/propose-fix.mjs verify --finding <id> [--base origin/main]
 *   node agents/selfheal/propose-fix.mjs pr     --finding <id> [--base origin/main] [--dry-run]
 */
import { spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { parseArgs, readJsonSafe, ROOT, OUT_DIR, today } from './lib/util.mjs';
import { assessChangeSet, ALLOW, DENY } from './lib/risk.mjs';
import { detectTestTampering, verifyFinding, evidencePath } from './guard.mjs';
import { appendAudit } from './lib/audit.mjs';

/** Zorunlu doğrulama komutları — bu liste betikte sabittir, bayrakla atlanamaz. */
export const GATE_COMMANDS = [
  { id: 'lint', cmd: 'npm run lint -- --max-warnings=0' },
  { id: 'typecheck', cmd: 'npm run typecheck' },
  { id: 'test', cmd: 'npm test -- --ci' },
];

function sh(args, { capture = true } = {}) {
  const r = spawnSync(args[0], args.slice(1), {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: capture ? 'pipe' : 'inherit',
  });
  return { code: r.status ?? 1, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
}

function run(cmd) {
  const started = Date.now();
  const r = spawnSync(cmd, {
    cwd: ROOT,
    shell: true,
    encoding: 'utf8',
    env: { ...process.env, CI: '1', FORCE_COLOR: '0', NO_COLOR: '1' },
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
  return {
    code: r.status ?? 1,
    durationMs: Date.now() - started,
    tail: output.trimEnd().split('\n').slice(-25).join('\n'),
  };
}

/** Analiz raporundan bulguyu bulur. */
export function findFinding(findingId, reportPath = join(OUT_DIR, 'latest.json')) {
  const report = readJsonSafe(reportPath);
  if (!report) throw new Error(`Analiz raporu okunamadı: ${reportPath} — önce analyze.mjs çalıştır`);
  const finding = report.findings?.find((f) => f.id === findingId);
  if (!finding) {
    const ids = (report.findings ?? []).slice(0, 10).map((f) => f.id);
    throw new Error(`Bulgu yok: ${findingId}\nRapordaki ilk kimlikler:\n  ${ids.join('\n  ')}`);
  }
  return { report, finding };
}

/** Değişen dosyalar (çalışma ağacı + hazırlık alanı, ya da base'e göre). */
export function changedFiles(base) {
  const args = base ? ['diff', '--name-only', `${base}...HEAD`] : ['diff', '--name-only', 'HEAD'];
  const tracked = sh(['git', ...args]).out.split('\n').filter(Boolean);
  const untracked = sh(['git', 'ls-files', '--others', '--exclude-standard']).out.split('\n').filter(Boolean);
  return [...new Set([...tracked, ...untracked])];
}

/** Diff metni (kapı 2 için). */
function diffText(base) {
  const args = base ? ['diff', `${base}...HEAD`] : ['diff', 'HEAD'];
  return sh(['git', ...args]).out;
}

/** Görev tarifi: ajanın ne yapıp ne yapamayacağı. */
export function renderPlan(finding, report) {
  const lines = [];
  lines.push(`# Düzeltme görevi — ${finding.id}`);
  lines.push('');
  lines.push(`**Bulgu:** ${finding.title}`);
  lines.push(`**Önem:** ${finding.severity} · **puan:** ${finding.score} · **kaynak:** ${finding.source}`);
  if (finding.detail) lines.push(`**Ölçüm:** ${finding.detail}`);
  if (finding.evidence?.frame) lines.push(`**Yığın izi karesi:** \`${finding.evidence.frame}\``);
  lines.push(`**Önerilen yön:** ${finding.suggestedFix}`);
  lines.push('');
  lines.push('## Dokunabileceğin dosyalar');
  lines.push('');
  lines.push(
    finding.files?.length
      ? finding.files.map((f) => `- \`${f}\``).join('\n')
      : '- (bulgu dosya göstermiyor — önce kök nedeni bul, sonra kapsamı daralt)',
  );
  lines.push('');
  lines.push('İzin listesi (bunun dışına çıkan değişiklik PR\'ı reddettirir):');
  lines.push('');
  for (const a of ALLOW) lines.push(`- \`${a}\``);
  lines.push('');
  lines.push('Kesinlikle dokunulamaz:');
  lines.push('');
  for (const d of DENY.slice(0, 8)) lines.push(`- \`${d.pattern}\` — ${d.reason}`);
  lines.push('- (tam liste: `agents/selfheal/lib/risk.mjs`)');
  lines.push('');
  if (finding.risky) {
    lines.push(`## ⚠ RİSKLİ ALAN — ${finding.riskCategories.join(', ')}`);
    lines.push('');
    lines.push(
      'Bu bulgu ödeme / can güvenliği / kimlik alanına dokunuyor. Düzeltme yine hazırlanır ama PR ' +
        '`needs-human` etiketiyle **taslak** olarak açılır, otomatik birleştirilmez ve kanarya aşamaları zorunludur.',
    );
    lines.push('');
  }
  lines.push('## Zorunlu sıra (regresyon kalkanı)');
  lines.push('');
  lines.push('```bash');
  lines.push(`# 1. ÖNCE hatayı gösteren testi yaz, kırmızı olduğunu kanıtla`);
  lines.push(`node agents/selfheal/guard.mjs record --finding ${finding.id} --test <test-dosyasi> --phase red`);
  lines.push('# 2. En küçük düzeltmeyi uygula');
  lines.push('# 3. Testin geçtiğini kanıtla');
  lines.push(`node agents/selfheal/guard.mjs record --finding ${finding.id} --test <test-dosyasi> --phase green`);
  lines.push('# 4. Kapıları çalıştır ve taslak PR aç');
  lines.push(`node agents/selfheal/propose-fix.mjs pr --finding ${finding.id}`);
  lines.push('```');
  lines.push('');
  lines.push('## Yasaklar');
  lines.push('');
  lines.push('- Test atlama/silme/yumuşatma yok: `it.skip`, `xit`, `test.todo`, `.only`, `--passWithNoTests`.');
  lines.push('- `@ts-ignore`, `@ts-nocheck`, `eslint-disable` ile hata gizleme yok.');
  lines.push('- Kanıt (kırmızı → yeşil) olmadan PR açılmaz — betik reddeder.');
  lines.push('- Belirtiyi değil kök nedeni düzelt; en küçük değişikliği yap.');
  lines.push('');
  lines.push(`_Rapor: docs/health/self/${report?.date ?? today()}.md_`);
  return lines.join('\n');
}

/** Dört kapıyı sırayla işletir. */
export function runGates(findingId, { base, skipChecks = false } = {}) {
  const gates = [];
  const files = changedFiles(base);

  // Kapı 1 — yetki
  const assessment = assessChangeSet(files);
  gates.push({
    id: 'yetki',
    ok: assessment.ok,
    detail: files.length ? assessment.summary : 'değişiklik yok',
    errors: [
      ...assessment.denied.map((f) => `YASAK: ${f.path} (${f.denyReason})`),
      ...assessment.outsideAllow.map((f) => `İZİN LİSTESİ DIŞI: ${f.path}`),
      ...(files.length === 0 ? ['çalışma ağacında değişiklik yok — düzeltme uygulanmamış'] : []),
    ],
  });

  // Kapı 2 — regresyon kalkanı (test yumuşatma)
  const tamper = detectTestTampering(diffText(base));
  gates.push({
    id: 'kalkan',
    ok: tamper.ok,
    detail: tamper.ok ? 'test yumuşatma yok' : `${tamper.violations.length} ihlal`,
    errors: tamper.violations.map((v) => `${v.file}: ${v.reason}${v.line ? ` → ${v.line}` : ''}`),
    warnings: tamper.warnings,
  });

  // Kapı 3 — kırmızı → yeşil kanıtı
  const evidence = verifyFinding(findingId);
  gates.push({
    id: 'kanit',
    ok: evidence.ok,
    detail: evidence.ok
      ? `${evidence.evidence.testFile} (kırmızı ${evidence.evidence.red.exitCode} → yeşil ${evidence.evidence.green.exitCode})`
      : 'kanıt yok ya da geçersiz',
    errors: evidence.errors,
  });

  // Kapı 4 — lint + typecheck + test
  if (skipChecks) {
    gates.push({ id: 'dogrulama', ok: false, detail: 'ATLANDI (--skip-checks) — PR açılamaz', errors: ['doğrulama atlandı'] });
  } else {
    for (const g of GATE_COMMANDS) {
      const r = run(g.cmd);
      gates.push({
        id: `dogrulama:${g.id}`,
        ok: r.code === 0,
        detail: `${g.cmd} (${(r.durationMs / 1000).toFixed(1)}s)`,
        errors: r.code === 0 ? [] : [r.tail],
      });
    }
  }

  return { ok: gates.every((g) => g.ok), gates, files, assessment, evidence: evidence.evidence };
}

function printGates(result) {
  process.stdout.write('\nKapılar:\n');
  for (const g of result.gates) {
    process.stdout.write(`  ${g.ok ? '✅' : '❌'} ${g.id.padEnd(20)} ${g.detail}\n`);
    for (const e of g.errors ?? []) process.stdout.write(`       ${String(e).split('\n')[0]}\n`);
    for (const w of g.warnings ?? []) process.stdout.write(`       uyarı: ${w}\n`);
  }
  process.stdout.write(`\nSonuç: ${result.ok ? 'TÜM KAPILAR YEŞİL' : 'KAPI KIRMIZI — PR açılmaz'}\n`);
}

/* ------------------------------ CLI ------------------------------ */
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const { command, opt, flag } = parseArgs();
  const findingId = opt('finding');
  const base = opt('base');

  if (!command || flag('help')) {
    process.stdout.write(
      [
        'Otomatik düzeltme hattı — kapılar yeşil olmadan PR açılmaz.',
        '',
        '  plan   --finding <id>   düzeltme görevini (yetki + zorunlu sıra) yazdır',
        '  verify --finding <id>   dört kapıyı çalıştır, PR açma',
        '  pr     --finding <id>   kapılar yeşilse taslak PR aç ve denetim kaydı yaz',
        '',
        'Ortak: --report <dosya> --base <ref> --dry-run',
      ].join('\n') + '\n',
    );
    process.exit(0);
  }
  if (!findingId) {
    process.stderr.write('--finding <id> zorunlu\n');
    process.exit(2);
  }

  if (command === 'plan') {
    const { report, finding } = findFinding(findingId, opt('report', join(OUT_DIR, 'latest.json')));
    process.stdout.write(renderPlan(finding, report) + '\n');
    if (finding.autoFixable === false) {
      process.stderr.write(
        '\nUYARI: bu bulgu otomatik düzeltmeye uygun değil (insan ya da ürün kararı). Yine de tarif yazdırıldı.\n',
      );
      process.exitCode = 1;
    }
    process.exit(process.exitCode ?? 0);
  }

  if (command === 'verify') {
    const result = runGates(findingId, { base, skipChecks: flag('skip-checks') });
    printGates(result);
    process.exitCode = result.ok ? 0 : 1;
    process.exit(process.exitCode);
  }

  if (command === 'pr') {
    const { report, finding } = findFinding(findingId, opt('report', join(OUT_DIR, 'latest.json')));
    const result = runGates(findingId, { base });
    printGates(result);
    if (!result.ok) {
      process.stderr.write('\nPR AÇILMADI: en az bir kapı kırmızı. Kapıları atlamanın yolu yoktur.\n');
      process.exit(1);
    }

    const needsHuman = result.assessment.needsHuman;
    const branch = `selfheal/${today()}-${findingId}`.slice(0, 80);
    const title = `fix(selfheal): ${finding.title}`.slice(0, 100);
    const body = [
      `Otomatik düzeltme — bulgu \`${findingId}\` (puan ${finding.score}, önem ${finding.severity}).`,
      '',
      `**Ölçüm:** ${finding.detail}`,
      `**Kaynak:** ${finding.source} · rapor \`docs/health/self/${report.date}.md\``,
      '',
      '**Regresyon kanıtı (kırmızı → yeşil):**',
      `- test: \`${result.evidence.testFile}\``,
      `- kırmızı: ${result.evidence.red.at} (çıkış ${result.evidence.red.exitCode}, \`${result.evidence.red.commit ?? '?'}\`)`,
      `- yeşil: ${result.evidence.green.at} (çıkış ${result.evidence.green.exitCode}, \`${result.evidence.green.commit ?? '?'}\`)`,
      '',
      `**Değişen dosyalar:** ${result.files.map((f) => `\`${f}\``).join(', ')}`,
      `**Kapılar:** ${result.gates.map((g) => `${g.id} ✅`).join(' · ')}`,
      '',
      needsHuman
        ? `> ⚠ **needs-human** — bu değişiklik riskli alana dokunuyor (${result.assessment.riskCategories.join(', ')}). ` +
          'Otomatik birleştirilmez; bir bakımcı incelemeli ve kanarya aşamaları izlenmelidir.'
        : '> Kapılar yeşil. Birleştirme kararı yine de insana aittir.',
      '',
      '🤖 `agents/selfheal/propose-fix.mjs` tarafından hazırlandı.',
    ].join('\n');

    if (flag('dry-run')) {
      process.stdout.write(`\n[kuru çalışma] dal: ${branch}\nbaşlık: ${title}\netiketler: self-heal${needsHuman ? ', needs-human' : ''}\n\n${body}\n`);
      process.exit(0);
    }

    sh(['git', 'config', 'user.name', 'zirtan-selfheal-bot']);
    sh(['git', 'config', 'user.email', 'selfheal-bot@users.noreply.github.com']);
    sh(['git', 'checkout', '-B', branch]);
    sh(['git', 'add', ...result.files]);
    const commitMsg = `fix(selfheal): ${finding.title}`.slice(0, 72);
    const commit = sh(['git', 'commit', '-m', commitMsg, '-m', `Bulgu: ${findingId}\nKanıt: ${relative(ROOT, evidencePath(findingId))}`]);
    if (commit.code !== 0) {
      process.stderr.write(`commit başarısız:\n${commit.err || commit.out}\n`);
      process.exit(1);
    }
    const push = sh(['git', 'push', '-f', 'origin', branch]);
    if (push.code !== 0) {
      process.stderr.write(`push başarısız:\n${push.err}\n`);
      process.exit(1);
    }
    const labels = needsHuman ? 'self-heal,needs-human' : 'self-heal';
    const pr = sh(['gh', 'pr', 'create', '--draft', '--head', branch, '--title', title, '--body', body, '--label', labels]);
    const prUrl = pr.code === 0 ? pr.out.split('\n').pop() : null;
    if (pr.code !== 0) process.stderr.write(`gh pr create uyarı: ${pr.err}\n`);

    appendAudit({
      who: 'propose-fix.mjs (self-heal hattı)',
      what: `Taslak PR açıldı: ${title}`,
      why: `${finding.source} bulgusu \`${findingId}\` — ${finding.detail} (önem ${finding.severity}, puan ${finding.score})`,
      evidence: `kırmızı→yeşil \`${result.evidence.testFile}\` · kapılar: ${result.gates.map((g) => g.id).join(', ')} · ${prUrl ?? branch}`,
      findingId,
      extra: {
        dal: branch,
        'değişen dosyalar': result.files.join(', '),
        'insan onayı': needsHuman ? `evet (${result.assessment.riskCategories.join(', ')})` : 'hayır',
      },
    });
    process.stdout.write(`\nTaslak PR: ${prUrl ?? '(gh yok — dal itildi: ' + branch + ')'}\nDenetim kaydı: docs/health/self/CHANGELOG.md\n`);
    process.exit(0);
  }

  process.stderr.write(`Bilinmeyen komut: ${command}\n`);
  process.exit(2);
}
