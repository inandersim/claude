import type { ApprovalHit, Policy, RiskLevel, RiskReason } from './types';

export function maxLevel(a: RiskLevel, b: RiskLevel): RiskLevel;
export function classify(
  input: { text?: string; paths?: string[] },
  policy: Policy,
): { level: RiskLevel; reasons: RiskReason[] };
export function escalateTo(
  current: RiskLevel,
  proposed: RiskLevel,
): { level: RiskLevel; changed: boolean; rejected: boolean };
export function approvalsRequired(
  input: { text?: string; paths?: string[] },
  policy: Policy,
): ApprovalHit[];
export function modelFor(step: string, level: RiskLevel, policy: Policy): string;
