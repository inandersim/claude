import type { Impact } from './types';

export const ALIASES: Record<string, string[]>;
export function containsTerm(hay: string, term: string): boolean;
export function analyzeImpact(
  text: string,
  options?: { modules?: string[]; tables?: string[] },
): Impact;
