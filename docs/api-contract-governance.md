# API Contract Governance

Last verified: 2026-02-12

## Source of truth

- OpenAPI served by backend (`/openapi.json`) is authoritative.
- Runtime behavior and tests take precedence over prose.

## API change workflow

1. Change backend route/schema.
2. Run backend tests.
3. Verify OpenAPI reflects intended contract.
4. Update frontend API layer/types if needed.
5. Update `docs/current-architecture.md` when behavior changed.

## Breaking change policy

Breaking changes require coordinated backend+frontend updates in the same branch:
- Removed/renamed endpoints
- Removed/renamed required fields
- Semantic changes to existing fields

## PR checklist (API-affecting)

- [ ] Backend tests pass
- [ ] OpenAPI reviewed
- [ ] Frontend API impact handled
- [ ] `docs/current-architecture.md` updated if behavior changed
