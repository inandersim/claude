import { createRemoteProvider } from '@/data/remote/provider';
import type { DataProvider } from '@/data/repositories';

import {
  createPgHarness,
  isPostgresLikelyAvailable,
  type PgHarness,
} from './contract/pgHarness';
import { runContractScenarios, type ContractHarness } from './contract/scenarios';

/**
 * Ortak sözleşme senaryolarının **uzak sağlayıcı** koşumu.
 *
 * Gerçek bir Supabase sunucusu gerekmez: `supabase/test/run.sh` ile kurulmuş
 * yerel Postgres+PostGIS şablonundan her koşumda yeni bir veritabanı üretilir
 * ve uzak sağlayıcı doğrudan ona bağlanır (bkz. `contract/pgPostgrest.ts`).
 *
 * Postgres yoksa paket atlanır; kurulum:
 *   PGHOST=/tmp PGPORT=54329 PGUSER=postgres ./supabase/test/run.sh
 */
let pg: PgHarness | null = null;
let provider: DataProvider | null = null;
/** `describe` seçimi eşzamanlı yapılmalı; bu yüzden soket kontrolü kullanılır. */
const available = isPostgresLikelyAvailable();

beforeAll(async () => {
  if (!available) return;
  pg = await createPgHarness(`contract_${process.pid}`);
  provider = createRemoteProvider(pg.ctx.db);
}, 120_000);

afterAll(async () => {
  if (pg) await pg.close();
});

const harness = (): ContractHarness => {
  if (!provider || !pg) throw new Error('Postgres yok');
  return {
    label: 'remote',
    provider,
    signIn: (userId) => pg!.signIn(userId),
  };
};

const describeIfPg = () => (available ? describe : describe.skip);

if (!available) {
  console.warn(
    '[sözleşme] Yerel Postgres bulunamadı — uzak sağlayıcı senaryoları atlandı. Kurulum:\n' +
      '  PGHOST=/tmp PGPORT=54329 PGUSER=postgres ./supabase/test/run.sh\n' +
      '  (ya da ZIRTAN_TEST_PG=1 ile TCP bağlantısını zorla)',
  );
}

describeIfPg()('sözleşme · uzak sağlayıcı (yerel Postgres)', () => {
  it('uzak sağlayıcı gerçek veritabanına bağlanır', () => {
    expect(provider).not.toBeNull();
  });

  runContractScenarios(harness);
});
