import { createMockProvider } from '@/data/mock/provider';
import type { DataProvider } from '@/data/repositories';

import { runContractScenarios, type ContractHarness } from './contract/scenarios';

/**
 * Ortak sözleşme senaryolarının **mock sağlayıcı** koşumu.
 * Aynı senaryolar `remoteProviderContract.test.ts` içinde gerçek Postgres'e
 * bağlı uzak sağlayıcıya karşı da çalışır.
 */
let provider: DataProvider;

beforeAll(() => {
  provider = createMockProvider({ persist: false, latencyMs: 0 });
});

const harness = (): ContractHarness => ({
  label: 'mock',
  provider,
  // Mock sağlayıcı kimliği parametre olarak alır; oturum kavramı gerekmez.
  signIn: () => undefined,
});

describe('sözleşme · mock sağlayıcı', () => {
  runContractScenarios(harness);
});
