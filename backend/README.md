# Backend

FastAPI service for Majordomo.

Last verified: 2026-02-12

## Run locally

```bash
uv sync
uv run python main.py
```

Server: `http://localhost:8000`
OpenAPI: `http://localhost:8000/openapi.json`

## Test and quality

```bash
uv run pytest
uv run ruff check .
uv run ruff format .
```

## Code layout

- `app/main.py`: app setup, CORS, router registration
- `app/routes/`: HTTP API routes
- `app/models/`: SQLModel models + API schemas
- `app/crud/`: data access and business operations
- `app/services/`: recurring quest and scribe services

## Main route groups

- `/api/auth`
- `/api/users`
- `/api/homes`
- `/api/quests`
- `/api/subscriptions`
- `/api/bounty`
- `/api/rewards`
- `/api/achievements`
- `/api/triggers`

## Notes for contributors

- Treat OpenAPI + tests as contract source of truth.
- If route behavior changes, update `docs/current-architecture.md` in the same PR.
