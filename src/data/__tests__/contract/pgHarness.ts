import { Pool } from 'pg';

import { createRemoteContext, type RemoteContext } from '@/data/remote/context';

import { createPgPostgrest } from './pgPostgrest';

/**
 * Sözleşme testleri için yerel Postgres bağlantısı.
 *
 * `supabase/test/run.sh` ile kurulan şablon veritabanından (varsayılan
 * `zirtan_test`) her koşumda yeni bir kopya üretir; testler birbirini
 * etkilemez ve şablon bozulmaz.
 */

export interface PgEnv {
  host: string;
  port: number;
  user: string;
  password?: string;
  template: string;
}

export function readPgEnv(env: NodeJS.ProcessEnv = process.env): PgEnv {
  return {
    host: env.PGHOST ?? '/tmp',
    port: Number(env.PGPORT ?? 54329),
    user: env.PGUSER ?? 'postgres',
    password: env.PGPASSWORD,
    template: env.ZIRTAN_TEST_DB ?? 'zirtan_test',
  };
}

/** Şablon veritabanına ulaşılabiliyor mu (yoksa sözleşme testleri atlanır). */
export async function isPostgresAvailable(env = readPgEnv()): Promise<boolean> {
  const pool = new Pool({ ...env, database: env.template, connectionTimeoutMillis: 1500, max: 1 });
  try {
    await pool.query('SELECT 1 FROM profiles LIMIT 1');
    return true;
  } catch {
    return false;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export interface PgHarness {
  pool: Pool;
  ctx: RemoteContext;
  database: string;
  /** Etkin kullanıcıyı değiştirir (RPC'lerde `auth.uid()`). */
  signIn(userId: string | null): void;
  close(): Promise<void>;
}

/** Şablondan yeni bir veritabanı üretir ve uzak sağlayıcı bağlamını kurar. */
export async function createPgHarness(suffix: string, env = readPgEnv()): Promise<PgHarness> {
  const database = `zirtan_ct_${suffix}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const admin = new Pool({ ...env, database: 'postgres', max: 1 });
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${database}`);
    await admin.query(`CREATE DATABASE ${database} TEMPLATE ${env.template}`);
  } finally {
    await admin.end();
  }

  const pool = new Pool({ ...env, database, max: 4 });
  let userId: string | null = null;
  const client = createPgPostgrest(pool, {
    getUserId: () => userId,
    setUserId: (id) => {
      userId = id;
    },
  });
  const ctx = createRemoteContext(client);

  return {
    pool,
    ctx,
    database,
    signIn(id) {
      userId = id;
      ctx.setSessionUserId(id);
    },
    async close() {
      await pool.end();
      const cleanup = new Pool({ ...env, database: 'postgres', max: 1 });
      try {
        await cleanup.query(`DROP DATABASE IF EXISTS ${database}`);
      } catch {
        /* temizlik hatası testleri düşürmesin */
      } finally {
        await cleanup.end();
      }
    },
  };
}
