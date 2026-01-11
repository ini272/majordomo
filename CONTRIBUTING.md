# Contributing to Majordomo

Thank you for your interest in contributing to Majordomo! This document provides guidelines and standards for contributing to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Message Conventions](#commit-message-conventions)
- [Pull Request Process](#pull-request-process)

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker and Docker Compose (optional)

### Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and configure values
3. Run with Docker: `docker-compose up`
4. Or run locally:
   ```bash
   # Backend
   cd backend
   pip install -r requirements.txt
   python main.py

   # Frontend
   cd frontend
   npm install
   npm run dev
   ```

### Project Context

Read these files to understand the project architecture:
- `/claude.md` - Project overview and tech stack
- `/backend/claude.md` - Backend architecture details
- `/frontend/claude.md` - Frontend component structure

---

## Development Workflow

1. Create a new branch from `main`: `git checkout -b feature/your-feature-name`
2. Make your changes following the coding standards below
3. Write tests for new functionality
4. Run tests: `cd backend && pytest`
5. Commit your changes with descriptive messages
6. Push to your branch and create a pull request

---

## Coding Standards

### General Principles

- **Keep it simple**: Avoid over-engineering; only add features that are requested or clearly necessary
- **No premature optimization**: Don't add abstractions for one-time operations
- **Security first**: Avoid common vulnerabilities (XSS, SQL injection, command injection)
- **Consistent naming**: Follow the conventions below

### Backend (Python)

#### File and Module Structure

```
backend/app/
├── models/      # SQLModel database models
├── crud/        # Database operations (Create, Read, Update, Delete)
├── routes/      # FastAPI endpoint definitions
└── services/    # External integrations (Groq AI, etc.)
```

#### Naming Conventions

- **Files**: `snake_case.py`
- **Functions**: `snake_case()`
- **Classes**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Database fields**: `snake_case`

#### Type Hints

Always use type hints for function parameters and return values:

```python
from typing import Optional, List
from sqlmodel import Session

def get_quest(db: Session, quest_id: int) -> Optional[Quest]:
    """Get quest by ID"""
    return db.exec(select(Quest).where(Quest.id == quest_id)).first()
```

#### OpenAPI Documentation

Add detailed docstrings to route handlers for auto-generated API docs:

```python
@router.post("/{quest_id}/complete")
def complete_quest(quest_id: int, db: Session = Depends(get_db)):
    """
    Complete a quest and award rewards to the user.

    - **quest_id**: Quest instance ID to complete

    Automatically awards XP and gold from the quest template.
    **Daily Bounty Bonus**: Rewards are doubled if this matches today's bounty.
    """
    # Implementation...
```

#### Error Handling

Use FastAPI's `HTTPException` with appropriate status codes:

```python
from fastapi import HTTPException

if not quest:
    raise HTTPException(status_code=404, detail="Quest not found")

if quest.completed:
    raise HTTPException(status_code=400, detail="Quest already completed")
```

#### Database Operations

- Keep CRUD operations in `/app/crud/` modules
- Use SQLModel's `select()` for queries
- Always use database sessions from dependency injection
- Commit changes explicitly: `db.add()`, `db.commit()`, `db.refresh()`

### Frontend (JavaScript/React)

#### File and Component Structure

```
frontend/src/
├── pages/       # Route components (Board, Heroes, Profile, Market)
├── components/  # Reusable UI components
├── services/    # API client and external integrations
└── constants/   # Static configuration and data
```

#### Naming Conventions

- **Component files**: `PascalCase.jsx`
- **Utility files**: `camelCase.js`
- **Functions**: `camelCase()`
- **Constants**: `UPPER_SNAKE_CASE`
- **CSS classes**: `kebab-case` (Tailwind utilities)

#### Component Guidelines

Use functional components with hooks:

```javascript
import { useState, useEffect } from 'react';

function QuestCard({ quest, onComplete }) {
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    await onComplete(quest.id);
    setLoading(false);
  };

  return (
    <div className="quest-card">
      {/* Component JSX */}
    </div>
  );
}

export default QuestCard;
```

#### API Integration

Centralize API calls in `services/api.js`:

```javascript
// services/api.js
export async function completeQuest(questId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE}/quests/${questId}/complete`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return response.json();
}
```

#### Styling

- Use Tailwind CSS utility classes
- Follow the fantasy/medieval theme
- Ensure mobile responsiveness
- Use Framer Motion for animations

---

## Testing Guidelines

### Backend Tests

Located in `backend/tests/`, using pytest.

#### Test Structure

```python
def test_complete_quest(client, test_user, test_quest):
    """Test that completing a quest awards XP and gold"""
    response = client.post(f"/api/quests/{test_quest.id}/complete")
    assert response.status_code == 200
    data = response.json()
    assert data['rewards']['xp'] > 0
    assert data['rewards']['gold'] > 0
```

#### Test Coverage

- Test happy paths (expected behavior)
- Test error cases (404, 400, 401, etc.)
- Test edge cases (empty data, duplicates, etc.)
- Test authentication and authorization

#### Running Tests

```bash
cd backend
pytest                    # Run all tests
pytest tests/test_quests.py  # Run specific test file
pytest -v                 # Verbose output
pytest --cov=app          # Coverage report
```

---

## Commit Message Conventions

Use clear, descriptive commit messages in lowercase:

```
add daily bounty system with 2x reward multiplier
fix quest completion awarding XP twice
update API documentation for quest endpoints
refactor CRUD operations to use type hints
```

### Format

- Start with action verb (add, fix, update, refactor, remove)
- Be concise but descriptive
- Focus on **what** changed and **why** (if not obvious)
- Reference issue numbers if applicable: `fix quest deletion bug (#42)`

### Examples

✅ Good:
```
add groq AI integration for quest descriptions
fix CORS configuration for production deployment
update .env.example with all required variables
```

❌ Avoid:
```
stuff
Fixed bug
WIP
Update file.py
```

---

## Pull Request Process

1. **Update Documentation**: If you add features, update relevant `claude.md` files
2. **Add Tests**: Ensure new features have test coverage
3. **Run Tests**: Verify all tests pass before submitting
4. **Descriptive Title**: Use clear, concise PR titles
5. **Description**: Explain what changed, why, and how to test
6. **Review Changes**: Self-review your code before requesting review
7. **Stay Focused**: Keep PRs small and focused on a single feature/fix

### PR Template

```markdown
## Summary
Brief description of what this PR does

## Changes
- Added feature X
- Fixed bug Y
- Updated documentation Z

## Testing
How to test these changes:
1. Step one
2. Step two
3. Expected result

## Screenshots (if applicable)
[Add screenshots for UI changes]
```

---

## Code Review Guidelines

### For Authors

- Respond to feedback promptly and professionally
- Be open to suggestions and alternative approaches
- Update PR based on review comments
- Mark resolved conversations

### For Reviewers

- Be constructive and specific in feedback
- Suggest improvements with examples
- Focus on code quality, not personal preferences
- Approve when code meets standards

---

## Questions or Issues?

- Check existing documentation (`claude.md` files)
- Review closed issues and PRs for similar problems
- Open a GitHub issue for bugs or feature requests
- Ask questions in pull request comments

---

Thank you for contributing to Majordomo! 🎮✨
