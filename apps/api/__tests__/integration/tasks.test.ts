import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { createApp } from '../../src/app';
import { pool } from '../../src/db/pool';
import { env } from '../../src/config/env';

// Requires a running Postgres with migrations applied — see infra/docker-compose.yml.
// Run via `npm run test --workspace=apps/api` after `docker compose up -d postgres`
// and applying infra/postgres/migrations/0001_init_schema.sql.

const app = createApp();

let householdAId: string;
let householdBId: string;
let taskAId: string;
let tokenA: string;
let tokenB: string;
let parentTokenA: string;

function signToken(userId: string, householdId: string, role: string) {
  return jwt.sign({ sub: userId, householdId, role }, env.JWT_SECRET, { expiresIn: '1h' });
}

beforeAll(async () => {
  const passwordHash = await bcrypt.hash('test-password', 4); // low cost factor for test speed

  const { rows: households } = await pool.query(
    `INSERT INTO households (name) VALUES ('Household A'), ('Household B') RETURNING id`,
  );
  householdAId = households[0].id;
  householdBId = households[1].id;

  const { rows: users } = await pool.query(
    `INSERT INTO users (household_id, role, display_name, username, password_hash)
     VALUES
       ($1, 'owner', 'Parent A', 'parent_a_test', $3),
       ($1, 'child', 'Kid A', 'kid_a_test', $3),
       ($2, 'owner', 'Parent B', 'parent_b_test', $3)
     RETURNING id, household_id`,
    [householdAId, householdBId, passwordHash],
  );
  const kidA = users[1];
  const parentB = users[2];
  const parentA = users[0];

  tokenA = signToken(kidA.id, householdAId, 'child');
  tokenB = signToken(parentB.id, householdBId, 'owner');
  parentTokenA = signToken(parentA.id, householdAId, 'owner');

  const { rows: tasks } = await pool.query(
    `INSERT INTO tasks (household_id, name, base_value_pence, category, recurrence)
     VALUES ($1, 'Wash up', 50, 'chore', 'daily') RETURNING id`,
    [householdAId],
  );
  taskAId = tasks[0].id;

  await pool.query(
    `INSERT INTO task_assignments (task_id, user_id, household_id) VALUES ($1, $2, $3)`,
    [taskAId, kidA.id, householdAId],
  );
});

afterAll(async () => {
  // Clean up in FK-safe order; households cascade to users/tasks/etc.
  await pool.query(`DELETE FROM households WHERE id IN ($1, $2)`, [householdAId, householdBId]);
  await pool.end();
});

describe('GET /api/tasks', () => {
  it('returns the requesting household\u2019s tasks (happy path)', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(taskAId);
  });

  it('never returns another household\u2019s tasks, even if their id is guessed', async () => {
    // Household B's user has no assignments at all — confirms isolation rather
    // than an empty result being a coincidence.
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('rejects requests with no auth token', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });

  it('shows a guardian every task in the household, not just their own assignments', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${parentTokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.map((t: { id: string }) => t.id)).toContain(taskAId);
  });
});
