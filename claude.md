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
- **User**: Authentication, profile, gold, XP, level, home membership
- **Quest**: Task management, assignment, completion tracking, quest_type (standard/bounty/corrupted)
- **QuestTemplate**: Reusable quest definitions for recurring chores
- **DailyBounty**: Time-limited bonus quests
- **Reward**: Marketplace items purchasable with gold
- **Home**: Household/family groups

### Key Concepts
- **Quest Types**: Standard (regular), Bounty (time-limited bonus), Corrupted (overdue, higher rewards)
- **XP/Leveling**: Exponential curve: `XP_for_Next_Level = 100 * (current_level ^ 1.5)`
- **Scribe**: Background AI service (Groq) for generating quest descriptions

## Current Development Phase

**MVP**: Core gameplay loop functional. Users can log in, view quests, complete them, and gain XP/gold. Quest types (standard, bounty, corrupted) are implemented.

**Next**: Phase 1 features - difficulty levels, categories, filtering, Profile/Market/Heroes pages.

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

## See Also

- `backend/claude.md` - Backend architecture details
- `frontend/claude.md` - Frontend component structure
