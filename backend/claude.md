# Backend - FastAPI Service

FastAPI-based REST API for the Majordomo quest management system.

## Architecture

- **Framework**: FastAPI with async support
- **ORM**: SQLModel (Pydantic + SQLAlchemy)
- **Database**: SQLite (`majordomo.db`)
- **Auth**: JWT tokens with bcrypt password hashing
- **AI**: Groq API integration for quest description generation
- **Testing**: Pytest with async test client

## Entry Point

`main.py` - Starts Uvicorn server on port 8000

## Structure

```
app/
├── main.py          # FastAPI app factory, CORS, router registration
├── database.py      # SQLModel engine, session management
├── auth.py          # JWT token creation/validation, password hashing
├── models/          # SQLModel database models
├── crud/            # Database operations (Create, Read, Update, Delete)
├── routes/          # API endpoint definitions
└── services/        # External service integrations
```

## Models (`app/models/`)

All models inherit from `SQLModel` with `table=True`:

- **user.py**: User (id, email, hashed_password, username, gold, xp, home_id)
- **home.py**: Home (id, name, created_at, users relationship)
- **quest.py**: Quest (id, title, description, gold_reward, xp_reward, difficulty, is_completed, assigned_to, home_id, quest_template_id)
- **quest.py**: QuestTemplate (id, title, description_template, gold_reward, xp_reward, difficulty, home_id)
- **daily_bounty.py**: DailyBounty (id, title, description, gold_reward, xp_reward, expires_at, home_id, claimed_by)
- **reward.py**: Reward (id, name, description, cost, home_id)

## CRUD Operations (`app/crud/`)

Each CRUD module provides async database operations:

- **user.py**: create_user, get_user_by_email, get_user_by_id, update_user_gold_xp
- **home.py**: create_home, get_home, add_user_to_home
- **quest.py**: create_quest, get_quests_by_home, get_quest, update_quest, delete_quest, complete_quest
- **quest_template.py**: create_quest_template, get_quest_templates_by_home, delete_quest_template
- **daily_bounty.py**: create_daily_bounty, get_active_bounties, claim_bounty
- **reward.py**: create_reward, get_rewards_by_home, purchase_reward

## API Routes (`app/routes/`)

All routes prefixed with `/api`:

- **auth.py**: `/auth/register`, `/auth/login` (JWT token generation)
- **user.py**: `/users/me`, `/users/{user_id}` (requires JWT)
- **home.py**: `/homes/`, `/homes/{home_id}` (create, get home info)
- **quest.py**: `/quests/`, `/quests/{quest_id}`, `/quests/{quest_id}/complete` (CRUD + completion)
- **quest.py**: `/quest-templates/` (template management)
- **bounty.py**: `/bounties/`, `/bounties/{bounty_id}/claim` (daily bounty system)
- **reward.py**: `/rewards/`, `/rewards/{reward_id}/purchase` (marketplace)
- **triggers.py**: `/triggers/nfc` (NFC tag handling)

## Services (`app/services/`)

- **scribe.py**: Groq AI integration
  - `generate_quest_description(title: str) -> str`
  - Uses `llama-3.3-70b-versatile` model
  - Fantasy-style quest description generation

## Authentication Flow

1. User registers via `/api/auth/register` (email, password, username)
2. Password hashed with bcrypt
3. User logs in via `/api/auth/login` (email, password)
4. JWT token returned with user info
5. Protected routes require `Authorization: Bearer <token>` header
6. Token decoded in `auth.py:get_current_user()` dependency

## Database Sessions

- Engine created in `database.py`
- Session dependency: `get_session()` yields async session
- Used in all route handlers via dependency injection

## Development Setup

**Package Management**: Uses [uv](https://docs.astral.sh/uv/) for fast dependency management.

```bash
# Install dependencies
uv sync

# Run server
uv run python main.py

# Run tests
uv run pytest

# Add new dependency
uv add <package-name>

# Add dev dependency
uv add --dev <package-name>
```

Dependencies are defined in `pyproject.toml`. The `uv.lock` file pins exact versions.

**Code Quality**:
```bash
uv run ruff check .        # Lint code
uv run ruff check --fix .  # Auto-fix issues
uv run ruff format .       # Format code
```

Ruff is configured in `pyproject.toml` with sensible defaults for FastAPI projects.

## Testing

`tests/` directory with pytest:
- `test_users.py` - User registration, login, profile
- `test_quests.py` - Quest CRUD operations
- `test_homes.py` - Home creation and membership
- `test_bounty.py` - Daily bounty system
- `test_rewards.py` - Reward marketplace
- `test_triggers.py` - NFC trigger handling
- `test_scribe.py` - AI service integration

Run: `uv run pytest`

## Key Patterns

- Async/await throughout (FastAPI + SQLModel async sessions)
- Dependency injection for database sessions and auth
- Pydantic models for request/response validation
- Relationship loading with `selectinload()` for eager loading
- JWT stored in client, validated on each protected request
