# Majordomo

Gamified household chore management system. Transform chores into quests with XP/gold rewards, daily bounties, and NFC triggers.

**For design philosophy and detailed mechanics, see [DESIGN.md](./DESIGN.md)**

## Tech Stack

**Backend**: FastAPI (Python 3) + SQLModel ORM + SQLite + JWT auth + Groq AI integration
**Frontend**: React 19 + Vite + TypeScript + Tailwind CSS + Framer Motion
**Deployment**: Docker Compose

## Project Structure

```
/
├── backend/           # FastAPI service (port 8000)
│   ├── main.py       # Entry point
│   ├── app/
│   │   ├── models/   # SQLModel database models
│   │   ├── crud/     # Database operations
│   │   ├── routes/   # API endpoints
│   │   └── services/ # Groq AI integration
│   └── tests/        # Pytest test suite
│
├── frontend/         # React app (port 3000)
│   ├── src/
│   │   ├── pages/    # Board, Heroes, Profile, Market, NFCTrigger
│   │   ├── components/ # Reusable UI components
│   │   └── services/ # API client
│   └── main.jsx      # Entry point
│
└── docker-compose.yml # Container orchestration
```

## Core Models & Concepts

### Database Models
- **User**: Authentication, profile, gold, XP, level, home membership, consumable tracking (`active_xp_boost_count`, `active_shield_expiry`)
- **Quest**: Task management, assignment, completion tracking, quest_type (standard/bounty/corrupted), due_date, corrupted_at
- **QuestTemplate**: Reusable quest definitions for recurring chores
- **DailyBounty**: Time-limited bonus quests (tracks which template is featured each day)
- **Reward**: Marketplace items purchasable with gold (consumables and future cosmetics)
- **Home**: Household/family groups
- **Achievement**: Unlockable feats with criteria tracking
- **UserRewardClaim**: Tracks reward purchases and claim history

### Key Concepts
- **Quest Types**:
  - Standard (regular), Bounty (2x rewards when template matches today's DailyBounty), Corrupted (overdue, triggers house-wide -5% debuff per quest)
  - Bounty status is determined dynamically (not stored on quest), quest_type tracks corruption state
- **Corruption System**: Overdue quests trigger household-wide penalties (-5% XP/Gold per corrupted quest, stacks to -50%)
- **Consumables**:
  - Heroic Elixir (150g): 2x XP for next 3 quests
  - Purification Shield (200g): Suppresses corruption debuff for 24h
- **XP/Leveling**: Exponential curve: `XP_for_Next_Level = 100 * (current_level ^ 1.5)`
- **Scribe**: Background AI service (Groq) for generating quest descriptions

## Current Development Phase

**MVP Complete (Backend)** ✅:
- Core gameplay loop functional
- User authentication and home management
- Quest system with templates and instances
- Daily bounty system (random template selection)
- Corruption system (overdue quests trigger house-wide debuff)
- Gold economy with consumable shop (Heroic Elixir, Purification Shield)
- Achievement system with criteria tracking
- All 118 backend tests passing

**Frontend Work In Progress**:
- Basic quest board and user management implemented
- Market page for gold spending (needs consumable indicators)
- Hero Status Bar (needs active consumable/debuff display)
- Quest completion feedback (needs boost/debuff breakdown)
- Corruption visual styling (needs red borders, warning banners)

**Next**: Frontend integration for consumables + corruption system UI, then Phase 1 features (difficulty levels, categories, filtering enhancements).

## Development

### Local Development (Primary)

**Backend** (requires [uv](https://docs.astral.sh/uv/)):
```bash
cd backend
uv sync                # Install dependencies
uv run python main.py  # Run server
uv run pytest          # Run tests
```

**Frontend** (requires [bun](https://bun.sh)):
```bash
cd frontend
bun install
bun run dev
```

### Docker (Optional - for production deployment)
```bash
docker-compose up
```

## Code Quality

### Pre-commit Hooks

Automated linting and formatting on every commit:

```bash
# One-time setup
uv tool install pre-commit
pre-commit install

# Manual run (optional)
pre-commit run --all-files
```

**IMPORTANT for Claude Code sessions:**
Before committing any changes, ALWAYS run the appropriate formatters:
- **Backend changes**: `cd backend && uv run ruff format . && uv run ruff check --fix .`
- **Frontend changes**: `cd frontend && bun run format`
- **Or run all hooks**: `pre-commit run --all-files`

### Manual Linting

**Backend**:
```bash
cd backend
uv run ruff check .        # Check for issues
uv run ruff check --fix .  # Auto-fix issues
uv run ruff format .       # Format code
```

**Frontend**:
```bash
cd frontend
bun run lint               # Check for issues
bun run format             # Format code
bun run format:check       # Check formatting
bun run typecheck          # TypeScript type check
```

## API

Base URL: `http://localhost:8000/api`
Health check: `GET /` or `GET /health`

Authentication: JWT tokens via `/api/auth/login`

## Documentation Source of Truth

- Canonical architecture snapshot: `docs/current-architecture.md`
- API contract governance: `docs/api-contract-governance.md`
- Runtime behavior and OpenAPI always override stale notes

## See Also

- `backend/claude.md` - Backend architecture details
- `frontend/claude.md` - Frontend component structure
