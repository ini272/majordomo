# Gold Economy & Corruption System Design

**Date**: 2026-01-25
**Status**: ✅ Implemented (2026-01-26)
**Target**: MVP Gold Economy v1 + Corruption Mechanics

---

## I. Executive Summary

This design establishes a two-loop gold economy and corruption system for Majordomo:

1. **Gold Economy**: Consumable purchases (potions, shields) that create ongoing gold value
2. **Corruption System**: Deadline-based pressure mechanic with household-wide consequences

**Core Principle**: Gold should feel abundant enough to spend regularly, but scarce enough that purchases feel meaningful. Target: Average player can afford 1-2 consumables per week of normal play.

---

## II. Gold Economy Design

### A. The Two-Loop System

**Loop 1: Frequent Small Wins** (MVP Implementation)
- Consumables purchased regularly (150-200 gold range)
- Creates short-term engagement and immediate value
- Examples: XP boost potions, debuff cleansers

**Loop 2: Milestone Savings** (Future Implementation)
- Permanent unlocks saved for over time (500-2000 gold range)
- Creates long-term goals and progression
- Examples: Avatars, themes, titles, profile customization

**MVP Scope**: Loop 1 only - two consumable items that tie into existing systems.

### B. MVP Consumables

#### 1. Heroic Elixir (XP Boost Potion)

**Cost**: 150 gold
**Effect**: Next 3 completed quests grant 2x XP
**Duration**: Quest-count based (no time limit) - persists until 3 quests completed
**Stacking**: Cannot purchase another Elixir while one is active

**Mechanics**:
- Activates immediately upon purchase/claim
- User tracks remaining boost count in `active_xp_boost_count` field
- Each quest completion decrements counter by 1
- When counter reaches 0, can purchase again
- XP calculation: `final_xp = base_xp * 2` (if boost active)

**UI Indicators**:
- Active elixir shows in Hero Status Bar: "⚗️ 2 boosted quests remaining"
- Quest completion feedback: "+40 XP (20 base × 2 BOOSTED)"
- Market purchase button disabled when active: "Elixir active (2 remaining)"

**Strategic Value**:
- Best used before completing high-value quests (hard difficulty, bounties)
- Average quest: 20 XP → 3 boosted quests = 60 bonus XP for 150 gold
- ROI calculation: ~2.5 gold per bonus XP point

#### 2. Purification Shield (House Debuff Cleanser)

**Cost**: 200 gold
**Effect**: Removes house debuff penalties for 24 hours (real-time)
**Duration**: Timer-based - expires 24 hours after activation
**Stacking**: Cannot purchase another Shield while one is active

**Important Behavior**:
- Does NOT uncorrupt quests (they remain corrupted)
- Does NOT remove deadlines or change quest state
- ONLY suppresses the house debuff calculation temporarily
- When expired, debuff immediately re-applies based on current corruption count

**Mechanics**:
- Activates immediately upon purchase/claim
- User tracks expiry in `active_shield_expiry` timestamp field
- Debuff calculation checks: `if now < active_shield_expiry: return 0%`
- Background job or API middleware cleans up expired shields

**UI Indicators**:
- Active shield shows in Quest Board header: "🛡️ Protected (18h remaining)"
- Corrupted quests still display corruption styling (red border, warning)
- Market purchase button disabled when active: "Shield active (18h left)"
- Banner text: "🛡️ Protected - Corruption contained (18h remaining)"

**Strategic Value**:
- Buys time to clear corrupted quests without hurting household progress
- Most valuable when corruption penalty is severe (3+ quests = -15%+ debuff)
- Temporary reprieve, not permanent fix - encourages quest completion

### C. Gold Spending Flow

**Implementation Status**: ✅ Gold validation and deduction implemented in `claim_reward()`

**Purchase Flow**:
1. User navigates to Market page
2. Selects reward (Heroic Elixir or Purification Shield)
3. Clicks "Purchase" button
4. API validates:
   - User has sufficient gold balance
   - Consumable not already active (for non-stacking items)
5. If valid:
   - Deduct gold from user balance
   - Activate consumable effect (set user fields)
   - Create UserRewardClaim record (audit trail)
   - Return success
6. Frontend updates:
   - Shows success toast
   - Updates gold balance in Hero Status Bar
   - Disables purchase button (or shows cooldown)
   - Shows active consumable indicator

**Error Handling**:
- Insufficient gold: "You need 150 gold (you have 120)"
- Already active: "Elixir active - complete 2 more quests to purchase again"
- Generic failure: "Failed to purchase reward - please try again"

---

## III. Corruption System Design

### A. Core Mechanics

**Principle**: Corruption is opt-in pressure - only quests with deadlines can corrupt.

**Quest States**:
- `quest_type` field tracks current state: "standard", "bounty", or "corrupted"
- Bounty status determined dynamically: quest's `quest_template_id` matches today's `DailyBounty` entry
- `due_date` field (optional datetime) determines corruption eligibility
- `corrupted_at` timestamp records when corruption occurred

**State Combinations** (bounty and corruption are independent):
- Standard quest: No due date, never corrupts, template not today's bounty
- Bounty quest: Template matches today's daily bounty → gets 2x rewards
- Corrupted quest: `due_date` passed, household suffers -5% debuff per corrupted quest
- Bounty + Corrupted: Featured quest gone overdue → still gets 2x bounty rewards, household suffers debuff

### B. Corruption Trigger Logic

**When Does Corruption Happen?**
- Instant corruption when `due_date` timestamp passes
- Checked on API calls via `check_and_corrupt_overdue_quests()` helper
- No grace period - exact timestamp triggers corruption

**Corruption Process**:
1. Check if `now > quest.due_date` and `quest.corrupted_at is None`
2. If true:
   - Set `quest.quest_type = "corrupted"`
   - Set `quest.corrupted_at = now`
   - Persist to database
3. House debuff recalculated automatically on next quest completion

**Clearing Corruption** (permanent fix):
- Complete the quest → removes from corruption count
- Delete the quest → removes from corruption count
- Only way to eliminate the problem (shield is temporary)

### C. House Debuff System

**Penalty Calculation**:
- Each corrupted quest in the home adds -5% to XP and Gold rewards
- Applies to ALL household members (not just quest owner)
- Stacks up to -50% cap (10 corrupted quests maximum)

**Formula**:
```python
corrupted_count = count_corrupted_quests(home_id)
debuff_percent = min(corrupted_count * 5, 50)  # Cap at 50%
multiplier = 1.0 - (debuff_percent / 100.0)

# Example: 3 corrupted quests
# debuff_percent = 15
# multiplier = 0.85
# 20 XP quest → 17 XP (20 * 0.85)
# 10 Gold quest → 8 Gold (10 * 0.85, rounded down)
```

**Shield Override**:
```python
def calculate_debuff(user):
    if user.active_shield_expiry and now < user.active_shield_expiry:
        return 1.0  # No debuff

    corrupted_count = count_corrupted_quests(user.home_id)
    debuff_percent = min(corrupted_count * 5, 50)
    return 1.0 - (debuff_percent / 100.0)
```

**Application**:
- Quest completion rewards multiplied by debuff
- Applies to base XP/Gold before other multipliers (bounty, elixir)
- Order: `base_reward → apply_debuff → apply_bounty → apply_elixir`

### D. Visual & UX Feedback

**Quest Board Indicators**:
- Warning banner when corruption exists: "⚠️ 3 Corrupted Quests - Household suffering -15% XP/Gold"
- Dark red overlay or corruption particles on background (atmospheric)
- Individual corrupted quests: Red border/glow, "☠️ CORRUPTED" badge
- Bounty quests: Purple/gold accent, "⭐ BOUNTY" badge
- Bounty + Corrupted: Both visual treatments (purple + red, both badges)

**Shield Active**:
- Banner changes: "🛡️ Protected - Corruption contained (18h remaining)"
- Countdown timer visible
- Corrupted quests still show red styling (reminder to fix)
- No debuff applied to completions

**Hero Status Bar**:
- Shows active debuff if no shield: "⚠️ -15% rewards"
- Shows active shield if present: "🛡️ 18h"
- Shows active elixir if present: "⚗️ 2"

---

## IV. Database Schema Changes

### A. User Model Extensions

```python
class User(SQLModel, table=True):
    # ... existing fields ...

    # Gold economy fields (existing)
    gold_balance: int = Field(default=0, ge=0)

    # Consumable tracking (NEW)
    active_xp_boost_count: int = Field(default=0, ge=0)  # Remaining boosted quests
    active_shield_expiry: Optional[datetime] = None  # Shield expires at this time
```

### B. Quest Model Extensions

```python
class Quest(SQLModel, table=True):
    # ... existing fields ...

    # Corruption system fields
    quest_type: str = Field(default="standard")  # "standard", "bounty", "corrupted"
    due_date: Optional[datetime] = None  # When quest should be completed (optional)
    corrupted_at: Optional[datetime] = None  # When corruption occurred

    # Note: Bounty status determined dynamically by checking if quest_template_id
    # matches today's DailyBounty entry (no separate field needed)
```

### C. Reward Model Extensions

```python
class Reward(SQLModel, table=True):
    # ... existing fields ...

    # Consumable metadata (NEW - optional for MVP, can hardcode initially)
    reward_type: str = Field(default="consumable")  # "consumable" or "permanent"
    effect_type: Optional[str] = None  # "xp_boost", "purification_shield", etc.
    effect_data: Optional[str] = None  # JSON: {"boost_count": 3, "multiplier": 2}
```

**Note**: For MVP, can hardcode the two consumables instead of making fully generic.

---

## V. Implementation Roadmap

### Phase 1: Fix Gold Spending (Foundational) ✅ IMPLEMENTED
**Goal**: Make gold economy functional

**Tasks**:
1. ✅ Modified `crud/reward.py::claim_reward()`:
   - Added gold balance validation
   - Deducts `reward.cost` from `user.gold_balance`
   - Returns `INSUFFICIENT_GOLD` error if insufficient funds
2. ✅ Backend tests updated for gold validation
3. Frontend tasks (pending):
   - Update Market page to handle errors

**Files Modified**:
- `backend/app/crud/reward.py`
- `backend/app/routes/reward.py`
- `backend/tests/test_rewards.py`

### Phase 2: Heroic Elixir (MVP Gold Value) ✅ IMPLEMENTED
**Goal**: First consumable that demonstrates gold's value

**Tasks**:
1. ✅ Added `active_xp_boost_count` field to User model (migration)
2. Database task (pending): Create Heroic Elixir reward via INSERT or admin UI
3. ✅ Modified `claim_reward()` to activate elixir:
   - Checks if `reward.name == "Heroic Elixir"`
   - Sets `user.active_xp_boost_count = 3`
   - Prevents double-purchase (raises `CONSUMABLE_ALREADY_ACTIVE` error)
4. ✅ Modified `complete_quest()` in `routes/quest.py`:
   - Checks if `user.active_xp_boost_count > 0`
   - Applies 2x XP multiplier, decrements counter
   - Returns boost status in response
5. Frontend tasks (pending):
   - Add indicator in Hero Status Bar
   - Add boost feedback in quest completion toast

**Files Modified**:
- `backend/app/models/user.py` (migration)
- `backend/app/crud/reward.py`
- `backend/app/routes/quest.py`
- `backend/migrations/versions/add_consumable_tracking_fields.py`

### Phase 3: Corruption System (Enables Shield Value) ✅ IMPLEMENTED
**Goal**: Deadline pressure and house debuff

**Tasks**:
1. ✅ Add fields to Quest model (migration):
   - `due_date: Optional[datetime]`
   - `corrupted_at: Optional[datetime]`
2. ✅ Add corruption check logic:
   - Implemented in `check_and_corrupt_overdue_quests(db)` helper
   - Called on quest list endpoints to auto-check corruption
3. ✅ Implement `check_and_corrupt_overdue_quests()`:
   - Queries all non-corrupted quests with due_date set
   - Filters where `now > due_date`
   - Updates to corrupted state
4. ✅ Implement `_calculate_corruption_debuff(db, home_id, user)`:
   - Counts corrupted quests in home
   - Applies -5% per quest, capped at -50%
   - Checks shield expiry, returns 1.0 if active
5. ✅ Modified `complete_quest()` to apply debuff:
   - Order: base → debuff → bounty → xp_boost
   - Returns detailed breakdown in response
6. Frontend tasks (pending):
   - Add due_date field to quest creation/edit forms
   - Add corruption visual styling to QuestCard component
   - Add house debuff banner to Board page

**Files**:
- `backend/app/models/quest.py` (migration)
- `backend/app/crud/quest.py` (corruption logic, debuff calc)
- `backend/app/routes/quest.py` (middleware or endpoint wrapper)
- `frontend/src/components/QuestCard.tsx` (corruption styling)
- `frontend/src/components/CreateQuestForm.tsx` (deadline input)
- `frontend/src/pages/Board.tsx` (debuff banner)

**Estimated Effort**: 3-4 hours

### Phase 4: Purification Shield (Completes MVP) ✅ IMPLEMENTED
**Goal**: Second consumable that mitigates corruption

**Tasks**:
1. ✅ Added `active_shield_expiry` field to User model (migration)
2. Database task (pending): Create Purification Shield reward via INSERT or admin UI
3. ✅ Modified `claim_reward()` to activate shield:
   - Checks if `reward.name == "Purification Shield"`
   - Sets `user.active_shield_expiry = now + 24 hours`
   - Prevents double-purchase (raises `CONSUMABLE_ALREADY_ACTIVE` error)
4. ✅ `_calculate_corruption_debuff()` respects shield:
   - Returns 1.0 (no debuff) if shield active
   - Returns debuff multiplier otherwise
5. Frontend tasks (pending):
   - Add shield indicator (Board header, Hero Status Bar)
   - Add countdown timer display

**Files Modified**:
- `backend/app/models/user.py` (migration)
- `backend/app/crud/reward.py`
- `backend/app/routes/quest.py`
- `backend/migrations/versions/add_consumable_tracking_fields.py`

---

## VI. Testing Strategy

### Manual Testing Checklist

**Gold Spending**:
1. User with 0 gold tries to buy 150g Elixir → expect error
2. User with 100 gold tries to buy 150g Elixir → expect error
3. User with 200 gold buys 150g Elixir → expect success, balance = 50g
4. Refresh page → verify balance persists

**Heroic Elixir**:
1. Purchase elixir → verify counter shows "3 remaining"
2. Complete quest (20 XP) → verify 40 XP awarded, counter = 2
3. Complete 2 more quests → verify counter = 0, can purchase again
4. Try to purchase while active → expect error or disabled button

**Corruption**:
1. Create quest with deadline in 1 minute
2. Wait for deadline to pass
3. Refresh board → verify quest shows as corrupted
4. Create 3 corrupted quests → verify banner shows "-15% XP/Gold"
5. Complete quest → verify receives reduced rewards (17 XP instead of 20)
6. Complete corrupted quest → verify debuff decreases

**Purification Shield**:
1. Have 3 corrupted quests (debuff active)
2. Purchase shield → verify banner changes to "Protected"
3. Complete quest → verify full rewards (no debuff)
4. Wait 24 hours (or modify expiry time for testing) → verify debuff returns
5. Complete corrupted quest during shield → verify quest removed, debuff stays at 0 if all cleared

**Household-wide Debuff**:
1. User A creates corrupted quest
2. User B completes a quest → verify User B also suffers debuff
3. User A purchases shield → verify User B also benefits

### Automated Testing

**Backend**:
- Pytest tests for gold validation in `test_reward.py`
- Test elixir activation and quest boost in `test_quest.py`
- Test corruption trigger logic
- Test debuff calculation (0 quests, 1 quest, 3 quests, 10+ quests)
- Test shield override behavior

**Frontend**:
- (Optional for MVP) Vitest component tests for consumable UI indicators

---

## VII. Future Enhancements

### Loop 2: Permanent Unlocks (Post-MVP)

**Avatar System**:
- Cost: 500-1000 gold per avatar
- Unlocks: Character portraits displayed in Heroes page, Profile page
- Collection mechanic: "Unlock all 10 avatars" achievement

**App Themes**:
- Cost: 300-500 gold per theme
- Unlocks: Color schemes, background textures, quest card styles
- Examples: "Shadow Realm", "Golden Dawn", "Forest Sanctuary"

**Titles**:
- Cost: 200-400 gold per title
- Unlocks: Cosmetic badges/text shown next to username
- Examples: "Kitchen Scourge", "Bane of Laundry", "Dish Witch"

### Dynamic Pricing (Advanced)

- Scale consumable costs based on user level
- Level 1-5: 100g Elixir, 150g Shield
- Level 6-10: 150g Elixir, 200g Shield
- Level 11+: 200g Elixir, 250g Shield
- Keeps gold economy balanced as players earn more

### Consumable Variety (Advanced)

- **Quest Reroll**: Randomize a quest's description/flavor (50g)
- **Deadline Extension**: Push deadline back 24 hours (100g)
- **Gold Doubler**: Next 3 quests give 2x Gold (150g)
- **Corruption Reversal**: Uncorrupt one specific quest (250g)

### Corruption Variants (Advanced)

- **Corrupted Rewards Buff**: Make corrupted quests give 1.5x rewards (risk/reward)
  - Note: Decided against this for MVP to avoid clash with bounties
- **Boss Corruption**: 5+ corrupted quests spawn a "Corruption Boss" quest
  - Requires all household members to collaborate
  - High reward for clearing

---

## VIII. Open Questions & Decisions Log

| Question | Decision | Rationale | Date |
|----------|----------|-----------|------|
| Should gold serve short-term or long-term motivation? | Both - two-loop system | Creates engagement at multiple timescales | 2026-01-25 |
| Permanent or consumable purchases? | Mix (consumables for MVP) | Consumables create recurring demand, permanents for future | 2026-01-25 |
| Which cosmetics for permanent unlocks? | Avatars, themes, titles (future) | Fits fantasy household theme | 2026-01-25 |
| How many consumables for MVP? | 2 (XP boost, shield) | Minimal scope, demonstrates value | 2026-01-25 |
| Should bounties auto-corrupt? | No - bounties independent from corruption | Thematic clarity: bounty = reward, corruption = penalty | 2026-01-25 |
| XP boost duration type? | Quest-count (3 quests) | Simpler than time-based, no timers needed | 2026-01-25 |
| Should corrupted quests give bonus rewards? | No - same rewards, only debuff | Avoids clash with bounty theme, prevents exploitation | 2026-01-25 |
| House debuff scope? | Household-wide | Creates social pressure, shared stakes | 2026-01-25 |
| Consumable pricing? | Premium (150g elixir, 200g shield) | Makes purchases feel significant | 2026-01-25 |
| Should consumables stack? | No stacking for MVP | Simpler, prevents hoarding | 2026-01-25 |
| How many quests per elixir? | 3 quests | Balanced for 150g cost | 2026-01-25 |
| Corruption grace period? | Instant (no grace) | Creates urgency, simpler logic | 2026-01-25 |
| Debuff stacking formula? | -5% per quest, cap -50% | Meaningful penalty, doesn't become impossible | 2026-01-25 |
| Are bounty/corruption mutually exclusive? | No - independent states | Can have bounty quest that corrupts if deadline missed | 2026-01-25 |

---

## IX. Success Metrics

**MVP Success Criteria**:
1. Gold spending bug fixed - gold correctly deducted on purchases
2. Players can purchase and use Heroic Elixir (2x XP for 3 quests)
3. Quests with deadlines corrupt when overdue
4. House debuff applies correctly (-5% per corrupted quest, stacks to -50%)
5. Players can purchase Purification Shield to suppress debuff for 24hrs
6. UI clearly shows active consumables, corruption state, and debuff penalty

**Engagement Metrics** (post-launch observation):
- Consumable purchase frequency (target: 1-2 per player per week)
- Gold balance distribution (ensure players aren't hoarding excessively)
- Corruption rate (how often quests corrupt, is pressure too high/low?)
- Shield purchase triggers (are players buying when debuff is severe?)

**Balance Tuning Knobs** (adjust if needed):
- Consumable costs (150g, 200g)
- Elixir quest count (3 quests)
- Shield duration (24 hours)
- Debuff stacking rate (-5% per quest)
- Debuff cap (-50% max)

---

## X. Summary

This design creates a functional gold economy with two strategic consumables:
- **Heroic Elixir** drives progression (XP acceleration)
- **Purification Shield** mitigates pressure (corruption management)

The corruption system adds opt-in tension - players choose when to add deadlines, creating household-wide stakes and social pressure.

Together, these systems give gold ongoing value and create meaningful purchase decisions, supporting the core game loop of quest completion and household gamification.

**Next Steps**:
1. Review and approve this design document
2. Create feature branches: `feature/gold-spending-fix`, `feature/heroic-elixir`, `feature/corruption-system`, `feature/purification-shield`
3. Implement in phases (4 weeks estimated total)
4. Test and iterate based on household usage

---

**Document Owner**: jvr
**Reviewers**: N/A (solo project)
**Last Updated**: 2026-01-26

---

## XI. Implementation Notes (Added 2026-01-26)

### Backend Implementation Complete ✅

**Commits**:
- `ac9263e` - User model + migration (consumable tracking fields)
- `b03f5bc` - Consumable system implementation (Heroic Elixir + Purification Shield)
- `1f22540` - Test updates for new corruption behavior

**Key Implementation Details**:

1. **Field Names**:
   - Used `due_date` instead of `deadline` (clearer naming)
   - No separate `is_bounty` flag - bounty status determined dynamically

2. **Bounty System**:
   - Bounty status checked by matching `quest.quest_template_id` with `DailyBounty.quest_template_id`
   - Quest instances don't store bounty flag, only templates are matched

3. **Corruption Debuff** (NOT bonus rewards):
   - Each corrupted quest adds -5% penalty to household
   - Applies to ALL users in home (house-wide)
   - Capped at -50% (10 corrupted quests)
   - Shield suppresses debuff (returns 1.0 multiplier)

4. **Reward Calculation Order**:
   ```
   base_reward → corruption_debuff → bounty_multiplier → xp_boost
   ```

5. **API Response Structure**:
   ```json
   {
     "rewards": {
       "xp": 68,
       "gold": 17,
       "base_xp": 20,
       "base_gold": 10,
       "corruption_debuff": 0.85,
       "bounty_multiplier": 2,
       "xp_boost_active": true,
       "xp_boost_remaining": 2
     }
   }
   ```

### Remaining Work (Frontend + Database)

1. **Database Setup**:
   - Run migration: `alembic upgrade head`
   - Insert consumable rewards:
     ```sql
     INSERT INTO reward (home_id, name, description, cost) VALUES
     (your_home_id, 'Heroic Elixir', 'Double XP for your next 3 completed quests', 150),
     (your_home_id, 'Purification Shield', 'Protect household from corruption debuff for 24h', 200);
     ```

2. **Frontend Implementation**:
   - Market page error handling
   - Hero Status Bar: Show active elixir count, shield timer, debuff penalty
   - Quest Board: Corruption banner, shield banner, corrupted quest styling
   - Quest completion: Show boost/debuff breakdown in feedback toast
   - Quest creation/edit: Add due_date picker

3. **Testing**:
   - Manual end-to-end testing of consumable purchase flow
   - Verify corruption debuff calculation
   - Test shield suppression behavior
