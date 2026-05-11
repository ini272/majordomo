# Architecture Review (2026-05-11)

Scope reviewed:

- `backend/app/main.py`
- `backend/app/database.py`
- Route / CRUD / service layering under `backend/app/`
- Migration posture under `backend/migrations/`
- `docs/current-architecture.md`

## Major architectural issues

### 1) Runtime schema mutation in app startup

`ensure_runtime_schema_compatibility()` executes DDL (`ALTER TABLE`, index creation) and data backfills on every startup path. This couples app availability to schema evolution and can create non-deterministic deploy behavior across environments.

Why this is high risk:

- Startup can fail or stall due to DDL lock/contention.
- Rollbacks become ambiguous (app code may mutate DB unexpectedly).
- Multiple app instances can race on startup in containerized deployments.

Preferred direction:

- Move all schema changes + data backfills into Alembic migrations only.
- Keep startup path read-only (health checks, dependency wiring, warm caches).
- Add explicit one-time “legacy backfill complete” migration to retire compatibility code.

### 2) Mixed migration strategy (Alembic + `create_all`)

Startup currently calls both `SQLModel.metadata.create_all(engine)` and migration compatibility logic. This blurs source-of-truth for schema management.

Why this matters:

- Drift risk between ORM metadata and migration history.
- Local/dev/prod parity gets weaker over time.
- Harder incident response because actual schema path is unclear.

Preferred direction:

- Production/staging: migrations only.
- Local/test bootstrap: either migrations or controlled test fixture DB creation, but not both in app boot path.

### 3) OpenAPI security decoration is path-prefix brittle

`custom_openapi()` marks routes as public/private using string prefix exceptions (`public_paths = ["/api/auth/login", "/api/homes/"]`). This is fragile as routes evolve.

Why this matters:

- Easy to accidentally expose or mis-document auth requirements when adding endpoints.
- Security intent is implicit and centralized in string matching logic instead of endpoint declarations.

Preferred direction:

- Define auth/public semantics at route dependency level and derive docs from route metadata.
- Keep a minimal allowlist only for truly unauthenticated endpoints with exact method/path mapping tests.

### 4) Domain logic split across routes/CRUD/services without strict boundaries

Project has all three layers (`routes`, `crud`, `services`), but boundaries are not enforced and logic can leak into route modules over time.

Why this matters:

- Growth risk: harder unit testing and reuse if business rules live in endpoints.
- Inconsistent transaction boundaries and side-effects.

Preferred direction:

- Formalize “application service” layer as owner of business workflows.
- Keep routes thin (validation + serialization), CRUD thin (persistence primitives), services thick (domain rules).
- Add lightweight architecture tests or lint conventions to protect boundaries.

### 5) SQLite-default posture may become bottleneck for concurrent deploy targets

Current default DB is SQLite and includes connection flags tailored for local simplicity. This is fine for local/small deployments but risky for multi-instance/container production workloads.

Why this matters:

- Write-concurrency constraints and locking behavior under load.
- Operational limits for reliability, backups, and observability.

Preferred direction:

- Keep SQLite for local dev.
- Establish PostgreSQL as production target with environment-specific settings and migration CI checks.

## Not immediately critical but worth scheduling

- CORS default behavior (`*` in non-production) is acceptable for dev but should be environment-profiled and tested explicitly.
- Centralized startup includes multiple concerns (env loading, DB bootstrap, OpenAPI customization). Consider extracting bootstrap module(s) for clarity.

## Suggested execution order (lowest disruption first)

1. Add migrations for all startup schema mutations still in compatibility code.
2. Ship one “backfill complete” release and monitor.
3. Remove runtime schema mutation and `create_all` from runtime startup in non-test envs.
4. Add endpoint-level auth contract tests and simplify OpenAPI security patching.
5. Formalize route/service/CRUD boundaries with code conventions and test coverage.
