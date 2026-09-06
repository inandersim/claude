#!/usr/bin/env node
/**
 * Kanarya ve otomatik geri alma (bağımlılıksız, Node 22).
 *
 * OTA (expo-updates) güncellemesi kullanıcılara kademeli açılır; her aşamada telemetri
 * ölçümleri temel çizgiyle (baseline) karşılaştırılır. Bir eşik aşılırsa karar **geri-al**
 * olur ve hat ilerlemez. Süreç ve eşiklerin gerekçesi: docs/SELF_IMPROVEMENT.md
 *
 * Bu betik yayın yapmaz; **karar üretir** ve komutu yazdırır. Yayını/geri almayı
 * `canary.yml` iş akışı ya da bir insan çalıştırır — böylece "ölçen" ile "yayınlayan" ayrıdır.
 *
 * Kullanım:
 *   node agents/selfheal/canary.mjs stages [--risky]
 *   node agents/selfheal/canary.mjs evaluate --metrics <dosya> [--stage yuzde5] [--json]
 */
import { join } from 'node:path';
import { parseArgs, readJsonSafe, round, SELFHEAL_DIR } from './lib/util.mjs';
import { appendAudit } from './lib/audit.mjs';

const FIXTURE = join(SELFHEAL_DIR, 'fixtures', 'canary-metrics.json');

/**
 * Kademeli açılım merdiveni. `dwellMinutes` = bir sonraki aşamaya geçmeden önce
 * beklenmesi gereken süre; `minSessions` = kararın istatistiksel olarak anlamlı
 * sayılması için gereken en az oturum sayısı (az örnekle geri alma da ilerleme de yanlıştır).
 */
export const STAGES = [
  { id: 'yuzde5', percent: 5, dwellMinutes: 60, minSessions: 500 },
  { id: 'yuzde25', percent: 25, dwellMinutes: 180, minSessions: 2000 },
  { id: 'yuzde50', percent: 50, dwellMinutes: 360, minSessions: 5000 },
  { id: 'tam', percent: 100, dwellMinutes: 0, minSessions: 0 },
];

/**
 * Geri alma eşikleri. Her metrik için hem **mutlak** hem de **temel çizgiye göreli**
 * sınır vardır: mutlak sınır felaketi yakalar, göreli sınır sessiz bozulmayı.
 */
export const POLICY = {
  crashFreeSessionsPct: { mutlakEnAz: 99.0, temelDusus: 0.3, yon: 'yuksek-iyi' },
  errorRatePct: { mutlakEnFazla: 5.0, temelCarpan: 1.25, yon: 'dusuk-iyi' },
  flowCompletionPct: { temelOran: 0.95, yon: 'yuksek-iyi' },
  p75ScreenMs: { temelCarpan: 1.2, yon: 'dusuk-iyi' },
};

/** Riskli alan (ödeme/SOS/kimlik) değişikliklerinde merdiven daha yavaş ve her aşamada insan onaylı. */
export const RISKY_OVERRIDES = {
  dwellCarpan: 2,
  herAsamadaInsanOnayi: true,
  enFazlaAsama: 'yuzde50',
};

/** Bir aşamayı kimliğinden bulur. */
export function stageById(id) {
  return STAGES.find((s) => s.id === id) ?? STAGES[0];
}

/** Bir aşamadan sonrakini döner (yoksa null). */
export function nextStage(id) {
  const i = STAGES.findIndex((s) => s.id === id);
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null;
}

/**
 * Kanarya ölçümlerini değerlendirir. Saf fonksiyon — dosya/ağ okumaz.
 *
 * @param {{stage?:string, observedMinutes?:number, canary:object, baseline:object, risky?:boolean}} input
 * @param {object} policy
 * @returns {{decision:'ilerlet'|'bekle'|'geri-al', reasons:string[], breaches:object[],
 *            stage:object, next:object|null, needsHuman:boolean}}
 */
export function evaluateCanary(input, policy = POLICY) {
  const stage = stageById(input.stage ?? 'yuzde5');
  const risky = Boolean(input.risky);
  const dwell = stage.dwellMinutes * (risky ? RISKY_OVERRIDES.dwellCarpan : 1);
  const c = input.canary ?? {};
  const b = input.baseline ?? {};
  const breaches = [];
  const reasons = [];

  const kontrol = (metrik, kural) => {
    const deger = c[metrik];
    const temel = b[metrik];
    if (deger == null) return;
    if (kural.yon === 'yuksek-iyi') {
      if (kural.mutlakEnAz != null && deger < kural.mutlakEnAz) {
        breaches.push({ metrik, deger, sinir: kural.mutlakEnAz, tur: 'mutlak' });
      }
      if (temel != null && kural.temelDusus != null && temel - deger > kural.temelDusus) {
        breaches.push({ metrik, deger, temel, sinir: round(temel - kural.temelDusus, 3), tur: 'temel-dusus' });
      }
      if (temel != null && kural.temelOran != null && deger < temel * kural.temelOran) {
        breaches.push({ metrik, deger, temel, sinir: round(temel * kural.temelOran, 3), tur: 'temel-oran' });
      }
    } else {
      if (kural.mutlakEnFazla != null && deger > kural.mutlakEnFazla) {
        breaches.push({ metrik, deger, sinir: kural.mutlakEnFazla, tur: 'mutlak' });
      }
      if (temel != null && kural.temelCarpan != null && deger > temel * kural.temelCarpan) {
        breaches.push({ metrik, deger, temel, sinir: round(temel * kural.temelCarpan, 3), tur: 'temel-carpan' });
      }
    }
  };
  for (const [metrik, kural] of Object.entries(policy)) kontrol(metrik, kural);

  if (breaches.length) {
    for (const x of breaches) {
      reasons.push(
        `${x.metrik}: ${x.deger} — sınır ${x.sinir}${x.temel != null ? ` (temel ${x.temel})` : ''} [${x.tur}]`,
      );
    }
    return { decision: 'geri-al', reasons, breaches, stage, next: null, needsHuman: true };
  }

  const sessions = c.sessions ?? 0;
  if (sessions < stage.minSessions) {
    reasons.push(`örneklem yetersiz: ${sessions} oturum < ${stage.minSessions} (karar için erken)`);
  }
  const observed = input.observedMinutes ?? 0;
  if (observed < dwell) {
    reasons.push(`bekleme süresi dolmadı: ${observed} dk < ${dwell} dk${risky ? ' (riskli alan: süre iki katı)' : ''}`);
  }
  if (reasons.length) {
    return { decision: 'bekle', reasons, breaches, stage, next: null, needsHuman: false };
  }

  const next = nextStage(stage.id);
  if (risky && next && STAGES.findIndex((s) => s.id === next.id) > STAGES.findIndex((s) => s.id === RISKY_OVERRIDES.enFazlaAsama)) {
    return {
      decision: 'bekle',
      reasons: [`riskli alan: \`${RISKY_OVERRIDES.enFazlaAsama}\` üstüne çıkmak insan kararıdır`],
      breaches,
      stage,
      next,
      needsHuman: true,
    };
  }
  reasons.push(
    next
      ? `tüm eşikler içinde (${sessions} oturum, ${observed} dk) → %${next.percent}`
      : `tüm eşikler içinde — dağıtım tamamlandı (%${stage.percent})`,
  );
  return {
    decision: 'ilerlet',
    reasons,
    breaches,
    stage,
    next,
    needsHuman: risky && RISKY_OVERRIDES.herAsamadaInsanOnayi,
  };
}

/** Karara karşılık gelen komut (yayın/geri alma bu betik tarafından çalıştırılmaz). */
export function commandFor(decision, { updateId, branch = 'production' } = {}) {
  switch (decision.decision) {
    case 'geri-al':
      return `eas update:rollback --branch ${branch}   # ya da: eas update:republish --group <önceki-grup>`;
    case 'ilerlet':
      return decision.next
        ? `eas update:configure --branch ${branch} --rollout ${decision.next.percent}   # ${updateId ?? '<updateId>'}`
        : `# dağıtım tamamlandı — yapılacak bir şey yok`;
    default:
      return `# bekle: ${decision.stage.dwellMinutes} dk dolduğunda yeniden değerlendir`;
  }
}

/* ------------------------------ CLI ------------------------------ */
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const { command, opt, flag } = parseArgs();

  if (command === 'stages' || !command) {
    const risky = flag('risky');
    process.stdout.write(`Kanarya merdiveni${risky ? ' (RİSKLİ ALAN)' : ''}\n\n`);
    process.stdout.write('| Aşama | Kullanıcı | Bekleme | En az oturum |\n| --- | ---: | ---: | ---: |\n');
    for (const s of STAGES) {
      const dwell = s.dwellMinutes * (risky ? RISKY_OVERRIDES.dwellCarpan : 1);
      process.stdout.write(`| ${s.id} | %${s.percent} | ${dwell} dk | ${s.minSessions} |\n`);
    }
    process.stdout.write('\nGeri alma eşikleri:\n');
    for (const [m, k] of Object.entries(POLICY)) {
      const parcalar = [];
      if (k.mutlakEnAz != null) parcalar.push(`mutlak en az ${k.mutlakEnAz}`);
      if (k.mutlakEnFazla != null) parcalar.push(`mutlak en fazla ${k.mutlakEnFazla}`);
      if (k.temelDusus != null) parcalar.push(`temelden en fazla ${k.temelDusus} puan düşük`);
      if (k.temelCarpan != null) parcalar.push(`temelin en fazla ${k.temelCarpan} katı`);
      if (k.temelOran != null) parcalar.push(`temelin en az %${k.temelOran * 100}'i`);
      process.stdout.write(`  - ${m}: ${parcalar.join(', ')}\n`);
    }
    if (risky) {
      process.stdout.write(
        `\nRiskli alan kuralları: bekleme x${RISKY_OVERRIDES.dwellCarpan}, her aşamada insan onayı, ` +
          `\`${RISKY_OVERRIDES.enFazlaAsama}\` üstü insan kararı.\n`,
      );
    }
    process.exit(0);
  }

  if (command === 'evaluate') {
    const metricsPath = opt('metrics', FIXTURE);
    const metrics = readJsonSafe(metricsPath);
    if (!metrics) {
      process.stderr.write(`Ölçüm dosyası okunamadı: ${metricsPath}\n`);
      process.exit(2);
    }
    const input = { ...metrics, stage: opt('stage', metrics.stage), risky: flag('risky') || metrics.risky };
    const decision = evaluateCanary(input);
    const cmd = commandFor(decision, { updateId: metrics.updateId, branch: opt('branch', 'production') });

    if (flag('json')) {
      process.stdout.write(JSON.stringify({ input: { ...input, source: metricsPath }, decision, command: cmd }, null, 2) + '\n');
    } else {
      const icon = { 'geri-al': '🔴', bekle: '🟡', ilerlet: '🟢' }[decision.decision];
      process.stdout.write(`# Kanarya değerlendirmesi — ${metrics.updateId ?? '?'} / ${decision.stage.id}\n\n`);
      process.stdout.write(`Karar: ${icon} **${decision.decision.toUpperCase()}**${decision.needsHuman ? ' (insan onayı gerekir)' : ''}\n\n`);
      for (const r of decision.reasons) process.stdout.write(`- ${r}\n`);
      process.stdout.write(`\nÖlçüm kaynağı: \`${metricsPath}\`\n`);
      process.stdout.write(`\nKomut:\n\n    ${cmd}\n`);
    }

    if (!flag('no-audit') && decision.decision !== 'bekle') {
      appendAudit({
        who: 'canary.mjs (kanarya nöbeti)',
        what: decision.decision === 'geri-al' ? `Geri alma kararı: ${metrics.updateId ?? '?'}` : `Kanarya ilerletme kararı: ${metrics.updateId ?? '?'} → %${decision.next?.percent ?? 100}`,
        why: decision.reasons.join(' · '),
        evidence: `aşama ${decision.stage.id}, ${input.canary?.sessions ?? '?'} oturum, ölçüm \`${metricsPath}\``,
        extra: { komut: `\`${cmd}\``, 'insan onayı': decision.needsHuman ? 'evet' : 'hayır' },
      });
    }
    process.exitCode = decision.decision === 'geri-al' ? 1 : 0;
    process.exit(process.exitCode);
  }

  process.stderr.write(`Bilinmeyen komut: ${command}\nKullanım: canary.mjs stages | evaluate --metrics <dosya>\n`);
  process.exit(2);
}
