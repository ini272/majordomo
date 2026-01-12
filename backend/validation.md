# Validation System Documentation

## Overview

The Majordomo backend implements comprehensive validation to ensure data integrity and prevent invalid operations. This document describes all validation rules, error handling, and how to work with the validation system.

## 🛡️ Validation Layers

The validation system operates at three levels:

```
┌─────────────────────────────────────┐
│  1. Pydantic Schema Validation      │  ← Field constraints (min/max, types)
│     (Request/Response models)       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  2. Business Logic Validation       │  ← Domain rules (uniqueness, balance checks)
│     (CRUD functions)                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  3. HTTP Error Handling             │  ← Converts exceptions to HTTP 400 errors
│     (API routes)                    │
└─────────────────────────────────────┘
```

## 📋 Validation Rules

### User Model

#### Field Constraints

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `username` | `str` | `min_length=1, max_length=50` | Username must be 1-50 characters |
| `level` | `int` | `ge=1, le=1000` | Level must be between 1 and 1000 |
| `xp` | `int` | `ge=0` | XP cannot be negative |
| `gold_balance` | `int` | `ge=0` | Gold balance cannot be negative |

#### Business Logic Rules

**add_xp()**
- ✅ Only accepts non-negative amounts
- ✅ Automatically updates user level based on XP
- ❌ Raises `ValueError` if amount < 0

```python
# ✓ Valid
add_xp(db, user_id, 100)  # Add 100 XP

# ✗ Invalid
add_xp(db, user_id, -50)  # ValueError: XP amount must be non-negative
```

**add_gold()**
- ✅ Accepts negative amounts for deductions (purchases)
- ✅ Validates that resulting balance won't be negative
- ❌ Raises `ValueError` if new_balance < 0

```python
# ✓ Valid
add_gold(db, user_id, 100)   # Add 100 gold
add_gold(db, user_id, -50)   # Deduct 50 gold (if balance >= 50)

# ✗ Invalid
add_gold(db, user_id, -200)  # ValueError if balance < 200
```

### Home Model

#### Field Constraints

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `name` | `str` | `min_length=1, max_length=100` | Home name must be 1-100 characters |
| `invite_code` | `str` | Unique | Auto-generated, must be unique |

#### Business Logic Rules

**create_home()**
- ✅ Checks for duplicate home names
- ✅ Auto-generates unique invite code
- ❌ Raises `ValueError` if name already exists

```python
# ✓ Valid
create_home(db, HomeCreate(name="Smith Family"))

# ✗ Invalid (if "Smith Family" already exists)
create_home(db, HomeCreate(name="Smith Family"))
# ValueError: A home with the name 'Smith Family' already exists
```

### Quest Template Model

#### Field Constraints

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `title` | `str` | `min_length=1, max_length=200` | Quest title must be 1-200 characters |
| `display_name` | `str?` | `max_length=200` | Optional fantasy name, max 200 chars |
| `description` | `str?` | `max_length=1000` | Optional description, max 1000 chars |
| `tags` | `str?` | `max_length=500` | Comma-separated tags, max 500 chars |
| `xp_reward` | `int` | `ge=0, le=10000` | XP reward between 0-10,000 |
| `gold_reward` | `int` | `ge=0, le=10000` | Gold reward between 0-10,000 |

### Reward Model

#### Field Constraints

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `name` | `str` | `min_length=1, max_length=200` | Reward name must be 1-200 characters |
| `description` | `str?` | `max_length=1000` | Optional description, max 1000 chars |
| `cost` | `int` | `ge=0` | Cost in gold, must be non-negative |

### Achievement Model

#### Field Constraints

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `name` | `str` | `min_length=1, max_length=200` | Achievement name must be 1-200 characters |
| `description` | `str?` | `max_length=1000` | Optional description, max 1000 chars |
| `criteria_value` | `int` | `ge=0` | Target value for achievement criteria |
| `criteria_type` | `str` | `max_length=50` | Type of criteria (quests_completed, etc.) |
| `icon` | `str?` | `max_length=100` | Optional icon identifier |

## 🚨 Error Responses

### HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| `400` | Bad Request | Validation failed, invalid input data |
| `403` | Forbidden | User not authorized for this operation |
| `404` | Not Found | Resource doesn't exist |

### Error Response Format

All validation errors return a JSON response:

```json
{
  "detail": "Error message describing what went wrong"
}
```

### Examples

**Duplicate Home Name**
```http
POST /api/homes
{
  "name": "Smith Family"
}

HTTP 400 Bad Request
{
  "detail": "A home with the name 'Smith Family' already exists"
}
```

**Insufficient Gold**
```http
POST /api/quests/123/complete

HTTP 400 Bad Request
{
  "detail": "Insufficient gold balance. Current: 50, Attempting to add: -100"
}
```

**Negative XP**
```http
# (Internal error if attempted via code)
ValueError: XP amount must be non-negative
```

## 💻 Code Examples

### Handling Validation in Routes

```python
from fastapi import APIRouter, HTTPException

@router.post("", response_model=HomeRead)
def create_home(home: HomeCreate, db: Session = Depends(get_db)):
    """Create a new home"""
    try:
        return crud_home.create_home(db, home)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

### CRUD Function Validation Pattern

```python
def add_gold(db: Session, user_id: int, amount: int) -> Optional[User]:
    """Add gold to user with validation"""
    db_user = get_user(db, user_id)
    if not db_user:
        return None

    # Validate business logic
    new_balance = db_user.gold_balance + amount
    if new_balance < 0:
        raise ValueError(
            f"Insufficient gold balance. "
            f"Current: {db_user.gold_balance}, "
            f"Attempting to add: {amount}"
        )

    db_user.gold_balance = new_balance
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
```

### Frontend Error Handling

```typescript
// TypeScript/React example
const createHome = async (name: string) => {
  try {
    const response = await fetch('/api/homes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail);
    }

    return await response.json();
  } catch (error) {
    // Display user-friendly error message
    console.error('Failed to create home:', error.message);
    alert(error.message);
  }
};
```

## 🧪 Testing Validation

### Manual Testing Checklist

#### User Validation
- [ ] Try creating user with negative XP → Should fail with 400
- [ ] Try creating user with negative gold → Should fail with 400
- [ ] Try creating user with level 0 → Should fail with 400
- [ ] Add negative XP via complete_quest → Should fail with 400
- [ ] Deduct more gold than user has → Should fail with 400

#### Home Validation
- [ ] Create home with unique name → Should succeed
- [ ] Create home with duplicate name → Should fail with 400
- [ ] Create home with empty name → Should fail with 422 (Pydantic)
- [ ] Create home with name > 100 chars → Should fail with 422

#### Quest Template Validation
- [ ] Create template with negative XP → Should fail with 422
- [ ] Create template with XP > 10000 → Should fail with 422
- [ ] Create template with title > 200 chars → Should fail with 422
- [ ] Create template with description > 1000 chars → Should fail with 422

### Automated Tests

```python
# pytest example
def test_negative_xp_rejected(db_session):
    """Test that negative XP amounts are rejected"""
    user = create_test_user(db_session)

    with pytest.raises(ValueError, match="XP amount must be non-negative"):
        add_xp(db_session, user.id, -10)

def test_insufficient_gold_rejected(db_session):
    """Test that gold deductions exceeding balance are rejected"""
    user = create_test_user(db_session, gold_balance=50)

    with pytest.raises(ValueError, match="Insufficient gold balance"):
        add_gold(db_session, user.id, -100)

def test_duplicate_home_name_rejected(db_session):
    """Test that duplicate home names are rejected"""
    create_home(db_session, HomeCreate(name="Test Home"))

    with pytest.raises(ValueError, match="already exists"):
        create_home(db_session, HomeCreate(name="Test Home"))
```

## 📊 Validation Summary Table

| Validation Type | Location | Error Code | Exception Type |
|----------------|----------|------------|----------------|
| Field constraints (min/max) | Pydantic schemas | 422 | `ValidationError` |
| Duplicate home name | `crud/home.py` | 400 | `ValueError` |
| Negative XP | `crud/user.py` | 400 | `ValueError` |
| Insufficient gold | `crud/user.py` | 400 | `ValueError` |
| Missing resource | Routes | 404 | `HTTPException` |
| Unauthorized access | Routes | 403 | `HTTPException` |

## 🔍 Debugging Validation Issues

### Common Pitfall: Field Validation Only Works on Schemas

❌ **Incorrect**: Direct model instantiation bypasses validation
```python
user = User(xp=-10)  # No error raised!
```

✅ **Correct**: Use schemas for API input
```python
user_data = UserCreate(username="test", password="pass")
# Pydantic validates here
```

### Checking Validation in Development

```bash
# Start server in debug mode
uvicorn app.main:app --reload

# Test validation with curl
curl -X POST http://localhost:8000/api/homes \
  -H "Content-Type: application/json" \
  -d '{"name":"Test"}'

curl -X POST http://localhost:8000/api/homes \
  -H "Content-Type: application/json" \
  -d '{"name":"Test"}'
# Should return 400: "A home with the name 'Test' already exists"
```

## 🛠️ Files Modified

### Models
- `backend/app/models/user.py` - Added field constraints (level, xp, gold_balance)

### CRUD Operations
- `backend/app/crud/user.py` - Added validation in `add_xp()` and `add_gold()`
- `backend/app/crud/home.py` - Added duplicate name check in `create_home()`

### Routes
- `backend/app/routes/home.py` - Added exception handling for `create_home()`
- `backend/app/routes/quest.py` - Added exception handling in `complete_quest()`

## 🎯 Best Practices

### When Adding New Validation

1. **Model Level**: Add Pydantic field constraints first
2. **CRUD Level**: Add business logic validation (raise `ValueError`)
3. **Route Level**: Catch `ValueError` and convert to `HTTPException(400)`
4. **Test**: Write both manual and automated tests

### Example: Adding Max Length to Achievement Icon

```python
# 1. Model level (already done)
icon: Optional[str] = Field(default=None, max_length=100)

# 2. CRUD level (if needed for custom validation)
def create_achievement(db: Session, achievement_in: AchievementCreate):
    if achievement_in.icon and len(achievement_in.icon) > 100:
        raise ValueError("Icon identifier too long")
    # ... rest of function

# 3. Route level
@router.post("")
def create_achievement(achievement: AchievementCreate, db: Session):
    try:
        return crud.create_achievement(db, achievement)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

## 🔮 Future Enhancements

Potential validation improvements:

1. **Rate Limiting** - Prevent spam/abuse
2. **Custom Validators** - Pydantic validators for complex rules
3. **Sanitization** - Strip/clean user input
4. **Regex Patterns** - Validate username format, tags format
5. **Cross-Field Validation** - E.g., end_date > start_date
6. **Soft Deletes** - Validate against soft-deleted records
7. **Audit Logging** - Log validation failures for security

---

**Questions or Issues?** Check the API documentation at `/docs` when running the backend server.
