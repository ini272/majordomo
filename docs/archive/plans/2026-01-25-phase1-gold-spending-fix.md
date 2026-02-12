# Phase 1: Gold Spending Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix gold spending bug - ensure gold is validated and deducted when users claim rewards

**Architecture:** Modify `claim_reward()` CRUD function to validate user gold balance and deduct reward cost. Add comprehensive tests first (TDD). Use existing `add_gold()` helper for safe gold deduction.

**Tech Stack:** FastAPI, SQLModel, Pytest

---

## Context

**Current Bug:** Gold is tracked but NOT deducted when claiming rewards (see `backend/app/crud/reward.py:32-42`). The `claim_reward()` function creates a UserRewardClaim but never touches the user's gold balance.

**Files to Modify:**
- `backend/app/crud/reward.py` - Add gold validation and deduction
- `backend/tests/test_rewards.py` - Add comprehensive tests

**Helper Functions Available:**
- `add_gold(db, user_id, amount)` in `backend/app/crud/user.py` - Handles gold changes with validation (raises ValueError if balance would go negative)
- `get_user(db, user_id)` in `backend/app/crud/user.py` - Fetch user record
- `create_error_detail()` in `backend/app/errors.py` - Create structured errors
- `ErrorCode.INSUFFICIENT_GOLD` already exists in `backend/app/errors.py`

---

## Task 1: Write Failing Test for Insufficient Gold

**Files:**
- Modify: `backend/tests/test_rewards.py`

**Step 1: Write the failing test**

Add this test after line 140 in `backend/tests/test_rewards.py`:

```python
def test_claim_reward_insufficient_gold(client: TestClient, home_with_user):
    """Test claiming a reward with insufficient gold balance"""
    home_id, user_id, invite_code = home_with_user

    # Create expensive reward (200 gold)
    reward_response = client.post(
        f"/api/rewards?home_id={home_id}",
        json={"name": "Expensive Item", "cost": 200}
    )
    reward_id = reward_response.json()["id"]

    # Verify user has 0 gold by default
    user_response = client.get(f"/api/users/{user_id}")
    assert user_response.json()["gold_balance"] == 0

    # Try to claim reward (should fail)
    response = client.post(f"/api/rewards/{reward_id}/claim?user_id={user_id}")
    assert response.status_code == 400
    assert "INSUFFICIENT_GOLD" in response.json()["detail"]["code"]
    assert response.json()["detail"]["details"]["required"] == 200
    assert response.json()["detail"]["details"]["current"] == 0
```

**Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_rewards.py::test_claim_reward_insufficient_gold -v`

Expected: FAIL with assertion error (status_code 200 != 400, because gold check doesn't exist yet)

**Step 3: Commit failing test**

```bash
cd backend
git add tests/test_rewards.py
git commit -m "test: add failing test for insufficient gold on reward claim"
```

---

## Task 2: Write Failing Test for Successful Gold Deduction

**Files:**
- Modify: `backend/tests/test_rewards.py`

**Step 1: Write the failing test**

Add this test after the previous test:

```python
def test_claim_reward_deducts_gold(client: TestClient, home_with_user):
    """Test that claiming a reward deducts gold from user balance"""
    home_id, user_id, invite_code = home_with_user

    # Give user 500 gold
    client.patch(f"/api/users/{user_id}", json={"gold_balance": 500})

    # Create reward costing 150 gold
    reward_response = client.post(
        f"/api/rewards?home_id={home_id}",
        json={"name": "Heroic Elixir", "cost": 150}
    )
    reward_id = reward_response.json()["id"]

    # Claim reward
    response = client.post(f"/api/rewards/{reward_id}/claim?user_id={user_id}")
    assert response.status_code == 200

    # Verify gold was deducted
    user_response = client.get(f"/api/users/{user_id}")
    assert user_response.json()["gold_balance"] == 350  # 500 - 150
```

**Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_rewards.py::test_claim_reward_deducts_gold -v`

Expected: FAIL with assertion error (gold_balance still 500, not deducted)

**Step 3: Commit failing test**

```bash
cd backend
git add tests/test_rewards.py
git commit -m "test: add failing test for gold deduction on reward claim"
```

---

## Task 3: Write Failing Test for Free Reward (Edge Case)

**Files:**
- Modify: `backend/tests/test_rewards.py`

**Step 1: Write the failing test**

Add this test after the previous test:

```python
def test_claim_free_reward(client: TestClient, home_with_user):
    """Test claiming a free reward (cost = 0) works without gold"""
    home_id, user_id, invite_code = home_with_user

    # Create free reward
    reward_response = client.post(
        f"/api/rewards?home_id={home_id}",
        json={"name": "Free Gift", "cost": 0}
    )
    reward_id = reward_response.json()["id"]

    # Verify user has 0 gold
    user_response = client.get(f"/api/users/{user_id}")
    assert user_response.json()["gold_balance"] == 0

    # Claim free reward (should succeed)
    response = client.post(f"/api/rewards/{reward_id}/claim?user_id={user_id}")
    assert response.status_code == 200

    # Verify gold unchanged (still 0)
    user_response = client.get(f"/api/users/{user_id}")
    assert user_response.json()["gold_balance"] == 0
```

**Step 2: Run test to verify it passes (already working)**

Run: `cd backend && uv run pytest tests/test_rewards.py::test_claim_free_reward -v`

Expected: PASS (this edge case should work even before our changes)

**Step 3: Commit test**

```bash
cd backend
git add tests/test_rewards.py
git commit -m "test: add test for free reward claim (cost=0)"
```

---

## Task 4: Implement Gold Validation and Deduction

**Files:**
- Modify: `backend/app/crud/reward.py:32-42`

**Step 1: Import required dependencies**

Add these imports at the top of `backend/app/crud/reward.py` (after line 5):

```python
from app.crud import user as crud_user
from app.errors import ErrorCode, create_error_detail
```

**Step 2: Modify `claim_reward()` function**

Replace the entire `claim_reward()` function (lines 32-42) with:

```python
def claim_reward(db: Session, user_id: int, reward_id: int) -> Optional[UserRewardClaim]:
    """
    User claims a reward.

    Validates:
    - Reward exists
    - User has sufficient gold balance

    Deducts reward cost from user's gold balance.

    Raises:
        ValueError: If user has insufficient gold (caught by route handler)

    Returns:
        UserRewardClaim if successful, None if reward not found
    """
    # Verify reward exists
    reward = get_reward(db, reward_id)
    if not reward:
        return None

    # Verify user has sufficient gold
    user = crud_user.get_user(db, user_id)
    if not user:
        return None

    if user.gold_balance < reward.cost:
        raise ValueError(
            create_error_detail(
                ErrorCode.INSUFFICIENT_GOLD,
                details={
                    "required": reward.cost,
                    "current": user.gold_balance,
                    "user_id": user_id,
                    "reward_id": reward_id,
                }
            )
        )

    # Deduct gold using add_gold helper (safe, handles validation)
    crud_user.add_gold(db, user_id, -reward.cost)

    # Create claim record
    claim = UserRewardClaim(user_id=user_id, reward_id=reward_id)
    db.add(claim)
    db.commit()
    db.refresh(claim)
    return claim
```

**Step 3: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_rewards.py -v`

Expected: All 3 new tests PASS

**Step 4: Commit implementation**

```bash
cd backend
git add app/crud/reward.py
git commit -m "feat: add gold validation and deduction to reward claims

- Validate user has sufficient gold before claiming
- Deduct reward cost using add_gold() helper
- Raise ValueError with structured error for insufficient gold
- Add docstring documenting validation behavior"
```

---

## Task 5: Update Route Handler to Handle ValueError

**Files:**
- Modify: `backend/app/routes/reward.py:53-83`

**Step 1: Modify the `claim_reward` route handler**

Replace the route handler (lines 53-83) with:

```python
@router.post("/{reward_id}/claim", response_model=UserRewardClaimRead)
def claim_reward(
    reward_id: int, user_id: int = Query(...), db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)
):
    """User claims a reward"""
    # Verify user exists and belongs to authenticated home
    user = crud_user.get_user(db, user_id)
    if not user or user.home_id != auth["home_id"]:
        raise HTTPException(
            status_code=404, detail=create_error_detail(ErrorCode.USER_NOT_FOUND, details={"user_id": user_id})
        )

    # Verify reward exists and belongs to same home
    reward = crud_reward.get_reward(db, reward_id)
    if not reward or reward.home_id != auth["home_id"]:
        raise HTTPException(
            status_code=404, detail=create_error_detail(ErrorCode.REWARD_NOT_FOUND, details={"reward_id": reward_id})
        )

    try:
        claim = crud_reward.claim_reward(db, user_id, reward_id)
    except ValueError as e:
        # ValueError from add_gold (insufficient gold)
        # e.args[0] is the error_detail dict from create_error_detail()
        error_detail = e.args[0]
        raise HTTPException(status_code=400, detail=error_detail)

    if not claim:
        raise HTTPException(
            status_code=400,
            detail=create_error_detail(
                ErrorCode.INVALID_INPUT,
                message="Failed to claim reward",
                details={"user_id": user_id, "reward_id": reward_id},
            ),
        )

    return claim
```

**Step 2: Run all tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_rewards.py -v`

Expected: All tests PASS, including the 3 new tests

**Step 3: Commit route handler changes**

```bash
cd backend
git add app/routes/reward.py
git commit -m "feat: handle insufficient gold error in reward claim endpoint

- Catch ValueError from claim_reward() CRUD function
- Return 400 Bad Request with structured error detail
- Preserve existing validation for user/reward existence"
```

---

## Task 6: Add Integration Test for Exact Gold Amount

**Files:**
- Modify: `backend/tests/test_rewards.py`

**Step 1: Write edge case test**

Add this test at the end of `backend/tests/test_rewards.py`:

```python
def test_claim_reward_with_exact_gold_amount(client: TestClient, home_with_user):
    """Test claiming a reward when user has exactly the required gold"""
    home_id, user_id, invite_code = home_with_user

    # Create reward costing 100 gold
    reward_response = client.post(
        f"/api/rewards?home_id={home_id}",
        json={"name": "Budget Item", "cost": 100}
    )
    reward_id = reward_response.json()["id"]

    # Give user exactly 100 gold
    client.patch(f"/api/users/{user_id}", json={"gold_balance": 100})

    # Claim reward (should succeed)
    response = client.post(f"/api/rewards/{reward_id}/claim?user_id={user_id}")
    assert response.status_code == 200

    # Verify gold is now 0
    user_response = client.get(f"/api/users/{user_id}")
    assert user_response.json()["gold_balance"] == 0
```

**Step 2: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_rewards.py::test_claim_reward_with_exact_gold_amount -v`

Expected: PASS

**Step 3: Commit test**

```bash
cd backend
git add tests/test_rewards.py
git commit -m "test: add edge case test for exact gold amount on claim"
```

---

## Task 7: Run Full Test Suite and Verify

**Step 1: Run all backend tests**

Run: `cd backend && uv run pytest -v`

Expected: All tests PASS (no regressions in other modules)

**Step 2: Run linter and formatter**

Run:
```bash
cd backend
uv run ruff format .
uv run ruff check --fix .
```

Expected: No errors, code formatted

**Step 3: Manual smoke test (optional)**

If you want to manually verify:

```bash
# Start backend server
cd backend && uv run python main.py

# In another terminal, use curl or Postman:
# 1. Create a home
# 2. Create a user
# 3. Login to get JWT token
# 4. Create a reward with cost 100
# 5. Try to claim with 0 gold (should fail 400)
# 6. Update user gold to 100
# 7. Claim reward (should succeed, gold now 0)
```

**Step 4: Final commit (if any formatting changes)**

```bash
cd backend
git add -A
git commit -m "chore: format code with ruff"
```

---

## Task 8: Update API Documentation (Optional)

**Files:**
- Modify: `backend/app/routes/reward.py:53` (docstring)

**Step 1: Enhance docstring**

Update the `claim_reward` route docstring to document new behavior:

```python
@router.post("/{reward_id}/claim", response_model=UserRewardClaimRead)
def claim_reward(
    reward_id: int, user_id: int = Query(...), db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)
):
    """
    User claims a reward.

    Validates user has sufficient gold balance and deducts the reward cost.

    Args:
        reward_id: ID of the reward to claim
        user_id: ID of the user claiming the reward

    Returns:
        UserRewardClaimRead: Created claim record

    Raises:
        404: User or reward not found, or not in authenticated home
        400: Insufficient gold balance (returns INSUFFICIENT_GOLD error code)
    """
```

**Step 2: Commit documentation**

```bash
cd backend
git add app/routes/reward.py
git commit -m "docs: update claim_reward endpoint docstring"
```

---

## Summary

**What We Built:**
- Gold validation before reward claims (prevents overspending)
- Gold deduction using safe `add_gold()` helper
- Structured error responses with `INSUFFICIENT_GOLD` error code
- Comprehensive test coverage (5 new tests)

**Tests Added:**
1. `test_claim_reward_insufficient_gold` - Validates 400 error when gold < cost
2. `test_claim_reward_deducts_gold` - Validates gold is deducted on success
3. `test_claim_free_reward` - Validates free rewards (cost=0) work
4. `test_claim_reward_with_exact_gold_amount` - Edge case: exact gold match

**Files Modified:**
- `backend/app/crud/reward.py` - Added validation and deduction logic
- `backend/app/routes/reward.py` - Added error handling for insufficient gold
- `backend/tests/test_rewards.py` - Added 5 comprehensive tests

**Validation Checklist:**
- ✅ All tests pass
- ✅ Code formatted with ruff
- ✅ Gold deducted correctly
- ✅ Insufficient gold returns 400 error
- ✅ Free rewards (cost=0) still work
- ✅ Error messages include helpful details (required, current, user_id, reward_id)

---

**Next Steps:**

After completing Phase 1, proceed to:
- **Phase 2**: Heroic Elixir implementation (consumable XP boost)
- **Phase 3**: Corruption system (deadline tracking and house debuff)
- **Phase 4**: Purification Shield implementation

See `docs/plans/2026-01-25-gold-economy-corruption-design.md` for full roadmap.

---

**Estimated Effort:** 1-2 hours
**Actual Effort:** Completed as part of larger consumable system implementation
**Completion Date:** 2026-01-26
**Status:** ✅ IMPLEMENTED

---

## Implementation Notes (2026-01-26)

**Completion Summary:**

Phase 1 (gold validation and deduction) was implemented as part of the larger consumable system work. The implementation went beyond the original spec by also adding:

1. **Consumable Activation Logic** (Phase 2 & 4):
   - Heroic Elixir activation (`active_xp_boost_count = 3`)
   - Purification Shield activation (`active_shield_expiry = now + 24h`)
   - Non-stacking validation (raises `CONSUMABLE_ALREADY_ACTIVE` error)

2. **Enhanced Error Handling**:
   - Added `ErrorCode.CONSUMABLE_ALREADY_ACTIVE` to errors.py
   - Detailed error messages showing remaining count/time

3. **All Tests Passing**:
   - Original test suite: `test_claim_reward_insufficient_gold`, `test_claim_reward_deducts_gold`, etc.
   - All 118 backend tests passing

**Files Modified:**
- `backend/app/crud/reward.py` - Gold validation + consumable activation
- `backend/app/routes/reward.py` - Error handling (already had try/catch)
- `backend/app/errors.py` - Added CONSUMABLE_ALREADY_ACTIVE
- `backend/tests/test_rewards.py` - Tests already existed and passing

**Git Commits:**
- `ac9263e` - User model + migration
- `b03f5bc` - Consumable system (includes Phase 1 gold validation)
- `1f22540` - Test updates

**Next Steps:** Frontend integration (Market page error handling, consumable indicators)
