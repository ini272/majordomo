# Majordomo

Gamified household chore management system. Transform chores into quests with rewards, daily bounties, and NFC triggers.

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

## Key Concepts

- **Quest**: Chore task with title, description, gold/XP rewards, difficulty, assignee
- **Quest Template**: Reusable quest definitions for recurring chores
- **Daily Bounty**: Special time-limited quests with bonus rewards
- **Reward**: Items purchasable with earned gold
- **Home**: Household group containing users and quests
- **Scribe**: AI service (Groq) for generating quest descriptions

## Core Models

- User (authentication, profile, gold, XP, home membership)
- Quest (task management, assignment, completion tracking)
- QuestTemplate (recurring quest blueprints)
- DailyBounty (time-limited bonus quests)
- Reward (marketplace items)
- Home (household/family groups)

## Development

```bash
# Docker
docker-compose up

# Local backend
cd backend && python main.py

# Local frontend
cd frontend && npm run dev
```

## API

Base URL: `http://localhost:8000/api`
Health check: `GET /` or `GET /health`

Authentication: JWT tokens via `/api/auth/login`

## See Also

- `backend/claude.md` - Backend architecture details
- `frontend/claude.md` - Frontend component structure
