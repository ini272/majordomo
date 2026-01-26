# Error Codes Documentation

## Overview

The Majordomo API uses standardized error codes and detailed error responses to help developers understand what went wrong and how to fix it. This document describes all error codes, their meanings, and example responses.

## Error Response Format

All error responses follow a consistent structure:

```json
{
  "detail": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional context about the error
    }
  }
}
```

### Fields

- **code** (string): A standardized error code (e.g., `QUEST_NOT_FOUND`)
- **message** (string): Human-readable error description
- **details** (object, optional): Additional contextual information about the error

## Error Codes by Category

### Resource Not Found (404)

| Error Code | Message | When It Occurs |
|-----------|---------|----------------|
| `QUEST_NOT_FOUND` | "Quest not found" | Quest ID doesn't exist or user doesn't have access |
| `QUEST_TEMPLATE_NOT_FOUND` | "Quest template not found" | Quest template ID doesn't exist or user doesn't have access |
| `USER_NOT_FOUND` | "User not found" | User ID doesn't exist or belongs to different home |
| `HOME_NOT_FOUND` | "Home not found" | Home ID doesn't exist |
| `REWARD_NOT_FOUND` | "Reward not found" | Reward ID doesn't exist or user doesn't have access |
| `ACHIEVEMENT_NOT_FOUND` | "Achievement not found" | Achievement ID doesn't exist or user doesn't have access |
| `BOUNTY_NOT_FOUND` | "Daily bounty not found" | No daily bounty active for the home |

### Validation Errors (400)

| Error Code | Message | When It Occurs |
|-----------|---------|----------------|
| `INVALID_INPUT` | "Invalid input provided" | Generic validation error |
| `DUPLICATE_HOME_NAME` | "A home with this name already exists" | Attempting to create home with existing name |
| `DUPLICATE_USERNAME` | "Username already exists in this home" | Username already taken in the home |
| `NEGATIVE_XP` | "XP amount cannot be negative" | Attempting to add negative XP |
| `INSUFFICIENT_GOLD` | "Insufficient gold balance" | User doesn't have enough gold for operation |
| `NEGATIVE_AMOUNT` | "Amount cannot be negative" | Generic negative amount error |

### State Errors (400)

| Error Code | Message | When It Occurs |
|-----------|---------|----------------|
| `QUEST_ALREADY_COMPLETED` | "Quest is already completed" | Attempting to complete an already-completed quest |
| `ACHIEVEMENT_ALREADY_UNLOCKED` | "Achievement already unlocked" | User already has this achievement |
| `CONSUMABLE_ALREADY_ACTIVE` | "Consumable is already active" | Attempting to purchase a consumable that's already active (non-stacking) |

### Authorization Errors (403)

| Error Code | Message | When It Occurs |
|-----------|---------|----------------|
| `UNAUTHORIZED_ACCESS` | "You are not authorized to access this resource" | User trying to access resource from different home |
| `FORBIDDEN` | "Access forbidden" | User lacks permissions for this operation |

### Authentication Errors (401)

| Error Code | Message | When It Occurs |
|-----------|---------|----------------|
| `INVALID_CREDENTIALS` | "Invalid username or password" | Login failed |
| `MISSING_TOKEN` | "Authentication token is missing" | No auth token provided |
| `INVALID_TOKEN` | "Authentication token is invalid" | Token is malformed or expired |

## Example Error Responses

### Quest Not Found

```http
GET /api/quests/999
```

```json
HTTP/1.1 404 Not Found
{
  "detail": {
    "code": "QUEST_NOT_FOUND",
    "message": "Quest not found",
    "details": {
      "quest_id": 999
    }
  }
}
```

### Quest Already Completed

```http
POST /api/quests/123/complete
```

```json
HTTP/1.1 400 Bad Request
{
  "detail": {
    "code": "QUEST_ALREADY_COMPLETED",
    "message": "Quest is already completed",
    "details": {
      "quest_id": 123,
      "completed_at": "2026-01-12T10:30:00Z"
    }
  }
}
```

### Insufficient Gold

```http
POST /api/quests/456/complete
```

```json
HTTP/1.1 400 Bad Request
{
  "detail": {
    "code": "INSUFFICIENT_GOLD",
    "message": "Insufficient gold balance. Current: 50, Attempting to add: -100",
    "details": {
      "quest_id": 456
    }
  }
}
```

### Duplicate Home Name

```http
POST /api/homes
{
  "name": "Smith Family"
}
```

```json
HTTP/1.1 400 Bad Request
{
  "detail": {
    "code": "DUPLICATE_HOME_NAME",
    "message": "A home with the name 'Smith Family' already exists",
    "details": {
      "home_name": "Smith Family"
    }
  }
}
```

### Unauthorized Access

```http
GET /api/homes/5
```

```json
HTTP/1.1 403 Forbidden
{
  "detail": {
    "code": "UNAUTHORIZED_ACCESS",
    "message": "You are not authorized to access this home",
    "details": {
      "home_id": 5,
      "your_home_id": 3
    }
  }
}
```

### Duplicate Username

```http
POST /api/homes/1/join
{
  "username": "john",
  "password": "password123"
}
```

```json
HTTP/1.1 400 Bad Request
{
  "detail": {
    "code": "DUPLICATE_USERNAME",
    "message": "Username already exists in this home",
    "details": {
      "username": "john",
      "home_id": 1
    }
  }
}
```

### Consumable Already Active

```http
POST /api/rewards/5/claim?user_id=1
```

```json
HTTP/1.1 400 Bad Request
{
  "detail": {
    "code": "CONSUMABLE_ALREADY_ACTIVE",
    "message": "Heroic Elixir is active (2 quests remaining)",
    "details": {
      "reward_name": "Heroic Elixir",
      "remaining_count": 2,
      "user_id": 1
    }
  }
}
```

## Frontend Error Handling

### TypeScript/JavaScript Example

```typescript
interface ErrorDetail {
  code: string;
  message: string;
  details?: Record<string, any>;
}

interface ErrorResponse {
  detail: ErrorDetail;
}

async function completeQuest(questId: number) {
  try {
    const response = await fetch(`/api/quests/${questId}/complete`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();

      // Handle specific error codes
      switch (error.detail.code) {
        case 'QUEST_NOT_FOUND':
          showError('This quest no longer exists');
          break;

        case 'QUEST_ALREADY_COMPLETED':
          showError('This quest has already been completed');
          break;

        case 'INSUFFICIENT_GOLD':
          showError('Not enough gold to complete this quest');
          break;

        default:
          showError(error.detail.message);
      }

      // Log details for debugging
      console.error('Quest completion failed:', error.detail);
      return;
    }

    const result = await response.json();
    showSuccess(`Quest completed! Earned ${result.rewards.xp} XP`);
  } catch (error) {
    showError('Network error. Please try again.');
    console.error(error);
  }
}
```

### React Example

```tsx
import { useState } from 'react';

function QuestCard({ quest }) {
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async () => {
    try {
      const response = await fetch(`/api/quests/${quest.id}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();

        // User-friendly error messages
        const errorMessages = {
          QUEST_NOT_FOUND: 'This quest no longer exists',
          QUEST_ALREADY_COMPLETED: 'Quest already completed',
          INSUFFICIENT_GOLD: 'Not enough gold',
          NEGATIVE_XP: 'Invalid XP amount',
        };

        setError(
          errorMessages[errorData.detail.code] ||
          errorData.detail.message
        );
        return;
      }

      // Success handling...
    } catch (err) {
      setError('Something went wrong. Please try again.');
    }
  };

  return (
    <div>
      {error && <div className="error">{error}</div>}
      <button onClick={handleComplete}>Complete Quest</button>
    </div>
  );
}
```

## Best Practices

### For Frontend Developers

1. **Always check error codes** - Use the `code` field to determine error type
2. **Show user-friendly messages** - Map error codes to messages users can understand
3. **Log details for debugging** - The `details` object contains helpful context
4. **Handle network errors** - Not all errors will have the standard format

### For Backend Developers

1. **Use specific error codes** - Don't use `INVALID_INPUT` for everything
2. **Include helpful details** - Add IDs, values, or context in the `details` object
3. **Keep messages consistent** - Use the predefined messages from `ERROR_MESSAGES`
4. **Document new codes** - Update this file when adding new error codes

## HTTP Status Codes

| Status | When Used | Example Error Codes |
|--------|-----------|---------------------|
| 400 Bad Request | Validation failures, invalid state | `DUPLICATE_HOME_NAME`, `QUEST_ALREADY_COMPLETED`, `INSUFFICIENT_GOLD` |
| 401 Unauthorized | Authentication failures | `INVALID_CREDENTIALS`, `MISSING_TOKEN`, `INVALID_TOKEN` |
| 403 Forbidden | Authorization failures | `UNAUTHORIZED_ACCESS`, `FORBIDDEN` |
| 404 Not Found | Resource doesn't exist | `QUEST_NOT_FOUND`, `USER_NOT_FOUND`, `HOME_NOT_FOUND` |
| 422 Unprocessable Entity | Pydantic validation errors | (Automatic from FastAPI) |
| 500 Internal Server Error | Server errors | (Generic server error) |

## Migration from Old Format

### Old Format (Simple String)

```json
{
  "detail": "Quest not found"
}
```

### New Format (Structured)

```json
{
  "detail": {
    "code": "QUEST_NOT_FOUND",
    "message": "Quest not found",
    "details": {
      "quest_id": 123
    }
  }
}
```

**Note**: The old format is still supported in some places for backward compatibility, but all new code should use the structured format.

## Testing Error Responses

### Using curl

```bash
# Test quest not found
curl -X GET http://localhost:8000/api/quests/999 \
  -H "Authorization: Bearer $TOKEN"

# Test duplicate home name
curl -X POST http://localhost:8000/api/homes \
  -H "Content-Type: application/json" \
  -d '{"name":"Existing Home"}'

# Test completing already-completed quest
curl -X POST http://localhost:8000/api/quests/123/complete \
  -H "Authorization: Bearer $TOKEN"
```

### Using Python

```python
import requests

response = requests.get(
    "http://localhost:8000/api/quests/999",
    headers={"Authorization": f"Bearer {token}"}
)

if response.status_code != 200:
    error = response.json()
    print(f"Error Code: {error['detail']['code']}")
    print(f"Message: {error['detail']['message']}")
    print(f"Details: {error['detail']['details']}")
```

## Files

- **Error Definitions**: `backend/app/errors.py`
- **Usage Examples**: All route files (`routes/*.py`)
- **Frontend Integration**: `frontend/src/api.ts` (if applicable)

---

**Questions or Issues?** See the main API documentation at `/docs` when running the server.
