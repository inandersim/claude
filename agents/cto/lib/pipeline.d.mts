import type { Policy, RiskLevel, Step, StepStatus } from './types';

export const PENDING: 'pending';
export const RUNNING: 'running';
export const PASSED: 'passed';
export const FAILED: 'failed';
export const SKIPPED: 'skipped';
export const BLOCKED: 'blocked';

export function initialSteps(risk: RiskLevel, policy: Policy): Step[];
export function nextStep(steps: Step[]): Step | null;
export function isBlocked(steps: Step[]): boolean;
export function isComplete(steps: Step[]): boolean;
export function applyResult(
  steps: Step[],
  id: string,
  result: { status: StepStatus; evidence?: string | null; note?: string | null; at?: string },
  policy: Policy,
): Step[];
export function summarize(steps: Step[]): {
  total: number;
  passed: number;
  skipped: number;
  failed: number;
  blocked: number;
  current: string | null;
  complete: boolean;
  stuck: boolean;
};
