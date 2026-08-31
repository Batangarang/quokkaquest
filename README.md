# QuokkaQuest App

Family chore/task management app — see `docs/choirs-tasks-app-spec.md` for the full
feature spec, `docs/architecture-decision.md` for the stack rationale, and
`docs/multi-tenant-gdpr-plan.md` for the data model and compliance plan.

**Phase 1 status:** core spine scaffolded — accounts/roles, task engine (create,
assign, complete, rate 1–5, with a "mark complete" form for it), basic money
calc, simple list-view dashboard, and a guardian-only "Add a task" form
(parents no longer need to insert tasks via SQL — only accounts still require
that, see below).
Not yet built: scheduling/calendar, badges, league table, kindness logs,
theming, age multipliers, savings/IOU, events. See `docs/choirs-tasks-app-spec.md`
for the full phase breakdown.

## Getting started (in GitHub Codespaces or locally)

```bash
npm install

# Start Postgres
cd infra && docker compose up -d postgres && cd ..

# Copy env and fill in JWT_SECRET
cp apps/api/.env.example apps/api/.env

# Apply migrations (tracked in schema_migrations, safe to re-run)
npm run migrate:dev --workspace=apps/api

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

## Deploying (quick/free, for testing on a phone etc.)

`render.yaml` is a [Render](https://render.com) Blueprint: a free Postgres
database, the API as a Docker web service (`infra/api.Dockerfile`, running
migrations automatically via `apps/api/src/scripts/migrate.ts` on every
container boot, before the server starts), and the web app as a static site.

1. Sign up at render.com, then **New +** → **Blueprint** → connect this repo.
   Render detects `render.yaml` and creates all three services — click Apply.
2. Once the `quokkaquest-api` service is live, check its assigned URL. If it
   isn't `https://quokkaquest-api.onrender.com` (the name was already taken),
   update the `destination` in the `quokkaquest-web` service's `/api/*`
   rewrite rule in `render.yaml` to match, then redeploy.
3. Create your first household/user the same way as local dev (see
   "Creating a test user" above), using the `psql` connection string from the
   Render Postgres dashboard.

Free-tier caveats: the API service spins down after 15 minutes idle (first
request after that is slow to wake up), and the free database is deleted
after 30 days unless upgraded. This isn't the production Oracle VM path
described in `docs/architecture-decision.md` — just the fastest way to get a
real URL for testing.
