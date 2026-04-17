# Current Architecture

Last verified: 2026-04-16

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
- Shared quest participants via `quest_participant`
- Standalone quests, AI-scribe quests, random quest generation
- Per-user template subscriptions (`/api/subscriptions/*`)
- Per-user daily bounty with 3x gold on the user's quest share
- Corruption debuff for overdue quests
- Reward claims including consumables (XP boost, shield)
- Achievement auto-award on quest completion
- NFC/trigger quest completion route

## Quest ownership and rewards

- `quest.user_id` remains as the legacy primary participant for compatibility. It is the first
  participant selected at creation/update time, not the only assignee.
- Multi-user participation is stored in `quest_participant` with one row per quest/user.
- `quest.xp_reward` and `quest.gold_reward` are the base total quest rewards.
- On completion, base XP/gold are split across participants, preserving integer totals with deterministic remainder assignment by user id.
- Per-user effects are applied to each participant's share after splitting: daily bounty, corruption/shield, and XP boost.
- Actual awarded XP/gold are stored on `quest_participant.xp_awarded` and `quest_participant.gold_awarded`.
- Runtime schema compatibility creates/backfills `quest_participant` rows for existing quests from legacy `quest.user_id`.
  Keep this idempotent compatibility code through the production rollout; remove it only in a later cleanup once
  every deployed database has been backfilled.

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
- Server deploy: Docker Compose in `deployment/docker-compose.yml`
- Frontend container: Caddy serving static build + reverse proxying `/api`
