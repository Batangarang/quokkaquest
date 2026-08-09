import { Pool, type PoolClient } from 'pg';
import { env } from '../config/env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

/**
 * Runs a query within a transaction that has `app.current_household_id` set,
 * so the Postgres RLS policies (see infra/postgres/migrations/0001_init_schema.sql)
 * can enforce tenant isolation as defence-in-depth underneath the application-layer
 * check that already scopes every query by household_id explicitly.
 *
 * Every request-handling code path must go through this — never `pool.query`
 * directly — once a household context exists (i.e. everywhere except auth/login).
 */
export async function withHouseholdContext<T>(
  householdId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // set_config with is_local=true scopes this to the current transaction only
    await client.query('SELECT set_config($1, $2, true)', [
      'app.current_household_id',
      householdId,
    ]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
