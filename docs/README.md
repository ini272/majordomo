# Majordomo Docs

Single entry point for humans and agents.

Last verified: 2026-02-12

## Read in this order

1. `docs/current-architecture.md`
2. `docs/product-goals.md`
3. `backend/README.md`
4. `frontend/README.md`
5. `docs/api-contract-governance.md`

## Fast local startup

```bash
# Terminal 1
cd backend
uv sync
uv run python main.py

# Terminal 2
cd frontend
bun install
bun run dev
```

API base URL: `http://localhost:8000/api`

## Archive

Historical notes, plans, and deep dives were moved to `docs/archive/`.
Use them only for context, not as source of truth.
