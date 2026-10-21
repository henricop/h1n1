import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  /** Executa várias instruções SQL sem parâmetros (migrações). */
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  readonly kind: 'pglite' | 'pg';
}

export interface DbOptions {
  /** postgres://... usa node-postgres; vazio usa PGlite */
  databaseUrl?: string | null;
  /** diretório PGlite; 'memory://' para testes */
  pgliteDir?: string;
}

const here = dirname(fileURLToPath(import.meta.url));

function migrationsDir(): string {
  // dist/migrations (após build) ou ../migrations (tsx em src)
  const candidates = [join(here, 'migrations'), join(here, '..', 'migrations')];
  for (const c of candidates) {
    try {
      readdirSync(c);
      return c;
    } catch {
      /* próxima */
    }
  }
  throw new Error('Diretório de migrações não encontrado');
}

export async function createDb(opts: DbOptions = {}): Promise<Db> {
  const url = opts.databaseUrl ?? process.env.DATABASE_URL ?? '';
  if (url) return createPg(url);
  const dir = opts.pgliteDir ?? process.env.PGLITE_DIR ?? defaultPgliteDir();
  return createPglite(dir);
}

function defaultPgliteDir(): string {
  const dir = join(here, '..', '..', '..', 'data', 'pglite');
  mkdirSync(dir, { recursive: true });
  return dir;
}

async function createPglite(dir: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  const pg = dir === 'memory://' ? new PGlite() : new PGlite(dir);
  await pg.waitReady;
  const wrap = (
    runner: { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[] }>; exec: (s: string) => Promise<unknown> },
    tx = false,
  ): Db => ({
    kind: 'pglite',
    async query<T>(sql: string, params: unknown[] = []) {
      const r = await runner.query(sql, params);
      return { rows: r.rows as T[], rowCount: r.rows.length };
    },
    async exec(sql: string) {
      await runner.exec(sql);
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      if (tx) return fn(this);
      return pg.transaction(async (t) => fn(wrap(t as never, true)));
    },
    async close() {
      if (!tx) await pg.close();
    },
  });
  return wrap(pg as never);
}

async function createPg(url: string): Promise<Db> {
  const pgMod = await import('pg');
  const Pool = pgMod.default?.Pool ?? (pgMod as unknown as { Pool: typeof pgMod.Pool }).Pool;
  const pool = new Pool({ connectionString: url });
  const wrapClient = (c: { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }> }): Db => ({
    kind: 'pg',
    async query<T>(sql: string, params: unknown[] = []) {
      const r = await c.query(sql, params);
      return { rows: r.rows as T[], rowCount: r.rowCount ?? r.rows.length };
    },
    async exec(sql: string) {
      await c.query(sql);
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      return fn(this);
    },
    async close() {},
  });
  return {
    kind: 'pg',
    async query<T>(sql: string, params: unknown[] = []) {
      const r = await pool.query(sql, params);
      return { rows: r.rows as T[], rowCount: r.rowCount ?? r.rows.length };
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const out = await fn(wrapClient(client));
        await client.query('commit');
        return out;
      } catch (e) {
        await client.query('rollback');
        throw e;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

export async function migrate(db: Db): Promise<string[]> {
  const dir = migrationsDir();
  await db.query(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
  const applied = new Set((await db.query<{ name: string }>('select name from schema_migrations')).rows.map((r) => r.name));
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const done: string[] = [];
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = readFileSync(join(dir, f), 'utf8');
    await db.exec(sql);
    await db.query('insert into schema_migrations(name) values ($1)', [f]);
    done.push(f);
  }
  return done;
}
