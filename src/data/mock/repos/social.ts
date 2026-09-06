import type { SocialRepository } from '@/data/repositories';

import type { MockContext } from '../context';

const notReady = (): never => {
  throw new Error('social modülü henüz uygulanmadı');
};

/** social modülü mock repository fabrikası. */
export function createSocialRepository(_ctx: MockContext): SocialRepository {
  return new Proxy({} as SocialRepository, { get: () => notReady });
}
