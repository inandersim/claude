import type { AiRepository } from '@/data/repositories';

import type { MockContext } from '../context';

const notReady = (): never => {
  throw new Error('ai modülü henüz uygulanmadı');
};

/** ai modülü mock repository fabrikası. */
export function createAiRepository(_ctx: MockContext): AiRepository {
  return new Proxy({} as AiRepository, { get: () => notReady });
}
