-- 0001_init_schema.sql
-- Phase 1 core spine: households, users (guardian/child), tasks, task_completions.
-- Multi-tenant isolation: household_id on every table, enforced server-side (see api
-- middleware) with RLS here as defence-in-depth (see docs/multi-tenant-gdpr-plan.md).
--
-- Migrations are never edited after merge — create a new migration file to fix a mistake.

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- ── Households ──────────────────────────────────────────────────────────────

CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Users (guardians + children) ────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('owner', 'co-admin', 'viewer', 'child');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  display_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE, -- login handle for all accounts, incl. children
  email TEXT UNIQUE, -- guardians only; children don't need one (minimise data collected, AADC)
  password_hash TEXT NOT NULL,
  theme TEXT, -- 'animals' | 'makeup-slime-fidget' etc, child accounts only
  date_of_birth DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_household_id ON users(household_id);

-- ── Tasks ────────────────────────────────────────────────────────────────────

CREATE TYPE task_category AS ENUM ('chore', 'task');
CREATE TYPE task_recurrence AS ENUM ('once', 'daily', 'weekly', 'monthly', 'custom');

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_value_pence INTEGER NOT NULL CHECK (base_value_pence >= 0),
  category task_category NOT NULL,
  recurrence task_recurrence NOT NULL DEFAULT 'once',
  late_deduction_percent SMALLINT NOT NULL DEFAULT 0 CHECK (late_deduction_percent BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_household_id ON tasks(household_id);

-- Many-to-many: a task can be assigned to one or more children
CREATE TABLE task_assignments (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX idx_task_assignments_household_id ON task_assignments(household_id);

-- ── Task completions (one row per scheduled occurrence per child) ──────────

CREATE TABLE task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_for DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  is_late BOOLEAN NOT NULL DEFAULT false,
  earned_value_pence INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id, scheduled_for)
);

CREATE INDEX idx_task_completions_household_id ON task_completions(household_id);
CREATE INDEX idx_task_completions_user_id ON task_completions(user_id);

-- ── Row-Level Security (defence-in-depth; app layer is the primary enforcement) ──
-- Policy naming convention: <table>_household_isolation (see docs/coding-conventions.md)
-- Application connects using a role that sets app.current_household_id per request/session.

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY households_household_isolation ON households
  USING (id = current_setting('app.current_household_id', true)::uuid);

CREATE POLICY users_household_isolation ON users
  USING (household_id = current_setting('app.current_household_id', true)::uuid);

CREATE POLICY tasks_household_isolation ON tasks
  USING (household_id = current_setting('app.current_household_id', true)::uuid);

CREATE POLICY task_assignments_household_isolation ON task_assignments
  USING (household_id = current_setting('app.current_household_id', true)::uuid);

CREATE POLICY task_completions_household_isolation ON task_completions
  USING (household_id = current_setting('app.current_household_id', true)::uuid);
