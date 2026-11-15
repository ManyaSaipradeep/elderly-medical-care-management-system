import 'server-only';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';

const url = process.env.DATABASE_URL;

// One pool per server process. Reused across hot reloads in development.
const g = globalThis as unknown as { __ccPool?: Pool };
export const pool =
  g.__ccPool ??
  new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30_000,
    ssl: url && /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined,
  });
if (process.env.NODE_ENV !== 'production') g.__ccPool = pool;

export async function q<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

export async function logActivity(circleId: string, actor: string, action: string) {
  await q('insert into activity (circle_id, actor, action) values ($1,$2,$3)', [circleId, actor, action]);
}

export function log(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ t: new Date().toISOString(), event, ...data }));
}
