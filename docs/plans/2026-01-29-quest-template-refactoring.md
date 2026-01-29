# Quest Template Refactoring Design

**Date:** 2026-01-29
**Status:** Design Draft
**Related Issues:** #33 (per-user schedules), QUEST_SYSTEM_NOTES.md

## Problem Statement

The current quest system has several architectural issues that limit flexibility and cause unexpected behavior:

1. **Tight Coupling**: Quests reference live template data. Editing a template's rewards/description affects all existing quests, including completed ones in history.

2. **Schedule Per Template**: Schedules are defined on `QuestTemplate`, meaning all users in a home get the same schedule. User A can't have "Clean Kitchen" daily while User B has it weekly.

3. **No Private Templates**: All templates are visible to the entire home. Users can't have personal templates only they can see.

4. **Non-Nullable Template ID**: Every quest requires a template, forcing system-generated dummy templates for one-off quests.

## Proposed Solution

### 1. Snapshot Pattern for Quest Instances

When a quest is created from a template, **copy** the relevant data into the quest itself. The quest becomes self-contained.

#### Quest Model Changes

```python
class Quest(SQLModel, table=True):
    # Primary key
    id: Optional[int] = Field(default=None, primary_key=True)

    # Relationships (template becomes OPTIONAL)
    home_id: int = Field(foreign_key="home.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    quest_template_id: Optional[int] = Field(default=None, foreign_key="quest_template.id")

    # SNAPSHOT fields (copied from template at creation, or set directly for one-offs)
    title: str = Field(max_length=200)
    display_name: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    tags: Optional[str] = Field(default=None, max_length=500)

    # Rewards (base at creation, updated to actual earned at completion)
    xp_reward: int = Field(default=0)
    gold_reward: int = Field(default=0)

    # Status fields
    completed: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

    # Corruption system
    quest_type: str = Field(default="standard")
    due_date: Optional[datetime] = None
    corrupted_at: Optional[datetime] = None
```

**Key insight on rewards:**
- At creation: `xp_reward` and `gold_reward` are **base values** (snapshot from template)
- At display time: API returns expected reward with current multipliers applied
- At completion: final reward calculated and stored in `xp_reward`/`gold_reward`
- No need for separate `xp_awarded`/`gold_awarded` fields

**All multipliers are DYNAMIC (calculated at completion):**

| Multiplier | When Calculated | Why Dynamic |
|------------|-----------------|-------------|
| Bounty (2x) | Completion | Bounty rotates daily - incentivizes completing TODAY |
| Corruption debuff | Completion | House state changes as quests are cleared |
| XP Boost (Heroic Elixir) | Completion | User activates consumable at completion time |

**Why dynamic for everything:**
- Bounty incentivizes completing quests on the bounty day, not just having them assigned
- Corruption debuff reflects current house state (clearing corrupted quests helps everyone)
- Simpler model: quest stores base value, multipliers calculated at point of action

**Display behavior:**
- Active quest: API returns `expected_xp` and `expected_gold` (base × current multipliers)
- Completed quest: `quest.xp_reward` contains actual earned amount

#### Removed Fields
- `xp_awarded` - no longer needed (use `xp_reward` updated at completion)
- `gold_awarded` - no longer needed (use `gold_reward` updated at completion)
- `is_bounty` - not needed (bounty checked dynamically)

#### Quest Creation Flow

```python
def create_quest_from_template(
    db: Session,
    template: QuestTemplate,
    user_id: int,
    home_id: int,
    due_date: Optional[datetime] = None
) -> Quest:
    """
    Create quest instance with snapshot of template data.

    Stores BASE rewards only. Multipliers (bounty, corruption, boosts)
    are calculated dynamically at display time and completion time.
    """
    return Quest(
        home_id=home_id,
        user_id=user_id,
        quest_template_id=template.id,  # Optional link back
        # Snapshot all display data
        title=template.title,
        display_name=template.display_name,
        description=template.description,
        tags=template.tags,
        # Base rewards (multipliers applied at completion)
        xp_reward=template.xp_reward,
        gold_reward=template.gold_reward,
        due_date=due_date,
    )

def create_standalone_quest(
    db: Session,
    home_id: int,
    user_id: int,
    title: str,
    xp_reward: int = 10,
    gold_reward: int = 5,
    **kwargs
) -> Quest:
    """Create one-off quest without template"""
    return Quest(
        home_id=home_id,
        user_id=user_id,
        quest_template_id=None,  # No template
        title=title,
        xp_reward=xp_reward,
        gold_reward=gold_reward,
        **kwargs
    )
```

#### Quest Completion Flow

```python
def complete_quest(
    db: Session,
    quest: Quest,
    user: User,
    home_id: int
) -> dict:
    """
    Complete a quest and apply ALL multipliers at completion time.

    All multipliers are dynamic and calculated at this moment:
    - Bounty (2x if quest's template is today's bounty)
    - Corruption debuff (based on current house corruption count)
    - XP boost (if user has active Heroic Elixir)
    """
    # Get base rewards (snapshot from template)
    base_xp = quest.xp_reward
    base_gold = quest.gold_reward

    # Check if this is today's bounty
    today_bounty = get_today_bounty(db, home_id)
    is_bounty = today_bounty and today_bounty.quest_template_id == quest.quest_template_id
    bounty_multiplier = 2 if is_bounty else 1

    # Apply bounty multiplier
    xp_after_bounty = base_xp * bounty_multiplier
    gold_after_bounty = base_gold * bounty_multiplier

    # Apply corruption debuff (house-wide penalty)
    corruption_multiplier = calculate_corruption_debuff(db, home_id, user)
    xp_after_debuff = int(xp_after_bounty * corruption_multiplier)
    gold_after_debuff = int(gold_after_bounty * corruption_multiplier)

    # Apply XP boost if active (user consumable)
    xp_boost_multiplier = 2 if user.active_xp_boost_count > 0 else 1
    final_xp = int(xp_after_debuff * xp_boost_multiplier)
    final_gold = gold_after_debuff  # Gold not affected by XP boost

    # Update quest with final earned amounts
    quest.completed = True
    quest.completed_at = datetime.now(timezone.utc)
    quest.xp_reward = final_xp
    quest.gold_reward = final_gold

    # Award to user
    add_xp(db, user.id, final_xp)
    add_gold(db, user.id, final_gold)

    # Decrement XP boost if used
    if xp_boost_multiplier > 1:
        user.active_xp_boost_count -= 1

    db.commit()

    return {
        "quest": quest,
        "rewards": {
            "xp": final_xp,
            "gold": final_gold,
            "base_xp": base_xp,
            "base_gold": base_gold,
            "is_bounty": is_bounty,
            "bounty_multiplier": bounty_multiplier,
            "corruption_debuff": corruption_multiplier,
            "xp_boost_active": xp_boost_multiplier > 1,
        }
    }
```

**Reward calculation summary:**

```
Creation time:
  quest.xp_reward = template.xp_reward  (base value only)

Completion time:
  final = base × bounty × corruption_debuff × xp_boost
  quest.xp_reward = final  (updated in place)
```

**API response for active quests:**

```python
def get_quest_with_expected_rewards(quest: Quest, home_id: int, user: User) -> dict:
    """Return quest with calculated expected rewards based on current state"""
    if quest.completed:
        # Already completed - xp_reward is the actual earned
        return {"quest": quest, "expected_xp": quest.xp_reward, "expected_gold": quest.gold_reward}

    # Calculate expected based on current multipliers
    today_bounty = get_today_bounty(db, home_id)
    is_bounty = today_bounty and today_bounty.quest_template_id == quest.quest_template_id
    bounty_mult = 2 if is_bounty else 1
    corruption_mult = calculate_corruption_debuff(db, home_id, user)

    expected_xp = int(quest.xp_reward * bounty_mult * corruption_mult)
    expected_gold = int(quest.gold_reward * bounty_mult * corruption_mult)

    return {
        "quest": quest,
        "expected_xp": expected_xp,
        "expected_gold": expected_gold,
        "is_bounty": is_bounty,
        "corruption_debuff": corruption_mult,
    }
```

**Frontend display:**
- Active quest: show `expected_xp` and `expected_gold` from API (reflects current multipliers)
- Completed quest: show `quest.xp_reward` and `quest.gold_reward` (actual earned)

### 2. User Template Subscriptions (Per-User Schedules)

New entity that allows each user to "subscribe" to a template with their own schedule settings.

#### New Model

```python
class UserTemplateSubscription(SQLModel, table=True):
    """
    Links a user to a quest template with personalized schedule settings.

    This enables:
    - User A: "Clean Kitchen" daily at 8am
    - User B: "Clean Kitchen" weekly on Monday at 6pm
    - Same template, different schedules per user
    """
    __tablename__ = "user_template_subscription"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    quest_template_id: int = Field(foreign_key="quest_template.id", index=True)

    # Per-user schedule settings
    recurrence: str = Field(default="one-off")  # one-off, daily, weekly, monthly
    schedule: Optional[str] = Field(default=None)  # JSON: {"type": "daily", "time": "08:00"}
    due_in_hours: Optional[int] = Field(default=None, ge=1, le=8760)

    # Generation tracking (PER USER, not per template)
    last_generated_at: Optional[datetime] = None
    is_active: bool = Field(default=True)  # Pause/resume functionality

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationships
    user: "User" = Relationship(back_populates="template_subscriptions")
    template: "QuestTemplate" = Relationship(back_populates="subscriptions")

    # Unique constraint: one subscription per user per template
    __table_args__ = (
        UniqueConstraint("user_id", "quest_template_id", name="unique_user_template_subscription"),
    )
```

#### QuestTemplate Changes

Remove schedule fields from template (they move to subscription):

```python
class QuestTemplate(SQLModel, table=True):
    """
    Quest blueprint - defines WHAT a quest is, not WHEN it appears.

    Templates are reusable definitions that users can subscribe to
    with their own schedules.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    home_id: int = Field(foreign_key="home.id", index=True)
    created_by: int = Field(foreign_key="user.id")

    # Quest definition
    title: str = Field(max_length=200)
    display_name: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    tags: Optional[str] = Field(default=None, max_length=500)
    xp_reward: int = Field(default=10, ge=0, le=10000)
    gold_reward: int = Field(default=5, ge=0, le=10000)

    # Template metadata
    visibility: str = Field(default="shared")  # "private" | "shared"
    system: bool = Field(default=False)  # System-generated template
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # REMOVED: recurrence, schedule, last_generated_at, due_in_hours
    # These now live on UserTemplateSubscription

    # Relationships
    subscriptions: list["UserTemplateSubscription"] = Relationship(back_populates="template")
    quests: list["Quest"] = Relationship(back_populates="template")
```

#### Generation Logic Changes

```python
def generate_due_quests(user_id: int, db: Session) -> list[Quest]:
    """
    Generate quest instances for a user based on their subscriptions.

    Called on Quest Board load - checks all active subscriptions
    and creates instances that are due.
    """
    user = get_user(db, user_id)
    now = datetime.now(timezone.utc)
    generated = []

    # Query user's active recurring subscriptions
    subscriptions = db.exec(
        select(UserTemplateSubscription)
        .where(UserTemplateSubscription.user_id == user_id)
        .where(UserTemplateSubscription.is_active == True)
        .where(UserTemplateSubscription.recurrence != "one-off")
        .where(
            or_(
                UserTemplateSubscription.last_generated_at.is_(None),
                UserTemplateSubscription.last_generated_at < now - timedelta(hours=1)
            )
        )
    ).all()

    for sub in subscriptions:
        if not sub.schedule:
            continue

        schedule = json.loads(sub.schedule)
        next_gen_time = calculate_next_generation_time(sub.last_generated_at, schedule)

        if now >= next_gen_time:
            # Check for incomplete instance (skip if exists)
            existing = db.exec(
                select(Quest)
                .where(Quest.quest_template_id == sub.quest_template_id)
                .where(Quest.user_id == user_id)
                .where(Quest.completed == False)
            ).first()

            if existing:
                continue  # Skip to prevent spam

            # Calculate due date
            due_date = None
            if sub.due_in_hours:
                due_date = now + timedelta(hours=sub.due_in_hours)

            # Create quest with snapshot of BASE rewards
            # (bounty/corruption applied dynamically at completion)
            template = sub.template
            new_quest = Quest(
                home_id=user.home_id,
                user_id=user_id,
                quest_template_id=template.id,
                title=template.title,
                display_name=template.display_name,
                description=template.description,
                tags=template.tags,
                xp_reward=template.xp_reward,  # Base only
                gold_reward=template.gold_reward,  # Base only
                due_date=due_date,
            )
            db.add(new_quest)
            generated.append(new_quest)

            # Update subscription's last_generated_at
            sub.last_generated_at = now
            db.add(sub)

    db.commit()
    return generated
```

### 3. Template Visibility (Private vs Shared)

#### Visibility Field

```python
visibility: str = Field(default="shared")  # "private" | "shared"
```

- **private**: Only the creator (`created_by`) can see and subscribe to this template
- **shared**: All home members can see and subscribe

#### Query Changes

```python
def get_available_templates(user: User, db: Session) -> list[QuestTemplate]:
    """Get templates visible to this user"""
    return db.exec(
        select(QuestTemplate)
        .where(QuestTemplate.home_id == user.home_id)
        .where(
            or_(
                QuestTemplate.visibility == "shared",
                QuestTemplate.created_by == user.id  # Always see your own
            )
        )
        .order_by(QuestTemplate.created_at.desc())
    ).all()
```

### 4. Nullable Template ID

#### Migration

```sql
ALTER TABLE quest ALTER COLUMN quest_template_id DROP NOT NULL;
```

#### Benefits

- One-off quests don't need dummy templates
- Quests survive template deletion (orphaned but functional)
- Simpler data model

#### Handling Orphaned Quests

When a template is deleted:
- Existing quests keep their snapshot data
- `quest_template_id` becomes a dangling reference (or set to NULL)
- Quest history remains intact

```python
def delete_template(db: Session, template_id: int) -> None:
    """Delete template, orphaning any existing quests"""
    # Option A: Set quest_template_id to NULL
    db.exec(
        update(Quest)
        .where(Quest.quest_template_id == template_id)
        .values(quest_template_id=None)
    )

    # Delete subscriptions
    db.exec(
        delete(UserTemplateSubscription)
        .where(UserTemplateSubscription.quest_template_id == template_id)
    )

    # Delete template
    template = get_template(db, template_id)
    db.delete(template)
    db.commit()
```

## Data Flow Diagram

```
┌─────────────────────────────────┐
│         QuestTemplate           │
│  (Blueprint - WHAT a quest is)  │
│                                 │
│  title, description, rewards    │
│  visibility: private | shared   │
└───────────────┬─────────────────┘
                │
                │ subscribe (each user picks their schedule)
                ▼
┌─────────────────────────────────┐
│    UserTemplateSubscription     │
│  (PER-USER schedule settings)   │
│                                 │
│  user_id                        │
│  recurrence, schedule           │
│  last_generated_at              │
│  is_active (pause/resume)       │
└───────────────┬─────────────────┘
                │
                │ generates (with SNAPSHOT)
                ▼
┌─────────────────────────────────┐
│            Quest                │
│  (Self-contained instance)      │
│                                 │
│  title, description (snapshot)  │
│  xp_reward, gold_reward         │
│   └─ base at creation           │
│   └─ actual after completion    │
│  quest_template_id (optional)   │
└─────────────────────────────────┘
```

## API Changes

### New Endpoints

#### Subscriptions

```
POST   /api/subscriptions                    # Subscribe to template with schedule
GET    /api/subscriptions                    # List my subscriptions
GET    /api/subscriptions/{id}               # Get subscription details
PATCH  /api/subscriptions/{id}               # Update schedule/pause
DELETE /api/subscriptions/{id}               # Unsubscribe
POST   /api/subscriptions/{id}/generate      # Manual "Generate Now"
```

#### Modified Endpoints

```
GET    /api/quest-templates                  # Now respects visibility
POST   /api/quest-templates                  # Add visibility field
POST   /api/quests                           # Can create without template
```

### Request/Response Examples

#### Subscribe to Template

```http
POST /api/subscriptions
{
    "quest_template_id": 42,
    "recurrence": "daily",
    "schedule": "{\"type\": \"daily\", \"time\": \"08:00\"}",
    "due_in_hours": 24
}
```

#### Create Standalone Quest (No Template)

```http
POST /api/quests
{
    "title": "One-time deep clean",
    "description": "Spring cleaning the garage",
    "xp_reward": 200,
    "gold_reward": 100,
    "due_date": "2026-02-01T18:00:00Z"
}
```

## Migration Strategy

### Phase 1: Add Snapshot Fields (Non-Breaking)

1. Add new fields to Quest model:
   - `title`, `display_name`, `description`, `tags`
   - Keep `xp_reward`, `gold_reward` (repurpose existing or rename from `xp_awarded`)

2. Backfill existing quests from their templates

3. Update quest creation to snapshot data

4. Frontend uses `quest.title` instead of `quest.template.title`

**Backward compatible**: Template relationship still works, just not used for display.

### Phase 2: Make Template ID Nullable

1. Migration: Drop NOT NULL constraint

2. Update code to handle `quest.template` being None

3. Add standalone quest creation endpoint

### Phase 3: Add UserTemplateSubscription

1. Create new table

2. Migrate existing template schedules:
   - For each recurring template, create subscription for each home member
   - Copy `recurrence`, `schedule`, `due_in_hours`, `last_generated_at`

3. Update generation logic to use subscriptions

4. Remove schedule fields from QuestTemplate

### Phase 4: Add Visibility

1. Add `visibility` field to QuestTemplate (default: "shared")

2. Update template queries to filter by visibility

3. Add UI toggle for private/shared

## Frontend Changes

### Quest Card

```tsx
// Before (live template reference)
<h2>{quest.template.display_name || quest.template.title}</h2>
<span>+{quest.template.xp_reward} XP</span>

// After (snapshot on quest)
<h2>{quest.display_name || quest.title}</h2>
<span>+{quest.xp_reward} XP</span>  {/* Base before completion, actual after */}
```

### Quest History

```tsx
// Already correct with snapshot pattern
<span>+{quest.xp_reward} XP</span>  {/* Shows actual earned */}
```

### Template Management

New subscription management UI:

```
My Subscriptions
┌────────────────────────────────────────┐
│ 🔄 Clean Kitchen                       │
│    Daily at 08:00 • Due within 24h     │
│    [Edit Schedule] [Pause] [Unsubscribe]│
├────────────────────────────────────────┤
│ 🔄 Take out Trash                      │
│    Weekly Monday at 18:00              │
│    [Edit Schedule] [Pause] [Unsubscribe]│
└────────────────────────────────────────┘

Available Templates
┌────────────────────────────────────────┐
│ 📋 Vacuum Living Room (shared)         │
│    50 XP • 25 Gold                     │
│    [Subscribe] [Create One-Off]        │
├────────────────────────────────────────┤
│ 🔒 My Secret Quest (private)           │
│    100 XP • 50 Gold                    │
│    [Subscribe] [Create One-Off]        │
└────────────────────────────────────────┘
```

## Testing Considerations

### Snapshot Integrity

- Quest created → template edited → quest still shows original values
- Template deleted → quest still displays correctly
- Quest completed → shows actual earned rewards

### Subscription Isolation

- User A subscribes daily, User B subscribes weekly → correct generation for each
- User A pauses → only User A stops receiving
- User A changes schedule → doesn't affect User B

### Visibility

- Private template → only creator sees it
- Shared template → all home members see it
- Private template owner leaves home → template remains private (orphaned?)

## Open Questions

1. **Template ownership transfer**: If creator leaves home, what happens to their templates?
   - Option A: Delete their private templates, keep shared ones
   - Option B: Transfer ownership to another home member
   - Option C: Keep as-is (orphaned creator_id)

2. **Subscription limits**: Should we limit subscriptions per user?
   - Probably not for self-hosted, but could add later

3. **Bulk subscribe**: When a new shared template is created, auto-subscribe all home members?
   - Probably not - let users opt-in

## Success Criteria

- [ ] Editing a template doesn't affect existing quests
- [ ] Same template can have different schedules per user
- [ ] Users can create private templates
- [ ] One-off quests work without templates
- [ ] Quest history shows accurate earned rewards
- [ ] All existing tests pass
- [ ] No performance regression
