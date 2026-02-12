# Documentation Index & Lifecycle

This file clarifies which Markdown docs are canonical, which are active implementation references, and which are historical/contextual notes.

## Start Point

- Begin with `docs/README.md` to navigate docs quickly.

## Canonical (Source of Truth)

1. Runtime behavior and tests
2. OpenAPI schema from running backend (`/openapi.json`)
3. `docs/current-architecture.md`
4. `docs/api-contract-governance.md`

If a document conflicts with the above, treat it as stale context and verify in code/OpenAPI.

## Actively Maintained Orientation Docs

- `claude.md`
- `backend/claude.md`
- `frontend/claude.md`
- `DESIGN.md`
- `docs/current-architecture.md`
- `docs/api-contract-governance.md`
- `docs/documentation-index.md` (this file)

## Contextual / Potentially Historical Docs

These remain useful but may represent specific snapshots in time:

- `QUEST_SYSTEM_NOTES.md`
- `12_01_26_plan.md`
- `backend/achievements.md`
- `backend/validation.md`
- `backend/error_codes.md`
- `frontend/FONT_DEBUG_SUMMARY.md`
- `frontend/FONT_DEBUG_GUIDE.md`
- `CLOUDFLARE_TUNNEL_SETUP.md`
- `NFC_SETUP.md`

## Legacy Policy

- Keep historical docs when they still provide rationale or migration context.
- Add a short “Status” note at the top when a doc is known to be phase-bound or partially stale.
- Prefer updating canonical docs over deleting history unless a file is fully obsolete and misleading.
