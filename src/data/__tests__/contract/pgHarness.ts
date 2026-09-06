import fs from 'node:fs';
import path from 'node:path';

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

/** PGPORT verilmediğinde denenecek yaygın portlar (soket dosyasına bakılır). */
const CANDIDATE_PORTS = [54329, 54322, 5432];

function detectSocketPort(host: string): number {
  for (const port of CANDIDATE_PORTS) {
    try {
      if (fs.existsSync(path.join(host, `.s.PGSQL.${port}`))) return port;
    } catch {
      /* yoksay */
    }
  }
  return CANDIDATE_PORTS[0]!;
}

export function readPgEnv(env: NodeJS.ProcessEnv = process.env): PgEnv {
  const host = env.PGHOST ?? '/tmp';
  return {
    host,
    port: Number(env.PGPORT ?? (host.startsWith('/') ? detectSocketPort(host) : 5432)),
    user: env.PGUSER ?? 'postgres',
    password: env.PGPASSWORD,
    template: env.ZIRTAN_TEST_DB ?? 'zirtan_test',
  };
}

/**
 * Jest `describe` seçimi için **eşzamanlı** ön kontrol.
 *
 * · `ZIRTAN_TEST_PG=1|0` açıkça belirler.
 * · PGHOST bir dizin yoluysa (unix soketi) soket dosyasına bakılır.
 * · TCP bağlantısında eşzamanlı kontrol mümkün olmadığından açık bayrak istenir.
 */
export function isPostgresLikelyAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = env.ZIRTAN_TEST_PG?.trim();
  if (flag === '1' || flag === 'true') return true;
  if (flag === '0' || flag === 'false') return false;
  const cfg = readPgEnv(env);
  if (!cfg.host.startsWith('/')) return false;
  try {
    return fs.existsSync(path.join(cfg.host, `.s.PGSQL.${cfg.port}`));
  } catch {
    return false;
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
    // `ALTER DATABASE ... SET search_path` şablondan kopyalanmaz; PostGIS
    // tipleri `extensions` şemasında olduğu için yeniden ayarlanır.
    await admin.query(`ALTER DATABASE ${database} SET search_path = public, extensions`);
  } finally {
    await admin.end();
  }

  const pool = new Pool({
    ...env,
    database,
    max: 4,
    options: '-c search_path=public,extensions',
  });
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
