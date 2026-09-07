#!/usr/bin/env node
/**
 * Talebi ajanlara devreder — boru hattının eksik halkası.
 *
 *   node agents/cto/dispatch.mjs --request <id>         # GitHub issue aç
 *   node agents/cto/dispatch.mjs --request <id> --dry   # yalnızca gövdeyi yazdır
 *
 * Talep kaydını, ajanın çalışabileceği bir **görev tarifine** çevirir ve
 * `ai-cto` etiketli bir GitHub issue açar. `.github/workflows/cto-dispatch.yml`
 * o issue'yu görünce Claude Code'u çalıştırır; sonuç taslak PR olarak döner.
 *
 * Kapı: **insan onayı gerektiren bir talep, onay alınmadan devredilemez.**
 * Tüzük §6'daki kategorilerden biri tetiklenmişse ve `record.approval` boşsa
 * betik reddeder. Bu, hattın atlanabilecek tek yeri olurdu — atlanamıyor.
 */
import { spawnSync } from 'node:child_process';

import { PASSED } from './lib/pipeline.mjs';
import { loadPolicy } from './lib/policy.mjs';
import { appendAudit, loadRequest, saveRequest } from './lib/store.mjs';
import { recordStep } from './pipeline.mjs';

/** Ajanın dokunmaması gereken alanlar — issue gövdesine yazılır ve iş akışında da uygulanır. */
const YASAKLAR = [
  '`it.skip` / `xit` / `test.todo` / `.only` / `--passWithNoTests` ile test atlama',
  '`@ts-ignore` / `eslint-disable` ile hata gizleme',
  'var olan bir testin beklentisini zayıflatma ya da silme',
  '`.env`, anahtar, sertifika okuma; uzak sunucuya veri gönderme',
  '`main` dalına doğrudan push',
  '`agents/cto/**`, `agents/selfheal/**`, `.github/**`, `.claude/**` dosyalarını değiştirme',
];

/**
 * Devredilebilir mi? Değilse sebebini söyler.
 * Saf fonksiyon — testler bunu doğrular.
 */
export function dispatchEdilebilir(record) {
  if (!record) return { ok: false, reason: 'Talep bulunamadı' };
  if (record.status === 'cancelled') return { ok: false, reason: 'Talep iptal edilmiş' };
  if (record.issueUrl) return { ok: false, reason: `Zaten devredilmiş: ${record.issueUrl}` };
  if (record.impact.unresolved) {
    return {
      ok: false,
      reason: 'Talep hiçbir modülle eşleşmedi — kapsam netleşmeden ajana verilemez',
    };
  }
  if (record.approvals.length && !record.approval) {
    const alanlar = record.approvals.map((a) => a.label).join(', ');
    return { ok: false, reason: `İnsan onayı bekliyor (${alanlar})` };
  }
  return { ok: true, reason: null };
}

/** Issue başlığı — listede okunabilir olmalı, kimlik de görünmeli. */
export function issueBasligi(record) {
  const ozet = record.request.length > 70 ? `${record.request.slice(0, 70)}…` : record.request;
  return `[${record.risk.level}] ${ozet}`;
}

/**
 * Issue gövdesi: ajanın ihtiyaç duyduğu her şey burada olmalı, çünkü ajan bu
 * metni tek başına okuyacak. Analiz uydurulmaz — kayıttan gelir.
 */
export function issueGovdesi(record, policy = loadPolicy()) {
  const l = [];
  l.push('<!-- agents/cto/dispatch.mjs tarafından üretildi; elle düzenleme. -->');
  l.push('');
  l.push('## Talep');
  l.push('');
  l.push(record.request);
  l.push('');
  l.push('## Analiz');
  l.push('');
  l.push(`| Alan | Değer |`);
  l.push(`| --- | --- |`);
  l.push(`| Kayıt | \`${record.id}\` |`);
  l.push(`| Risk | **${record.risk.level}** |`);
  l.push(`| Otonomi | ${record.autonomy} |`);
  l.push(`| Modüller | ${record.impact.modules.join(', ') || '—'} |`);
  l.push(`| Tablolar | ${record.impact.tables.join(', ') || '—'} |`);
  l.push(`| Model | mimari=${record.models.architecture} · uygulama=${record.models.implement} |`);
  l.push('');
  if (record.risk.reasons.length) {
    l.push('Risk gerekçesi:');
    for (const r of record.risk.reasons) l.push(`- ${r.level} ← ${r.kind}: \`${r.value}\``);
    l.push('');
  }
  if (record.impact.paths.length) {
    l.push('Beklenen dosya yolları (kaba tahmin — doğrula, körü körüne uyma):');
    l.push('');
    l.push('```');
    for (const p of record.impact.paths) l.push(p);
    l.push('```');
    l.push('');
  }
  if (record.approvals.length) {
    l.push('## İnsan onayı');
    l.push('');
    for (const a of record.approvals) l.push(`- **${a.label}** (${a.kind}: \`${a.because}\`)`);
    l.push('');
    l.push(
      record.approval
        ? `Onaylandı: **${record.approval.by}** — ${record.approval.evidence}`
        : '> Onay alınmadan uygulamaya geçilemez.',
    );
    l.push('');
  }

  l.push('## Yapılacaklar');
  l.push('');
  l.push('`.claude/agents/ai-cto.md` ve `docs/AI_CTO.md` bağlayıcıdır. Sıra:');
  l.push('');
  l.push('1. **Etkiyi doğrula.** Yukarıdaki yol listesi eşleşmeyle üretildi, okunarak değil.');
  l.push('   `Grep`/`Read` ile gerçekten dokunulacak dosyaları teyit et; eklediğin ya da');
  l.push('   çıkardığın her yolu gerekçelendir.');
  l.push('2. **Mimari.** Mevcut yapı işi görüyorsa yeni yapı kurma. Önce');
  l.push('   `src/data/repositories/index.ts` sözleşmesine ve `src/domain` katmanına bak.');
  l.push('3. **Uygula.** Katman kuralı: ekran → feature → data → domain. Hesaplama');
  l.push('   `src/domain` içinde saf kalır (React yok, IO yok, `now` parametre olarak gelir).');
  l.push('4. **Test.** Yeni davranışın testi olmadan bitmiş sayılmaz. `npm run lint &&');
  l.push('   npm run typecheck && npm test` üçlüsü yeşil olmadan PR açma.');
  l.push('5. **Metinler.** Kullanıcıya görünen her metin `src/core/i18n/tr.ts` (kaynak) ve');
  l.push('   `en.ts` içine eklenir; eksik anahtar tip hatası verir.');
  l.push('6. **PR.** Taslak olarak aç; gövdesine bu issue bağlantısını ve 5 satırlık özet koy:');
  l.push('   ne yapıldı, hangi dosyalar, hangi testler, ne test edilmedi, insan kararı gereken ne var.');
  l.push('');

  const neverSkip = policy.pipeline.fastPath?.neverSkip ?? [];
  l.push(`Atlanamayan kapılar: ${neverSkip.map((s) => `\`${s}\``).join(' · ')}`);
  l.push('');
  l.push('## Yasaklar');
  l.push('');
  for (const y of YASAKLAR) l.push(`- ${y}`);
  l.push('');
  l.push('Kapsam büyüyorsa ya da kök neden bir ürün kararı gerektiriyorsa **DUR**: kod');
  l.push('değiştirme, bulduklarını issue yorumu olarak yaz ve insan kararı iste.');
  l.push('');
  l.push(`---`);
  l.push(`Boru hattı durumu: \`node agents/cto/pipeline.mjs status --request ${record.id}\``);
  return l.join('\n');
}

/** `gh` ile issue açar; kurulu değilse anlaşılır bir hata verir. */
function issueAc({ title, body, labels }) {
  const r = spawnSync(
    'gh',
    ['issue', 'create', '--title', title, '--body', body, '--label', labels.join(',')],
    { encoding: 'utf8' },
  );
  if (r.error?.code === 'ENOENT') {
    throw new Error('`gh` bulunamadı. GitHub CLI kur ya da --dry ile gövdeyi al ve elle aç.');
  }
  if (r.status !== 0) {
    throw new Error(`gh issue create başarısız: ${(r.stderr || r.stdout || '').trim()}`);
  }
  const url = (r.stdout || '').trim().split('\n').pop();
  if (!/^https?:\/\//.test(url ?? '')) throw new Error(`Issue URL okunamadı: ${r.stdout}`);
  return url;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--request');
  const id = i !== -1 ? argv[i + 1] : null;
  const dry = argv.includes('--dry');
  if (!id) {
    console.error('Kullanım: node agents/cto/dispatch.mjs --request <id> [--dry]');
    process.exit(2);
  }

  const record = loadRequest(id);
  const izin = dispatchEdilebilir(record);
  if (!izin.ok) {
    console.error(`✗ Devredilemez: ${izin.reason}`);
    process.exit(1);
  }

  const title = issueBasligi(record);
  const body = issueGovdesi(record);

  if (dry) {
    console.log(`# ${title}\n`);
    console.log(body);
    process.exit(0);
  }

  try {
    const url = issueAc({ title, body, labels: ['ai-cto', `risk:${record.risk.level.toLowerCase()}`] });
    // Plan adımı burada kapanır: görev tarifi üretildi ve devredildi.
    const updated = recordStep(
      { ...record, issueUrl: url },
      { step: 'plan', status: PASSED, evidence: `görev tarifi devredildi: ${url}` },
    );
    saveRequest(updated);
    appendAudit({
      requestId: record.id,
      action: 'dispatch',
      step: 'plan',
      evidence: url,
      approval: record.approval,
    });
    console.log(`✓ Devredildi: ${url}`);
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }
}
