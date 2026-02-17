# Daily Bounty Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement reliable per-user, quest-instance daily bounty behavior with strict 48-hour eligibility and day-lock semantics.

**Architecture:** Move bounty selection from template/day-home scope to user/day quest-instance scope. Add a single backend resolver that locks one decision row per user/day on first request. Quest completion checks this row by `quest_id` to apply 2x rewards. Frontend consumes the new bounty response and marks matching quest cards with existing `2x Bounty` UI.

**Tech Stack:** FastAPI, SQLModel, pytest (`uv`), React + TypeScript (`bun`)

---

### Task 1: Add failing backend tests for new bounty semantics

**Files:**
- Modify: `backend/tests/test_bounty.py`
- Adjust: `backend/tests/test_quest_corruption.py` (bounty interaction case)

**Steps:**
1. Write tests for first-request row creation (`assigned` and `none_eligible`).
2. Write tests for strict 48h eligibility and no same-day reevaluation.
3. Write tests for completion-time 2x matching by quest instance id.
4. Run targeted tests and confirm they fail against current implementation.

### Task 2: Implement backend domain/data model updates

**Files:**
- Modify: `backend/app/models/home.py`
- Modify: `backend/app/models/daily_bounty.py`
- Modify: `backend/app/crud/daily_bounty.py`
- Modify: `backend/app/routes/bounty.py`
- Modify: `backend/app/routes/quest.py`
- Modify: `backend/app/routes/auth.py`
- Modify: `backend/app/crud/home.py`

**Steps:**
1. Add home timezone support (fixed household timezone).
2. Replace daily bounty model/CRUD logic with per-user quest-instance decision model.
3. Add conflict-safe get-or-create resolver with unique day lock.
4. Update `/api/bounty/today` response shape.
5. Update quest completion bounty check to use resolver + `quest_id`.
6. Keep implementation minimal and driven by failing tests.

### Task 3: Update frontend API contracts and Board behavior

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/pages/Board.tsx`

**Steps:**
1. Update bounty response types to new server contract.
2. Remove `Accept Bounty` creation behavior from Board.
3. Keep current UI style and only apply `2x Bounty` marker by quest id match.
4. Ensure Board handles `none_eligible` gracefully.

### Task 4: Verification

**Files/Commands:**
- Backend: `uv run pytest backend/tests/test_bounty.py backend/tests/test_quest_corruption.py -q`
- Backend broader sanity: `uv run pytest backend/tests -q`
- Frontend type safety: `cd frontend && bun run typecheck`
- Frontend lint/build sanity: `cd frontend && bun run lint && bun run build`

**Steps:**
1. Run targeted tests first.
2. Run broader backend tests.
3. Run frontend checks with `bun`.
4. Fix regressions until checks are green.

### Task 5: Finalize and report

**Steps:**
1. Summarize behavior changes and touched files.
2. Call out any intentional follow-ups not implemented.
3. Share verification evidence and branch status.
