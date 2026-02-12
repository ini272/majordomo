# Current Architecture

Last verified: 2026-02-12

## Source of truth priority

1. Runtime behavior + tests
2. OpenAPI from running backend (`/openapi.json`)
3. This document

## System

- Backend: FastAPI + SQLModel + SQLite + JWT
- Frontend: React 19 + Vite + TypeScript + Tailwind
- Primary domain: household quest system with templates, recurring subscriptions, bounty, corruption, rewards, achievements

## Implemented gameplay systems

- Quest templates and quest instances
- Standalone quests, AI-scribe quests, random quest generation
- Per-user template subscriptions (`/api/subscriptions/*`)
- Daily bounty with 2x rewards
- Corruption debuff for overdue quests
- Reward claims including consumables (XP boost, shield)
- Achievement auto-award on quest completion
- NFC/trigger quest completion route

## High-level API areas

- Auth: `/api/auth/*`
- Quests/templates: `/api/quests/*`
- Subscriptions: `/api/subscriptions/*`
- Bounty: `/api/bounty/*`
- Rewards: `/api/rewards/*`
- Achievements: `/api/achievements/*`
- Users/homes: `/api/users/*`, `/api/homes/*`
- Triggers: `/api/triggers/*`

## Deployment shape

- Local dev: `backend/main.py` + `frontend` Vite dev server
- Container config: `deployment/docker-compose.yml`
