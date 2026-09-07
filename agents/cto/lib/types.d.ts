/**
 * `agents/cto` çekirdeğinin tipleri.
 *
 * Betikler düz JavaScript (bağımlılıksız, Node 22). Yönetim paneli TypeScript
 * olduğu için aynı dosyaları tip güvenli içe aktarabilsin diye bildirimler
 * burada. Kural kopyalanmaz — yalnızca tipi yazılır.
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'blocked';

export interface AutonomyLevel {
  id: string;
  name: string;
  canWriteFiles?: boolean;
  canOpenPr?: boolean;
  canRunGates?: boolean;
  canDeployStaging?: boolean;
  canDeployProduction?: boolean;
  branchPrefix?: string;
  onlyAllowlisted?: boolean;
}

export interface PolicyStep {
  id: string;
  label: string;
  gate: string;
  skippable?: boolean;
}

export interface ApprovalRule {
  id: string;
  label: string;
  detect?: { paths?: string[]; keywords?: string[] };
}

export interface Policy {
  version: number;
  autonomy: { current: string; levels: AutonomyLevel[] };
  level4: { allowlist: { kind: string; paths: string[]; reason: string }[] };
  risk: {
    levels: RiskLevel[];
    default: RiskLevel;
    escalate: Partial<Record<RiskLevel, { paths?: string[]; keywords?: string[] }>>;
  };
  humanApprovalRequired: ApprovalRule[];
  pipeline: {
    steps: PolicyStep[];
    fastPath?: { risk: RiskLevel; skip: string[]; neverSkip: string[] };
  };
  models: Record<string, string[] | { byRisk?: Record<string, string> }>;
  denyPaths: { pattern: string; reason: string }[];
  securityReport: { allowedStatuses: string[]; forbiddenPhrases: string[] };
}

export interface Step {
  id: string;
  label: string;
  gate: string;
  status: StepStatus;
  evidence: string | null;
  note: string | null;
  at: string | null;
}

export interface RiskReason {
  level: RiskLevel;
  kind: 'path' | 'keyword';
  value: string;
}

export interface ApprovalHit {
  id: string;
  label: string;
  because: string;
  kind: 'path' | 'keyword';
}

export interface ImpactMatch {
  module: string;
  term: string;
}

export interface Impact {
  modules: string[];
  matched: ImpactMatch[];
  tables: string[];
  unresolved: boolean;
}
