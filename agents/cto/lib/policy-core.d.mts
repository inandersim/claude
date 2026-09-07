import type { AutonomyLevel, Policy } from './types';

export function assertPolicyShape(p: unknown, source?: string): Policy;
export function currentLevel(policy: Policy): AutonomyLevel;
export function can(capability: string, policy: Policy): boolean;
export function matchPath(pattern: string, path: string): boolean;
export function denyReason(path: string, policy: Policy): string | null;
