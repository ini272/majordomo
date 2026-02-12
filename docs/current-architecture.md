# Current Architecture & Source of Truth

## Purpose

This document is the canonical snapshot of Majordomo's current architecture and implementation status.

Use this file for onboarding and planning. If another document conflicts with this one, treat this file as authoritative unless code/API behavior proves otherwise.

## Canonical Sources (Priority Order)

1. **Runtime behavior + tests** (actual backend/frontend code and passing test suite)
2. **OpenAPI schema from running backend** (`/openapi.json`)
3. **This document** (`docs/current-architecture.md`)
4. Supporting design/planning notes

## System Overview

- **Backend:** FastAPI + SQLModel + SQLite + JWT auth
- **Frontend:** React + Vite + TypeScript + Tailwind + Framer Motion
- **Primary goal:** self-hosted, mobile-first gamified household quest system for shared homes (content tone can be tailored per household)

## Gameplay Systems (Current)

- Quest templates and quest instances
- Daily bounty rotation
- Corruption/debuff mechanics for overdue quests
- Reward marketplace with consumables
- Achievement criteria and unlock flow
- NFC trigger route for quick quest completion

## Documentation Status

### Canonical / Keep Updated

- `docs/current-architecture.md` (this file)
- `docs/api-contract-governance.md`
- `claude.md` (high-level quickstart and structure)

### Contextual / May Reflect Earlier Phases

These files remain valuable for background context, but may include phase-specific assumptions:

- `QUEST_SYSTEM_NOTES.md`
- `backend/achievements.md`
- `backend/validation.md`
- `backend/error_codes.md`
- `frontend/FONT_DEBUG_*`

When in doubt, verify against code and OpenAPI.

## Maintenance Rules

- Update this file whenever architecture, core flow, or major endpoint patterns change.
- If you add or change APIs, update `docs/api-contract-governance.md` and regenerate/verify OpenAPI contract.
- Keep this file concise: architecture and truth sources only.
