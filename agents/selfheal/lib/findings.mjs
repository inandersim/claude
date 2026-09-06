/**
 * Bulgu modeli, önceliklendirme ve kaynak başına bulgu üreticileri.
 *
 * İki ayrı sayı vardır ve karıştırılmamalıdır:
 *   - `urgency`  = etki x sıklık        → "ne kadar kötü" (severity buradan gelir)
 *   - `score`    = etki x sıklık x kolaylık → "önce neyi düzeltelim" (sıralama buradan gelir)
 * Kolaylığın önem derecesini düşürmemesi için ayrılmışlardır: zor bir çökme hâlâ
 * kritiktir, sadece sıraya daha aşağıda girer.
 *
 * Tüm fonksiyonlar saftır; dosya ya da ağ okumazlar (girdiler çağıran tarafından verilir).
 */
import { clamp01, ratioNorm, round, slug } from './util.mjs';
import { findingRisk } from './risk.mjs';
import { firstFrame } from './telemetry.mjs';

/** Tür başına temel etki ağırlığı (0..1). */
export const IMPACT_WEIGHTS = {
  crash: 1.0,
  flow_abandon: 0.75,
  failed_request: 0.7,
  error: 0.55,
  slow_screen: 0.5,
  empty_screen: 0.35,
  i18n_missing: 0.3,
  ci_instability: 0.5,
  coverage_gap: 0.4,
  perf_budget: 0.45,
  vulnerability: 0.8,
};

/** Tür başına temel düzeltme kolaylığı (0..1). */
export const EASE_WEIGHTS = {
  crash: 0.7,
  flow_abandon: 0.25,
  failed_request: 0.4,
  error: 0.65,
  slow_screen: 0.4,
  empty_screen: 0.6,
  i18n_missing: 0.95,
  ci_instability: 0.5,
  coverage_gap: 0.7,
  perf_budget: 0.55,
  vulnerability: 0.8,
};

/** Riskli alanlar hem daha çok etkiler hem de düzeltmesi (insan kapısı yüzünden) daha yavaştır. */
const RISK_IMPACT_BONUS = 0.15;
const RISK_EASE_PENALTY = 0.6;
/** Hangi dosyaya dokunulacağı belli değilse düzeltme belirgin biçimde zorlaşır. */
const UNKNOWN_FILE_EASE_PENALTY = 0.7;

/** Önem derecesi sırası (küçük = daha ciddi). */
export const SEVERITY_ORDER = ['kritik', 'yuksek', 'orta', 'dusuk'];

/**
 * Aciliyetten (etki x sıklık) önem derecesi.
 * Eşikler `ratioNorm` eğrisine göre seçilmiştir: sıklık 0.4 ≈ kullanıcıların %1,5'i,
 * 0.7 ≈ %10'u. Yani "kritik" kabaca "yüksek etkili ve kullanıcıların en az yüzde
 * birkaçını vuruyor" demektir.
 */
export function severityOf(urgency) {
  if (urgency >= 0.35) return 'kritik';
  if (urgency >= 0.2) return 'yuksek';
  if (urgency >= 0.08) return 'orta';
  return 'dusuk';
}

/**
 * Önem tabanı: can güvenliği (SOS) ve kimlik alanlarındaki çökme/hata, az sayıda
 * oturumu etkilese bile "orta"nın altına düşemez ve çökme ise en az "yüksek" sayılır.
 * Nadir ama ölümcül bir SOS hatasının sıklık düşük diye listenin dibine düşmesini engeller.
 */
export function severityFloor(finding, risk) {
  if (!risk?.risky) return null;
  const canGuvenligi = risk.categories.includes('sos');
  if (['crash', 'error'].includes(finding.kind)) return canGuvenligi ? 'yuksek' : 'orta';
  return canGuvenligi ? 'orta' : null;
}

/** İki önem derecesinden daha ciddi olanı. */
export function worstSeverity(a, b) {
  if (!b) return a;
  if (!a) return b;
  return SEVERITY_ORDER.indexOf(a) <= SEVERITY_ORDER.indexOf(b) ? a : b;
}

/**
 * Bir bulguyu puanlar. Girdi bulgusunda `kind`, `metrics.sessions` (ya da `metrics.count`)
 * ve `files` beklenir; `totalSessions` sıklık normalizasyonunun paydasıdır.
 *
 * @param {object} finding
 * @param {{totalSessions?: number}} ctx
 * @returns {object} puan alanları eklenmiş yeni bulgu nesnesi
 */
export function scoreFinding(finding, { totalSessions = 1000 } = {}) {
  const risk = findingRisk(finding);
  const impactBase = finding.impactOverride ?? IMPACT_WEIGHTS[finding.kind] ?? 0.4;
  const easeBase = finding.easeOverride ?? EASE_WEIGHTS[finding.kind] ?? 0.5;

  const impact = clamp01(impactBase + (risk.risky ? RISK_IMPACT_BONUS : 0));

  // Sıklık: etkilenen oturumların toplam oturuma oranı, logaritmik olarak 0..1'e taşınır.
  // Oran tabanlıdır — mutlak sayı değil — böylece uygulama büyüdükçe eşikler kaymaz.
  const affected = finding.metrics?.sessions ?? finding.metrics?.count ?? 0;
  const frequency = finding.frequencyOverride ?? ratioNorm(affected, totalSessions);

  let ease = easeBase;
  if (risk.risky) ease *= RISK_EASE_PENALTY;
  if (!finding.files?.length) ease *= UNKNOWN_FILE_EASE_PENALTY;
  ease = clamp01(ease);

  const urgency = impact * frequency;
  const score = round(100 * urgency * ease, 1);
  const severity = worstSeverity(severityOf(urgency), severityFloor(finding, risk));

  return {
    ...finding,
    impact: round(impact),
    frequency: round(frequency),
    ease: round(ease),
    urgency: round(urgency),
    score,
    severity,
    risky: risk.risky,
    riskCategories: risk.categories,
    autoFixable: risk.autoFixable && finding.autoFixable !== false,
  };
}

/**
 * Aynı konuyu (`subject`) iki farklı kaynaktan bildiren bulguları birleştirir.
 * Örnek: telemetrideki "yavaş ekran" ile performans nöbetindeki "açılış bütçesi aşıldı"
 * aynı sorunu anlatır — liste iki satır göstermemeli. En yüksek puanlı olan kalır,
 * diğerleri `corroboratedBy` olarak kaydedilir (kanıt güçlenir, gürültü azalır).
 *
 * Girdinin sıralı geldiği varsayılır: ilk görülen (en yüksek puanlı) temsilci olur.
 */
export function dedupe(findings) {
  const bySubject = new Map();
  const out = [];
  for (const f of findings) {
    if (!f.subject) {
      out.push(f);
      continue;
    }
    const existing = bySubject.get(f.subject);
    if (!existing) {
      bySubject.set(f.subject, f);
      out.push(f);
      continue;
    }
    existing.corroboratedBy = [...(existing.corroboratedBy ?? []), { id: f.id, source: f.source, title: f.title }];
  }
  return out;
}

/**
 * Bulguları puanlayıp sıralar ve aynı konuyu anlatanları birleştirir.
 * Sıralama kararlıdır: önce puan (azalan), eşitlikte önem derecesi, sonra kimlik (artan)
 * — aynı girdi her zaman aynı sırayı verir.
 */
export function prioritize(findings, ctx = {}) {
  const rank = Object.fromEntries(SEVERITY_ORDER.map((s, i) => [s, i]));
  const scored = findings
    .map((f) => (f.score === undefined ? scoreFinding(f, ctx) : f))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9) ||
        String(a.id).localeCompare(String(b.id)),
    );
  return dedupe(scored);
}

/** Yol/ekran adından olası kaynak dosyaları tahmin eder (rota → features/app). */
export function guessFiles(group) {
  const files = new Set();
  for (const event of group.events ?? []) {
    const frame = firstFrame(event.detail?.stack);
    if (frame) files.add(frame.split(':')[0]);
  }
  if (files.size === 0) {
    for (const route of group.routes ?? []) {
      const seg = String(route)
        .replace(/^\/?\((app|auth)\)\//, '')
        .split('/')
        .filter((s) => s && !s.startsWith('['))[0];
      if (seg) files.add(`src/features/${seg}/`);
    }
  }
  return [...files];
}

/* ------------------------------------------------------------------ *
 * Kaynak başına bulgu üreticileri
 * ------------------------------------------------------------------ */

/** Telemetri gruplarından bulgu üretir. */
export function fromTelemetry(groups, window) {
  return groups.map((group) => {
    const d = group.sample.detail ?? {};
    const files = guessFiles(group);
    const frame = firstFrame(group.sample.detail?.stack);
    const base = {
      id: `tel-${slug(group.signature, 72)}`,
      source: 'telemetri',
      kind: group.kind,
      files,
      metrics: {
        count: group.count,
        sessions: group.sessions || group.count,
        totalSessions: window?.totalSessions,
        platforms: group.platforms,
        routes: group.routes,
      },
      evidence: { signature: group.signature, frame, sampleEventId: group.sample.id },
    };
    switch (group.kind) {
      case 'crash':
        return {
          ...base,
          title: `Çökme: ${d.message}`,
          detail: `${group.count} çökme / ${group.sessions} oturum · ${group.routes.join(', ')} · ${group.platforms.join(', ')}`,
          suggestedFix: frame
            ? `${frame} konumundaki çağrıyı incele; yığın izi tek bir kareyi gösteriyor.`
            : 'Yığın izi uygulama koduna işaret etmiyor; önce yeniden üretim adımı çıkar.',
        };
      case 'error':
        return {
          ...base,
          title: `Yakalanan hata: ${d.message}`,
          detail: `${group.count} olay / ${group.sessions} oturum · ${d.handledBy ?? 'sınır bilinmiyor'}`,
          suggestedFix: frame ? `${frame} konumunu düzelt.` : 'Hatayı yakalayan sınırı genişlet.',
        };
      case 'slow_screen':
        return {
          ...base,
          subject: `ekran-acilis:${d.screen}`,
          title: `Yavaş ekran: ${d.screen} (${d.ms} ms)`,
          detail: `p75 ${d.ms} ms, bütçe ${d.budgetMs ?? '?'} ms, ${d.queries ?? '?'} sorgu · ${group.sessions} oturum`,
          suggestedFix:
            (d.queries ?? 0) > 5
              ? 'Sorgu sayısı yüksek: istekleri birleştir ya da React Query önbelleğini paylaştır.'
              : 'Ağır bileşenleri ertelemeli yükle; liste sanallaştırmasını doğrula.',
        };
      case 'failed_request':
        return {
          ...base,
          title: `Başarısız istek: ${d.method ?? 'GET'} ${d.endpoint} → ${d.status}`,
          detail: `${group.count} istek / ${group.sessions} oturum · ${d.errorCode ?? 'kod yok'} · ort. ${d.ms ?? '?'} ms`,
          suggestedFix:
            d.status >= 500 || d.status === 0
              ? 'Sunucu/ağ kaynaklı: geri çekilmeli yeniden deneme ve kullanıcıya görünür hata durumu ekle.'
              : 'İstemci kaynaklı: istek gövdesini ve kimlik doğrulama başlığını doğrula.',
          autoFixable: false,
        };
      case 'flow_abandon': {
        const total = (d.completions ?? 0) + group.sessions;
        const rate = total ? group.sessions / total : 0;
        return {
          ...base,
          title: `Terk edilen akış: ${d.flow} → ${d.step}`,
          detail: `${group.sessions} terk / ${total} giriş (%${(rate * 100).toFixed(1)}) · adım ${d.stepIndex ?? '?'}/${d.totalSteps ?? '?'}`,
          suggestedFix:
            'Ürün kararı gerektirir: adımdaki sürtünmeyi ölç (izin metni, ödeme formu, hata mesajı). Otomatik düzeltme yok.',
          autoFixable: false,
        };
      }
      case 'empty_screen':
        return {
          ...base,
          title: `Boş ekran: ${d.screen}${d.hasEmptyState === false ? ' (boş durum bileşeni yok)' : ''}`,
          detail: `${group.sessions} oturum · sebep: ${d.reason ?? 'bilinmiyor'}`,
          suggestedFix:
            d.hasEmptyState === false
              ? 'Tasarlanmış boş durum bileşeni ekle (başlık, açıklama, eylem).'
              : 'Boş durum var; veri kaynağının neden boş döndüğünü incele.',
        };
      case 'i18n_missing':
        return {
          ...base,
          title: `Eksik çeviri: ${d.key} (${d.locale})`,
          detail: `${group.count} kez gösterildi · ${group.sessions} oturum`,
            // Anahtarın ilk parçası modül adıdır: `zmatch.filters.title` → modules/locales/de/zmatch.ts
        files: [`src/core/i18n/modules/locales/${d.locale}/${String(d.key).split('.')[0]}.ts`],
          suggestedFix: `\`${d.key}\` anahtarını ${d.locale} diline ekle; \`node agents/devops/i18n-check.mjs\` ile doğrula.`,
        };
      default:
        return { ...base, title: `Bilinmeyen olay: ${group.signature}`, detail: '', suggestedFix: '' };
    }
  });
}

/** CI geçmişinden kararlılık bulgusu üretir. */
export function fromCi(history, { totalSessions = 1000 } = {}) {
  const runs = history?.runs ?? [];
  if (runs.length === 0) return [];
  const failures = runs.filter((r) => r.conclusion === 'failure');
  const failRate = failures.length / runs.length;
  if (failRate < 0.15) return [];
  const byStep = {};
  for (const r of failures) byStep[r.failedStep ?? 'bilinmiyor'] = (byStep[r.failedStep ?? 'bilinmiyor'] ?? 0) + 1;
  const worst = Object.entries(byStep).sort((a, b) => b[1] - a[1]);
  return [
    {
      id: `ci-basarisizlik-orani`,
      source: 'ci',
      kind: 'ci_instability',
      title: `CI başarısızlık oranı %${(failRate * 100).toFixed(0)}`,
      detail: `${runs.length} koşudan ${failures.length} tanesi kırmızı. Adım dağılımı: ${worst.map(([s, n]) => `${s} (${n})`).join(', ')}`,
      files: [],
      metrics: { count: failures.length, sessions: 0, failRate, byStep },
      evidence: { runs: failures.slice(0, 5).map((r) => ({ id: r.id, branch: r.branch, step: r.failedStep })) },
      suggestedFix: `En sık kırılan adım: \`${worst[0][0]}\`. Kırmızı koşuların günlüğünü \`gh run view\` ile oku; steward ajanı kök nedeni düzeltir.`,
      // Sıklık telemetriyle aynı ölçekte olmadığından doğrudan verilir.
      frequencyOverride: clamp01(failRate),
      autoFixable: false,
    },
  ];
}

/** Test kapsamı boşluklarından bulgu üretir (yalnızca domain/data dosyaları). */
export function fromCoverage(coverage, { threshold = 60, minLines = 80 } = {}) {
  if (!coverage) return [];
  const findings = [];
  for (const [path, data] of Object.entries(coverage)) {
    if (path === 'total' || path === 'note' || !data?.lines) continue;
    const pct = data.lines.pct;
    if (pct >= threshold || data.lines.total < minLines) continue;
    const risk = findingRisk({ files: [path] });
    findings.push({
      id: `kapsam-${slug(path)}`,
      source: 'kapsam',
      kind: 'coverage_gap',
      title: `Düşük test kapsamı: ${path} (%${pct.toFixed(0)} satır)`,
      detail: `${data.lines.covered}/${data.lines.total} satır, %${(data.branches?.pct ?? 0).toFixed(0)} dal${risk.risky ? ` · RİSKLİ ALAN (${risk.categories.join(', ')})` : ''}`,
      files: [path],
      metrics: { count: data.lines.total - data.lines.covered, sessions: 0, pct },
      evidence: { lines: data.lines, branches: data.branches },
      suggestedFix: `\`${path}\` için saf domain testi yaz (test-writer ajanı). Kapsanmayan dalları önce listele.`,
      // Kapsam boşluğu üretimde kullanıcı etkilemez; sıklık yerine kapsam açığı kullanılır.
      frequencyOverride: clamp01((threshold - pct) / threshold),
    });
  }
  return findings;
}

/** npm audit çıktısından güvenlik bulgusu üretir. */
export function fromSecurity(audit) {
  const vulns = audit?.vulnerabilities ?? {};
  const findings = [];
  for (const [name, v] of Object.entries(vulns)) {
    if (!['high', 'critical'].includes(v.severity)) continue;
    const fix = v.fixAvailable;
    const fixText =
      fix === true
        ? 'yama mevcut'
        : fix?.version
          ? `${fix.name}@${fix.version}${fix.isSemVerMajor ? ' (MAJÖR — insan kararı)' : ''}`
          : 'yama yok';
    findings.push({
      id: `guvenlik-${slug(name)}`,
      source: 'guvenlik',
      kind: 'vulnerability',
      title: `${v.severity === 'critical' ? 'Kritik' : 'Yüksek'} açık: ${name}`,
      detail: `${(v.via ?? []).map((x) => (typeof x === 'string' ? x : x.title)).join('; ')} · ${v.isDirect ? 'doğrudan' : 'geçişli'} bağımlılık · ${fixText}`,
      files: [],
      metrics: { count: 1, sessions: 0 },
      evidence: { severity: v.severity, fixAvailable: fix, via: v.via },
      suggestedFix:
        fix && fix !== true && fix.isSemVerMajor
          ? 'Majör sürüm gerektirir: insan kararı, otomatik düzeltme yok.'
          : 'Yamayı `npm audit fix` ile uygula; kilit dosyası değişikliği insan onayına gider (package-lock.json DENY listesinde).',
      impactOverride: v.severity === 'critical' ? 1.0 : 0.8,
      frequencyOverride: v.severity === 'critical' ? 0.9 : 0.6,
      autoFixable: false,
    });
  }
  return findings;
}

/**
 * i18n denetim çıktısından bulgu üretir.
 * Girdi: `node agents/devops/i18n-check.mjs --json` şekli
 * `{ok, errorCount, results:[{module, legacy, locales:{<loc>:{missing,extra,placeholderMismatch,exists,wired}}}]}`
 * Her (modül, dil) çifti ayrı bulgu olur — düzeltmeler dil dosyası bazında yapılır.
 */
export function fromI18n(report) {
  const results = report?.results;
  if (!Array.isArray(results)) return [];
  const findings = [];
  for (const mod of results) {
    if (mod.legacy?.length) {
      findings.push({
        id: `i18n-eski-yertutucu-${slug(mod.module)}`,
        source: 'i18n',
        kind: 'i18n_missing',
        title: `Eski yer tutucu biçimi: ${mod.module} modülü`,
        detail: `${mod.legacy.length} anahtarda \`%{...}\` kullanılmış; doğru biçim \`{{...}}\`.`,
        files: [`src/core/i18n/modules/${mod.module}.ts`],
        metrics: { count: mod.legacy.length, sessions: 0 },
        evidence: { ornekler: mod.legacy.slice(0, 5) },
        suggestedFix: '`%{ad}` yer tutucularını `{{ad}}` biçimine çevir; `npm run i18n:check` yeşile dönmeli.',
        frequencyOverride: clamp01(mod.legacy.length / 20),
      });
    }
    for (const [locale, info] of Object.entries(mod.locales ?? {})) {
      const missing = info.missing?.length ?? 0;
      const extra = info.extra?.length ?? 0;
      const mismatch = info.placeholderMismatch?.length ?? 0;
      const eksikDosya = info.exists === false;
      const bagsiz = info.exists && info.wired === false;
      if (!missing && !extra && !mismatch && !eksikDosya && !bagsiz) continue;
      const parcalar = [];
      if (eksikDosya) parcalar.push('dil dosyası yok');
      if (bagsiz) parcalar.push('localeSet ile bağlanmamış');
      if (missing) parcalar.push(`${missing} eksik anahtar`);
      if (extra) parcalar.push(`${extra} fazla anahtar`);
      if (mismatch) parcalar.push(`${mismatch} yer tutucu uyuşmazlığı`);
      findings.push({
        id: `i18n-${slug(mod.module)}-${locale}`,
        source: 'i18n',
        kind: 'i18n_missing',
        title: `i18n uyumsuzluğu: ${mod.module} / ${locale}`,
        detail: parcalar.join(', '),
        files: [info.file ?? `src/core/i18n/modules/locales/${locale}/${mod.module}.ts`],
        metrics: { count: missing + extra + mismatch + (eksikDosya ? 10 : 0), sessions: 0 },
        evidence: {
          missing: info.missing?.slice(0, 8),
          extra: info.extra?.slice(0, 8),
          placeholderMismatch: info.placeholderMismatch?.slice(0, 8),
        },
        suggestedFix: eksikDosya
          ? `\`/translate ${mod.module}\` ile ${locale} dosyasını üret.`
          : `\`${mod.module}\` modülünün ${locale} dosyasını \`tr\` kaynağıyla hizala (\`/translate ${mod.module}\`).`,
        // Yer tutucu uyuşmazlığı çalışma zamanında bozuk metin gösterir: eksik anahtardan daha acildir.
        impactOverride: mismatch ? 0.45 : 0.3,
        frequencyOverride: clamp01((missing + extra + mismatch) / 30 + (eksikDosya ? 0.5 : 0)),
      });
    }
  }
  return findings;
}
