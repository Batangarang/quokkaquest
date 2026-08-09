# QuokkaQuest App

Family chore/task management app — see `docs/choirs-tasks-app-spec.md` for the full
feature spec, `docs/architecture-decision.md` for the stack rationale, and
`docs/multi-tenant-gdpr-plan.md` for the data model and compliance plan.

**Phase 1 status:** core spine scaffolded — accounts/roles, task engine (create,
assign, complete, rate 1–5), basic money calc, simple list-view dashboard, and a
guardian-only "Add a task" form (parents no longer need to insert tasks via SQL —
only accounts still require that, see below).
Not yet built: scheduling/calendar, badges, league table, kindness logs, theming,
age multipliers, savings/IOU, events, and marking/rating a task complete from the
UI (the API endpoint exists — `POST /api/tasks/:taskId/complete` — but there's no
form for it yet). See `docs/choirs-tasks-app-spec.md` for the full phase breakdown.

## Getting started (in GitHub Codespaces or locally)

```bash
npm install

# Start Postgres (migrations auto-apply on first container start via
# infra/postgres/migrations mounted into docker-entrypoint-initdb.d)
cd infra && docker compose up -d postgres && cd ..

# Copy env and fill in JWT_SECRET
cp apps/api/.env.example apps/api/.env

# Terminal 1
npm run dev:api

# Terminal 2
npm run dev:web
```

Web dev server: http://localhost:5173 (proxies `/api` to the backend on :4000).

## Creating a test user

No signup flow yet in Phase 1 (parents are provisioned directly, per the
household/guardian/child model) — insert manually for now:

```sql
INSERT INTO households (name) VALUES ('Smith Household') RETURNING id;

-- bcrypt-hash a password first, e.g. via `node -e "console.log(require('bcrypt').hashSync('yourpassword', 12))"`
INSERT INTO users (household_id, role, display_name, username, password_hash)
VALUES ('<household-id>', 'owner', 'Parent A', 'parent_a', '<bcrypt-hash>');
```

A proper admin-facing "add family member" flow is a near-term follow-up, not yet built.

## Tests

```bash
npm run test --workspace=apps/api
```

Integration tests require the Postgres container running with migrations applied
(see `apps/api/__tests__/integration/`).

## Repo layout

See `docs/coding-conventions.md` for naming, branching, and structure conventions.
