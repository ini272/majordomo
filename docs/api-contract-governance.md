# API Contract Governance

## Goal

Define one API source of truth and remove frontend/backend documentation drift.

## Source of Truth

- **OpenAPI schema served by backend is authoritative**.
- Canonical endpoint/schema view: `GET /openapi.json` from the running API.

## Contract Workflow

1. Make backend route/schema changes.
2. Run backend tests.
3. Verify OpenAPI reflects intended contract.
4. Update frontend API layer/types from OpenAPI.
5. Validate frontend builds and key flows.

## Change Policy

### Non-breaking changes

Allowed in normal feature work:

- Additive response fields
- New optional request fields
- New endpoints

### Breaking changes

Require explicit coordination:

- Renamed/removed endpoints
- Renamed/removed required fields
- Changed semantics for existing fields

For breaking changes:

- Document migration notes in PR
- Update all consumers in same branch before merge

## PR Checklist (API-affecting work)

- [ ] Backend tests pass
- [ ] OpenAPI schema reviewed
- [ ] Frontend API client/types updated (or no frontend impact)
- [ ] Error code behavior unchanged or documented
- [ ] `docs/current-architecture.md` updated if system behavior changed

## Short-Term Plan

- Keep using current handwritten frontend API layer.
- In a follow-up, add OpenAPI-driven type generation for frontend client types.
