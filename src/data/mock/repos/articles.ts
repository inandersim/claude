import type { ArticleRepository } from '@/data/repositories';

import type { MockContext } from '../context';

const notReady = (): never => {
  throw new Error('articles modülü henüz uygulanmadı');
};

/** articles modülü mock repository fabrikası. */
export function createArticleRepository(_ctx: MockContext): ArticleRepository {
  return new Proxy({} as ArticleRepository, { get: () => notReady });
}
