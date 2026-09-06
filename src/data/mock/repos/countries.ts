import type { CountryRepository } from '@/data/repositories';

import type { MockContext } from '../context';

const notReady = (): never => {
  throw new Error('countries modülü henüz uygulanmadı');
};

/** countries modülü mock repository fabrikası. */
export function createCountryRepository(_ctx: MockContext): CountryRepository {
  return new Proxy({} as CountryRepository, { get: () => notReady });
}
