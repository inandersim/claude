/**
 * AI CTO komuta merkezinin tohum uygulaması.
 *
 * **Kural motoru burada değil.** Risk sınıflandırması, kapılar ve onay
 * kategorileri `agents/cto/lib/*.mjs` içindedir ve buradan doğrudan içe
 * aktarılır; politika `agents/cto/policy.json`. Böylece panelde gördüğün karar
 * ile komut satırında (`node agents/cto/intake.mjs`) çıkan karar aynıdır —
 * kuralın ikinci bir kopyası yoktur.
 *
 * Bu dosyanın işi yalnızca: modül/tablo listesini tarayıcıya taşımak, kayıtları
 * bellekte tutmak ve `AdminApi.cto` sözleşmesini uygulamak.
 */
import policyJson from '@cto/policy.json';
import { analyzeImpact } from '@cto/lib/impact-core.mjs';
import { applyResult, initialSteps, summarize } from '@cto/lib/pipeline.mjs';
import { assertPolicyShape, currentLevel } from '@cto/lib/policy-core.mjs';
import { approvalsRequired, classify, modelFor } from '@cto/lib/risk-classify.mjs';
import type { Policy, Step } from '@cto/lib/types';

// Modül listesi derleme sırasında depodan okunur (bkz. vite.config.ts):
// elle yazılmaz, bu yüzden yeni bir modül eklendiğinde panel onu kendiliğinden
// tanır ve var olmayan bir modülü gösteremez.
import { MODULES } from 'virtual:zirtan-modules';

import type { ID, ISODate } from '@/domain';

import type {
  CtoAuditEntry,
  CtoPolicySummary,
  CtoRequest,
  CtoRiskLevel,
  CtoStepStatus,
  Paged,
  PageQuery,
} from './adminApi';

const policy = assertPolicyShape(policyJson, 'agents/cto/policy.json') as Policy;



/** Olası dosya yolları — Node tarafındaki `likelyPaths` ile aynı biçim. */
function likelyPaths(modules: string[]): string[] {
  const known = new Set(MODULES);
  return modules
    .filter((m) => known.has(m))
    .flatMap((m) => [`src/features/${m}/**`, `src/domain/${m}.ts`])
    .sort();
}

const nowIso = (): ISODate => new Date().toISOString();

function makeId(text: string, at = new Date()): ID {
  const stamp = at.toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');
  const slug = text
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${stamp}-${slug || 'talep'}`;
}

/** Talebi analiz eder — kayıt oluşturmaz (adım 1–6). */
export function analyzeRequest(text: string, at = new Date()): CtoRequest {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Boş talep');

  const impact = analyzeImpact(trimmed, { modules: MODULES, tables: [] });
  const paths = likelyPaths(impact.modules);
  const risk = classify({ text: trimmed, paths }, policy);
  const approvals = approvalsRequired({ text: trimmed, paths }, policy);
  const level = currentLevel(policy);

  const questions: string[] = [];
  if (impact.unresolved) {
    questions.push(
      'Talep hiçbir mevcut modülle eşleşmedi — yeni bir modül mü açılacak, yoksa hangi modülü kastediyorsun?',
    );
  }
  if (approvals.length) {
    questions.push(`İnsan onayı gerektiren alan(lar): ${approvals.map((a) => a.label).join(', ')}`);
  }

  return {
    id: makeId(trimmed, at),
    createdAt: at.toISOString(),
    request: trimmed,
    autonomy: level.id,
    status: 'open',
    understanding: { matched: impact.matched, questions },
    impact: { modules: impact.modules, tables: impact.tables, paths, unresolved: impact.unresolved },
    risk: { level: risk.level as CtoRiskLevel, reasons: risk.reasons as CtoRequest['risk']['reasons'] },
    approvals: approvals as CtoRequest['approvals'],
    models: {
      architecture: modelFor('architecture', risk.level, policy),
      implement: modelFor('implement', risk.level, policy),
      review: modelFor('review', risk.level, policy),
    },
    steps: initialSteps(risk.level, policy) as CtoStep[],
    approval: null,
    issueUrl: null,
    prUrl: null,
  };
}

type CtoStep = CtoRequest['steps'][number];

/** Bellekteki kayıtlar (tohum modunda kalıcı değildir). */
const requests: CtoRequest[] = [];
const audit: CtoAuditEntry[] = [];

function log(entry: Omit<CtoAuditEntry, 'at'> & { at?: ISODate }): void {
  audit.unshift({ at: entry.at ?? nowIso(), ...entry });
}

/**
 * Örnek kayıt: panel ilk açıldığında boş görünmesin ve kapıların nasıl
 * ilerlediği anlaşılsın diye. Gerçek sunucuda bu liste veritabanından gelir.
 */
function seed(): void {
  if (requests.length) return;
  const at = new Date(Date.now() - 3 * 3_600_000);
  const record = analyzeRequest(
    'Rota planlama ekranına kamp alanı katmanı ekle; kullanıcı rotayı seçince yakındaki kamp alanları listelensin',
    at,
  );
  let steps = record.steps as unknown as Step[];
  const passed: [string, string][] = [
    ['understand', 'kapsam netleşti: rota ekranına katman + liste'],
    ['impact', 'tracks, stays, maps modülleri; 6 dosya'],
    ['research', 'OSM tourism=camp_site etiketi ve lisansı doğrulandı (2026-09-05)'],
    ['architecture', 'mevcut MapView katman API’si yeterli, yeni bileşen gerekmiyor'],
    ['risk', 'MEDIUM — kullanıcı verisine dokunmuyor'],
    ['plan', '4 dosya + 1 hook + 2 test'],
    ['implement', 'claude/kamp-katmani dalı, 6 commit'],
    ['test', '73 paket / 908 test yeşil'],
    ['security', 'Checked — konum verisi istemcide kalıyor, yeni uç yok'],
    ['review', '2 bulgu düzeltildi, bloklayıcı kalmadı'],
    ['performance', 'karo başına +3 KB; budgets.json aşımı yok'],
  ];
  for (const [id, evidence] of passed) {
    if (steps.find((s) => s.id === id)?.status === 'skipped') continue;
    steps = applyResult(steps, id, { status: 'passed', evidence }, policy);
  }
  // Sahne adımı L3 açılmadan geçilemez; hat burada durur ve bunu gizlemez.
  steps = steps.map((s) =>
    s.id === 'staging' ? { ...s, status: 'blocked', note: 'L3 kapalı — sahne ortamı henüz yok' } : s,
  );
  requests.push({
    ...record,
    steps: steps as unknown as CtoStep[],
    issueUrl: 'https://github.com/inandersim/claude/issues/128',
    prUrl: 'https://github.com/inandersim/claude/pull/131',
  });
  log({ requestId: record.id, agent: 'ai-cto', action: 'intake', step: 'understand', evidence: 'risk=MEDIUM' });
  log({ requestId: record.id, agent: 'steward', action: 'step:pass', step: 'test', evidence: '908 test yeşil' });
  log({
    requestId: record.id,
    agent: 'ai-cto',
    action: 'step:block',
    step: 'staging',
    evidence: 'L3 kapalı — sahne ortamı henüz yok',
  });
}

const page = <T>(items: T[], query: PageQuery): Paged<T> => {
  const pageSize = query.pageSize ?? 20;
  const current = query.page ?? 1;
  const start = (current - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total: items.length, page: current, pageSize };
};

export const mockCto = {
  async policy(): Promise<CtoPolicySummary> {
    const level = currentLevel(policy);
    return {
      version: policy.version,
      autonomy: level.id,
      autonomyName: level.name,
      canDeployStaging: level.canDeployStaging === true,
      canDeployProduction: level.canDeployProduction === true,
      humanApproval: policy.humanApprovalRequired.map((r) => ({ id: r.id, label: r.label })),
      neverSkip: policy.pipeline.fastPath?.neverSkip ?? [],
      steps: policy.pipeline.steps.map((s) => ({ id: s.id, label: s.label, gate: s.gate })),
    };
  },

  async analyze(text: string): Promise<CtoRequest> {
    return analyzeRequest(text);
  },

  async submit(text: string): Promise<CtoRequest> {
    const record = analyzeRequest(text);
    requests.unshift(record);
    log({
      requestId: record.id,
      agent: 'ai-cto',
      action: 'intake',
      step: 'understand',
      evidence: `risk=${record.risk.level} modüller=${record.impact.modules.join('|') || 'yok'}`,
    });
    return record;
  },

  async list(query: PageQuery): Promise<Paged<CtoRequest>> {
    seed();
    const q = query.query?.toLocaleLowerCase('tr-TR') ?? '';
    const items = requests.filter((r) => !q || r.request.toLocaleLowerCase('tr-TR').includes(q));
    return page(items, query);
  },

  async get(id: ID): Promise<CtoRequest | null> {
    seed();
    return requests.find((r) => r.id === id) ?? null;
  },

  async approve(id: ID, evidence: string): Promise<CtoRequest> {
    seed();
    const index = requests.findIndex((r) => r.id === id);
    if (index === -1) throw new Error('Talep bulunamadı');
    if (!evidence.trim()) throw new Error('Onay kanıtsız kaydedilemez');
    const record = requests[index]!;
    const blocked = record.steps.filter((s) => s.status === 'blocked');
    if (!blocked.length) throw new Error('Onay bekleyen adım yok');
    const updated: CtoRequest = {
      ...record,
      steps: record.steps.map((s) =>
        s.status === 'blocked'
          ? { ...s, status: 'pending' as CtoStepStatus, note: 'onaylandı', at: nowIso() }
          : s,
      ),
      approval: { by: 'panel', at: nowIso(), evidence: evidence.trim() },
    };
    requests[index] = updated;
    log({ requestId: id, agent: 'panel', action: 'approve', step: blocked[0]!.id, evidence: evidence.trim() });
    return updated;
  },

  async cancel(id: ID, reason: string): Promise<CtoRequest> {
    seed();
    const index = requests.findIndex((r) => r.id === id);
    if (index === -1) throw new Error('Talep bulunamadı');
    const updated: CtoRequest = { ...requests[index]!, status: 'cancelled' };
    requests[index] = updated;
    log({ requestId: id, agent: 'panel', action: 'cancel', step: null, evidence: reason });
    return updated;
  },

  async audit(query: PageQuery): Promise<Paged<CtoAuditEntry>> {
    seed();
    return page(audit, query);
  },
};

/** Adım özetini panelde göstermek için (kural motorundan gelir). */
export function stepSummary(steps: CtoRequest['steps']) {
  return summarize(steps as unknown as Step[]);
}
