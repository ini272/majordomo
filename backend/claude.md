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

- **user.py**: User (id, email, password_hash, username, gold_balance, xp, level, home_id, active_xp_boost_count, active_shield_expiry)
- **home.py**: Home (id, name, invite_code, created_at, relationships: users, quest_templates, quests, rewards, achievements)
- **quest.py**:
  - Quest (id, home_id, user_id, quest_template_id, completed, completed_at, quest_type, due_date, corrupted_at)
  - QuestTemplate (id, home_id, title, display_name, description, tags, xp_reward, gold_reward, quest_type, recurrence, system, created_by)
- **daily_bounty.py**: DailyBounty (id, home_id, quest_template_id, bounty_date, created_at) - tracks which template is featured each day
- **reward.py**:
  - Reward (id, home_id, name, description, cost)
  - UserRewardClaim (id, user_id, reward_id, claimed_at) - purchase history
- **achievement.py**:
  - Achievement (id, home_id, name, description, icon, criteria_type, criteria_value, is_system)
  - UserAchievement (id, user_id, achievement_id, unlocked_at)

## CRUD Operations (`app/crud/`)

Each CRUD module provides database operations:

- **user.py**: create_user, get_user, get_user_by_email, update_user, add_xp, add_gold (with validation)
- **home.py**: create_home, get_home, get_home_by_invite_code, get_home_users, delete_home
- **quest.py**: create_quest, get_quest, get_quests_by_home, get_quests_by_user, update_quest, delete_quest, complete_quest, check_and_corrupt_overdue_quests
- **quest_template.py**: create_quest_template, get_quest_template, get_home_quest_templates, update_quest_template, delete_quest_template
- **daily_bounty.py**: get_today_bounty, create_bounty, refresh_bounty, is_template_daily_bounty
- **reward.py**: create_reward, get_reward, get_home_rewards, claim_reward (validates gold, activates consumables), get_user_reward_claims, delete_reward
- **achievement.py**: create_achievement, get_achievement, get_home_achievements, get_user_achievements, award_achievement, check_and_award_achievements

## API Routes (`app/routes/`)

All routes prefixed with `/api`:

- **auth.py**: `/auth/signup` (email+password), `/auth/signup-home` (username+password), `/auth/login-email`, `/auth/login` (username+password), `/auth/join` (join existing home)
- **user.py**: `/users/me`, `/users/{user_id}` (get/update user), `/users/{user_id}/xp` (add XP), `/users/{user_id}/gold` (add gold)
- **home.py**: `/homes/`, `/homes/{home_id}`, `/homes/{home_id}/users` (CRUD, user listing)
- **quest.py**:
  - Quests: `/quests/` (list all), `/quests/{quest_id}` (get/update/delete), `/quests/{quest_id}/complete` (complete with rewards)
  - Templates: `/quests/templates` (create), `/quests/templates/all` (list), `/quests/templates/{template_id}` (get/update/delete)
  - Corruption: `/quests/check-corruption` (manual corruption check)
- **bounty.py**: `/bounty/today` (get/create today's bounty), `/bounty/refresh` (refresh bounty), `/bounty/check/{template_id}` (check if template is bounty)
- **reward.py**: `/rewards/` (list/create), `/rewards/{reward_id}` (get/delete), `/rewards/{reward_id}/claim` (purchase with gold), `/rewards/user/{user_id}/claims` (claim history)
- **achievement.py**: `/achievements/` (list/create), `/achievements/{achievement_id}` (get/delete), `/achievements/{achievement_id}/award` (award to user), `/achievements/user/{user_id}` (user achievements), `/achievements/me` (my achievements)
- **triggers.py**: `/triggers/quest/{quest_id}` (NFC/trigger completion)

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
