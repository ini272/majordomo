# Daily Bounty Redesign (Per-User Quest-Instance)

Date: 2026-02-17  
Status: Validated (Brainstormed with user)

## Scope

Redesign daily bounty behavior to be reliable, motivating, and compatible with standalone quests.

In scope:
1. Bounty selection model and reward semantics.
2. Backend decision flow and data model.
3. Minimal Board behavior changes (`2x Bounty` indicator only).
4. Reliability protections so bounty works without manual refresh loops.

Out of scope:
1. Quest card visual redesign (ongoing parallel work).
2. Historical bounty analytics/leaderboards.
3. Scheduler/cron infrastructure.

## Confirmed Product Decisions

1. Bounty is completion-time based.
2. Bounty target is a quest instance, not a template.
3. Standalone quests are fully eligible.
4. Shared household board remains visible to all members.
5. Each user gets a personal daily bounty from quests assigned to that user.
6. Two users can have similar/same-content quests as bounty on the same day.
7. No consecutive repeat of the same quest unless eligible pool size is 1.
8. If bounty quest is completed early (for example 8:00 AM), no replacement until next day.
9. If bounty quest becomes unavailable (completed/deleted), no same-day replacement.
10. Bounty multiplier is flat 2x (XP and gold).
11. Eligibility requires minimum quest age of 48 hours (strict).
12. Eligibility checks only currently active quests at selection time.
13. If no eligible quest exists for a day, user has no bounty that day.
14. No repeated re-evaluation throughout the day.
15. Daily decision is created on first request (no midnight scheduler).
16. Home timezone is fixed and used for bounty day boundaries.

## Problem Statement

The prototype flow mixed two ideas:
1. UI-level "Accept Bounty" quest creation.
2. Backend dynamic bounty reward check.

This caused confusing behavior and reliability gaps. In current code, bounty creation is tied to `/bounty/today`, while completion checks today bounty existence separately. This can cause missed bounty application until a refresh/path creates the bounty record first.

The redesign must make bounty resolution deterministic and server-authoritative, while keeping frontend UX lightweight.

## Proposed Domain Model

Replace template-centric daily bounty behavior with per-user quest-instance selection:

Table: `daily_user_bounty`
1. `id` (PK)
2. `home_id` (FK)
3. `user_id` (FK)
4. `bounty_date` (date, interpreted in home timezone)
5. `quest_id` (nullable FK to quest)
6. `status` (`assigned` | `none_eligible`)
7. `created_at` (UTC timestamp)

Constraints:
1. `UNIQUE(home_id, user_id, bounty_date)` to guarantee one daily decision per user.

Related model updates:
1. `home.timezone` (required IANA timezone string, for example `America/New_York`).

## Selection and Day-Locking Flow

Resolver behavior (single source of truth, used by both bounty read and quest completion):

1. Compute `today` for the user using home timezone.
2. Try fetching `daily_user_bounty` for `(home_id, user_id, today)`.
3. If row exists, return it as-is (day already locked).
4. If row does not exist, select once from eligible quests:
   1. Quest belongs to same `home_id` and `user_id`.
   2. Quest is active (`completed = false`) at selection time.
   3. Quest age is at least 48 hours.
   4. Exclude yesterday's quest if pool size > 1.
5. If eligible pool is empty, create row with `status=none_eligible`, `quest_id=null`.
6. If eligible pool has candidates, pick one and create row with `status=assigned`, `quest_id=<picked quest>`.
7. Return created row.

Important semantics:
1. No same-day replacement after row creation.
2. No repeated scanning/checking after first row exists.
3. This is first-request daily locking (no scheduler dependency).

## Reward Application

At quest completion:
1. Resolve today's `daily_user_bounty` for the completing user.
2. `is_daily_bounty = (status == assigned && quest_id == completing_quest.id)`.
3. Apply 2x multiplier in existing reward pipeline:
   1. Base reward
   2. Corruption debuff
   3. Bounty multiplier
   4. XP boost

This removes dependency on Board opening/refresh and ensures consistent payouts.

## API Shape (Target)

`GET /api/bounty/today` returns user-personal bounty decision:
1. `bounty_date`
2. `status`
3. `bonus_multiplier` (2 when assigned, otherwise 1)
4. `quest` (nullable; full quest payload when assigned)

Notes:
1. Existing template-based payload fields (`template`, `quest_template_id`) become obsolete.
2. Frontend type definitions must align with new response shape.

## Frontend Behavior (Minimal UI Change)

Board behavior:
1. Keep current visual treatment (`2x Bounty` marker).
2. Remove/retire `Accept Bounty` flow as a bounty mechanic.
3. Determine bounty badge by quest instance id match from `/bounty/today`.
4. If `status=none_eligible`, show no quest badge (optional empty-state copy can be added later).

Quest card redesign work remains separate and unaffected.

## Reliability and Concurrency

1. Use one backend resolver in all relevant paths (`/bounty/today`, quest completion, and any other completion path).
2. Enforce unique daily row constraint to prevent double-create races.
3. If insert conflict occurs, re-read row and continue.
4. Ensure `is_daily_bounty` is always boolean in response payloads.
5. Align trigger/NFC completion path with same bounty multiplier rules if product wants consistent reward behavior across completion methods.

## Test Plan

Backend tests:
1. Creates daily decision row on first request.
2. Returns same row on repeated calls in same day.
3. Picks only user-assigned active quests.
4. Standalone quest can be selected.
5. Enforces 48h minimum age.
6. Creates `none_eligible` row when no candidates.
7. No consecutive repeat unless pool size is 1.
8. Completion before opening Board still applies bounty correctly.
9. Completion applies 2x only when `quest.id` matches assigned bounty quest.
10. Completed/deleted bounty quest does not trigger same-day replacement.
11. Concurrency: two simultaneous first requests result in one row.

Frontend tests:
1. Board shows `2x Bounty` badge only on returned `quest.id`.
2. No bounty badge when `none_eligible`.
3. No dependency on manual refresh to see applied bounty after completion.

## Rollout Notes (Dev Phase)

Since DB resets are acceptable in current development:
1. Introduce new schema directly.
2. Remove/deprecate old template-based daily bounty assumptions.
3. Update frontend types and consumers in one coordinated change.

## Success Criteria

1. Bounty applies deterministically without requiring UI refresh tricks.
2. Standalone quests participate naturally.
3. System creates motivation for older lingering quests (48h gate).
4. Household collaboration remains intact via shared board + personal bounty.
5. UI remains simple: users can identify bounty quest via existing `2x Bounty` indicator.
