import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { pool } from '../db/pool';

// Applies infra/postgres/migrations/*.sql that haven't run yet, tracked in a
// schema_migrations table. Needed for any deploy target that doesn't apply SQL
// files via docker-entrypoint-initdb.d the way local docker-compose does (e.g.
// a managed Postgres on Render/Railway/etc — see render.yaml's preDeployCommand).
const migrationsDir =
  process.env.MIGRATIONS_DIR ?? path.join(__dirname, '../../../../infra/postgres/migrations');

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const { rows: applied } = await pool.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations',
  );
  const appliedSet = new Set(applied.map((row) => row.filename));

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`Skipping ${file} (already applied)`);
      continue;
    }

    console.log(`Applying ${file}`);
    const sql = readFileSync(path.join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
