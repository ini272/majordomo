# Recurring Quests Design

**Date:** 2026-01-27
**Status:** Design Complete - Ready for Implementation

## Overview

This design adds recurring quest functionality to Majordomo, allowing quest templates to automatically generate quest instances on schedules (daily, weekly, monthly). The system uses on-demand generation triggered by Quest Board loads, requiring no background processes or cron jobs.

## Core Concept

**What Users Get:**
- Quest templates can have schedules: "Daily at 8am", "Weekly on Monday at 6pm", "Monthly on 15th at 8am"
- System auto-generates quest instances when the scheduled time arrives
- Optional auto-deadlines: "Complete within 48 hours" (for corruption system)
- Manual override: "Generate Now" button to create instances on-demand

**Key Design Decisions:**
- **Time-based generation** - Quests appear at scheduled times (not on completion)
- **Manual trigger support** - Users can force generation via UI button
- **Skip if incomplete** - Don't create new instance if previous one still active (prevents spam)
- **On-demand architecture** - Generation happens on Quest Board load, no background scheduler needed
- **Per-user instances** - Each home member gets their own quest instance from shared template

## Data Model Changes

### QuestTemplate Schema Updates

Add three new fields to `QuestTemplate`:

```python
class QuestTemplate(SQLModel, table=True):
    # ... existing fields ...

    recurrence: str = Field(default="one-off")  # "one-off", "daily", "weekly", "monthly"
    schedule: Optional[str] = Field(default=None)  # JSON string with schedule details
    last_generated_at: Optional[datetime] = None  # When last instance was created
    due_in_hours: Optional[int] = Field(default=None, ge=1, le=8760)  # Relative deadline (1h-1yr)
```

**Field Details:**

**`recurrence`** (existing field, kept for backward compatibility):
- Simple string for filtering: "one-off", "daily", "weekly", "monthly"
- Easy queries: `WHERE recurrence = 'daily'`
- Must match `schedule.type` for validation

**`schedule`** (new, JSON string):
- Stores detailed timing information
- Null for one-off quests
- Examples:
  - Daily: `{"type": "daily", "time": "08:00"}`
  - Weekly: `{"type": "weekly", "day": "monday", "time": "18:00"}`
  - Monthly: `{"type": "monthly", "day": 15, "time": "08:00"}`

**`last_generated_at`** (new, datetime):
- Tracks when system last created a quest instance from this template
- Prevents duplicate generation during same time window
- Null = never generated

**`due_in_hours`** (new, integer):
- Optional relative deadline for auto-generated corruption deadlines
- Stored in hours for flexibility (2h, 12h, 48h, 168h for 1 week)
- When instance is generated: `quest.due_date = now + timedelta(hours=template.due_in_hours)`
- **Important:** This is separate from schedule generation time
  - Schedule = when quest appears on board
  - Due date = when corruption triggers if incomplete

### Backward Compatibility

- Existing templates have `recurrence="one-off"` and `schedule=None` → no auto-generation
- No data migration required
- Users can edit old templates to add schedules

## Quest Generation Logic

### Generation Triggers

Quest generation is triggered on two events:

1. **Quest Board Load** - When any user fetches their quest list (`GET /api/quests`)
2. **Manual Trigger** - User clicks "Generate Now" button (`POST /api/quest-templates/{id}/generate-instance`)

### Core Generation Algorithm

```python
def generate_due_quests(home_id: int, session: Session):
    """Check all recurring templates and generate overdue instances"""

    # Get all recurring templates for this home that might need generation
    templates = session.exec(
        select(QuestTemplate)
        .where(QuestTemplate.home_id == home_id)
        .where(QuestTemplate.recurrence != "one-off")
        .where(
            # Performance optimization: skip recently generated templates
            or_(
                QuestTemplate.last_generated_at.is_(None),
                QuestTemplate.last_generated_at < datetime.now(timezone.utc) - timedelta(hours=1)
            )
        )
    ).all()

    now = datetime.now(timezone.utc)

    for template in templates:
        if not template.schedule:
            continue  # Skip templates without schedule config

        schedule = json.loads(template.schedule)
        next_generation_time = calculate_next_generation_time(
            template.last_generated_at,
            schedule
        )

        # Check if it's time to generate
        if now >= next_generation_time:
            # Check if incomplete instance already exists (skip if so)
            existing = session.exec(
                select(Quest)
                .where(Quest.quest_template_id == template.id)
                .where(Quest.completed == False)
            ).first()

            if existing:
                continue  # Skip creation to prevent spam

            # Create new quest instance for each user in home
            users = get_home_users(home_id, session)
            for user in users:
                # Calculate due date if template specifies it
                due_date = None
                if template.due_in_hours:
                    due_date = now + timedelta(hours=template.due_in_hours)

                new_quest = Quest(
                    home_id=home_id,
                    user_id=user.id,
                    quest_template_id=template.id,
                    quest_type="standard",
                    due_date=due_date
                )
                session.add(new_quest)

            # Update last_generated_at to prevent duplicate generation
            template.last_generated_at = now
            session.add(template)

    session.commit()
```

**Key Logic Points:**

- Idempotent - calling multiple times in same minute won't create duplicates
- Skips creation if incomplete instance exists (prevents spam)
- Creates one quest instance per user in home
- Sets `due_date` on quest instances based on template's `due_in_hours`
- Updates `last_generated_at` to track generation

### Time Calculation Logic

The `calculate_next_generation_time()` function determines when the next quest instance should be created:

```python
def calculate_next_generation_time(
    last_generated_at: Optional[datetime],
    schedule: dict
) -> datetime:
    """
    Calculate when the next quest instance should be generated.

    Args:
        last_generated_at: When we last created an instance (None = never)
        schedule: JSON dict with schedule details

    Returns:
        datetime: The next time a quest should be generated
    """
    now = datetime.now(timezone.utc)
    schedule_type = schedule.get("type")

    if schedule_type == "daily":
        time_str = schedule.get("time", "00:00")
        hour, minute = parse_time(time_str)  # "08:00" -> (8, 0)

        # Calculate today's scheduled time
        today_scheduled = now.replace(hour=hour, minute=minute, second=0, microsecond=0)

        if last_generated_at is None:
            # Never generated - use today if time hasn't passed, else tomorrow
            return today_scheduled if now < today_scheduled else today_scheduled + timedelta(days=1)

        # Already generated today? Next occurrence is tomorrow
        if last_generated_at.date() == now.date():
            return today_scheduled + timedelta(days=1)

        # Last generated yesterday or earlier
        return today_scheduled if now >= today_scheduled else today_scheduled

    elif schedule_type == "weekly":
        day_name = schedule.get("day", "monday").lower()
        time_str = schedule.get("time", "00:00")
        hour, minute = parse_time(time_str)

        # Map day names to weekday numbers (0=Monday, 6=Sunday)
        day_map = {
            "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
            "friday": 4, "saturday": 5, "sunday": 6
        }
        target_weekday = day_map.get(day_name, 0)

        # Calculate next occurrence of target weekday
        days_ahead = target_weekday - now.weekday()
        if days_ahead < 0:  # Target day already passed this week
            days_ahead += 7
        elif days_ahead == 0:  # Today is the target day
            if now.hour > hour or (now.hour == hour and now.minute >= minute):
                days_ahead = 7  # Time passed, schedule for next week

        next_occurrence = now + timedelta(days=days_ahead)
        next_occurrence = next_occurrence.replace(
            hour=hour, minute=minute, second=0, microsecond=0
        )

        # Check if we already generated this week
        if last_generated_at and last_generated_at >= (now - timedelta(days=7)):
            # Already generated within last 7 days - skip to next week
            if next_occurrence - last_generated_at < timedelta(days=7):
                next_occurrence += timedelta(days=7)

        return next_occurrence

    elif schedule_type == "monthly":
        day_of_month = schedule.get("day", 1)  # 1-31
        time_str = schedule.get("time", "00:00")
        hour, minute = parse_time(time_str)

        # Calculate next occurrence
        target_date = now.replace(day=1, hour=hour, minute=minute, second=0, microsecond=0)

        # Try setting the target day (handle months with fewer days)
        try:
            target_date = target_date.replace(day=day_of_month)
        except ValueError:
            # Day doesn't exist in this month (e.g., Feb 31) - use last day
            last_day = calendar.monthrange(now.year, now.month)[1]
            target_date = target_date.replace(day=last_day)

        # If target already passed this month, move to next month
        if target_date <= now:
            # Move to next month
            if now.month == 12:
                target_date = target_date.replace(year=now.year + 1, month=1)
            else:
                target_date = target_date.replace(month=now.month + 1)

            # Handle day overflow again for next month
            try:
                target_date = target_date.replace(day=day_of_month)
            except ValueError:
                last_day = calendar.monthrange(target_date.year, target_date.month)[1]
                target_date = target_date.replace(day=last_day)

        # Check if already generated this month
        if last_generated_at and last_generated_at.month == now.month and last_generated_at.year == now.year:
            # Already generated this month - skip to next month
            if target_date.month == 12:
                target_date = target_date.replace(year=target_date.year + 1, month=1)
            else:
                target_date = target_date.replace(month=target_date.month + 1)

            # Handle day overflow for next month
            try:
                target_date = target_date.replace(day=day_of_month)
            except ValueError:
                last_day = calendar.monthrange(target_date.year, target_date.month)[1]
                target_date = target_date.replace(day=last_day)

        return target_date

    else:
        raise ValueError(f"Unknown schedule type: {schedule_type}")
```

**Example Behaviors:**

**Daily quest "Morning routine" at 08:00:**
- Template created Tuesday 10am → first instance appears Wednesday 8am
- Completed Wednesday 9am → next instance appears Thursday 8am
- Server offline Thursday → Friday 8am, first board load creates Thursday's instance

**Weekly quest "Trash day" Monday 18:00:**
- Template created Thursday → first instance appears next Monday 6pm
- Completed Monday 7pm → next instance appears following Monday 6pm
- Missed this Monday → old instance stays, new one skipped (per skip-if-incomplete rule)

**Monthly quest "Pay bills" on 15th at 08:00:**
- Creates quest on 15th of every month at 8am
- If scheduled for 31st in February → generates on Feb 28th/29th
- Already generated on 15th → waits until next month's 15th

## API Changes

### Modified Endpoints

**`POST /api/quest-templates`** - Create template with schedule:

```python
class QuestTemplateCreate(SQLModel):
    title: str = Field(min_length=1, max_length=200)
    display_name: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    tags: Optional[str] = Field(default=None, max_length=500)
    xp_reward: int = Field(default=10, ge=0, le=10000)
    gold_reward: int = Field(default=5, ge=0, le=10000)
    quest_type: str = Field(default="standard")
    recurrence: str = Field(default="one-off")  # one-off, daily, weekly, monthly
    schedule: Optional[str] = None  # JSON: {"type": "daily", "time": "08:00"}
    due_in_hours: Optional[int] = Field(default=None, ge=1, le=8760)  # Optional deadline
```

**Validation rules:**
- If `recurrence != "one-off"`, `schedule` must be valid JSON
- `schedule.type` must match `recurrence` value
- Weekly schedules must have valid day name (monday-sunday)
- Monthly schedules must have day 1-31
- Time strings must be "HH:MM" format (00:00 to 23:59)

**`PATCH /api/quest-templates/{id}`** - Update template (same fields as create)

**`GET /api/quests`** - Fetch quests with auto-generation:

```python
@router.get("/quests")
def get_quests(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get all quests for current user"""

    # STEP 1: Generate any recurring quests that are due
    generate_due_quests(user.home_id, session)

    # STEP 2: Fetch and return user's quests as normal
    quests = session.exec(
        select(Quest)
        .where(Quest.user_id == user.id)
        .where(Quest.completed == False)
    ).all()

    return [QuestRead.from_orm(q) for q in quests]
```

### New Endpoints

**`POST /api/quest-templates/{template_id}/generate-instance`** - Manual generation:

```python
@router.post("/quest-templates/{template_id}/generate-instance")
def generate_quest_instance(
    template_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Manually generate a quest instance from this template.
    Bypasses "skip if incomplete" check.
    Updates last_generated_at to prevent duplicate auto-generation.
    """
    template = get_template_or_404(template_id, session)

    # Verify user has access to this template
    if template.home_id != user.home_id:
        raise HTTPException(status_code=403, detail="Access denied")

    now = datetime.now(timezone.utc)

    # Calculate due date if template specifies
    due_date = None
    if template.due_in_hours:
        due_date = now + timedelta(hours=template.due_in_hours)

    # Create quest instance for requesting user only
    new_quest = Quest(
        home_id=user.home_id,
        user_id=user.id,
        quest_template_id=template.id,
        quest_type="standard",
        due_date=due_date
    )
    session.add(new_quest)

    # Update last_generated_at
    template.last_generated_at = now
    session.add(template)
    session.commit()
    session.refresh(new_quest)

    return QuestRead.from_orm(new_quest)
```

**Use cases:**
- "Generate Now" button in UI
- Manual quest creation when user wants extra instance
- Admin tools for testing/debugging

## UI/UX Changes

### Quest Template Creation/Edit Form

Add recurrence configuration section:

```
┌─────────────────────────────────────┐
│ Create Quest Template               │
├─────────────────────────────────────┤
│ Title: [Take out trash          ]   │
│ Display Name: [Defeat Trash Elem.]  │
│ Description: [________________]      │
│ Tags: [chores, cleaning         ]   │
│ XP Reward: [50]  Gold: [25]         │
│                                      │
│ ┌─ Recurrence ─────────────────┐   │
│ │ ○ One-off (no repeat)         │   │
│ │ ○ Daily at [08:00] ▼          │   │
│ │ ● Weekly on [Monday ▼] [18:00]│   │
│ │ ○ Monthly on day [15] [08:00] │   │
│ └───────────────────────────────┘   │
│                                      │
│ ┌─ Optional Deadline ──────────┐   │
│ │ ☐ Auto-set due date           │   │
│ │   Complete within: [48] hours │   │
│ │   (2 days)                    │   │
│ └───────────────────────────────┘   │
│                                      │
│ [Cancel]  [Save Template]           │
└─────────────────────────────────────┘
```

**Recurrence selector:**
- Radio buttons for one-off/daily/weekly/monthly
- Daily: time picker (HH:MM format)
- Weekly: day dropdown (Monday-Sunday) + time picker
- Monthly: day number input (1-31) + time picker
- Helper text for monthly: "If day doesn't exist in month, uses last day"

**Optional deadline section:**
- Checkbox to enable auto-deadlines
- Hours input field
- Live conversion: "48 hours = 2 days", "168 hours = 7 days"
- Explanation: "Quests will trigger corruption if not completed within this time"

### Quest Board Display

Show recurring indicators on quest cards:

```
📜 Morning Routine            🔄 Daily 8am
   +50 XP  +25 Gold           Due in 6h

🗑️ Take out Trash            🔄 Weekly Mon 6pm
   +75 XP  +30 Gold           No deadline

💰 Pay Bills                 🔄 Monthly 15th 8am
   +100 XP  +50 Gold          Due in 2 days
```

- 🔄 icon indicates recurring quest
- Show generation schedule in subtitle
- Show corruption deadline separately (if set)

### Quest Template List

Add generation status and manual controls:

```
Your Quest Templates
┌────────────────────────────────────────┐
│ 🔄 Morning Routine (Daily 8am)         │
│    50 XP • Last generated: 2h ago      │
│    [Edit] [Generate Now] [Delete]      │
├────────────────────────────────────────┤
│ 🔄 Take out Trash (Weekly Mon 6pm)     │
│    75 XP • Next gen: in 3 days         │
│    [Edit] [Generate Now] [Delete]      │
├────────────────────────────────────────┤
│ 🔄 Pay Bills (Monthly 15th 8am)        │
│    100 XP • Next gen: in 12 days       │
│    [Edit] [Generate Now] [Delete]      │
├────────────────────────────────────────┤
│ ⚡ Deep clean garage (One-off)         │
│    200 XP • Manual only                │
│    [Create Quest] [Edit] [Delete]      │
└────────────────────────────────────────┘
```

**"Generate Now" button:**
- Calls `POST /api/quest-templates/{id}/generate-instance`
- Creates instance immediately for current user
- Bypasses "skip if incomplete" logic
- Updates `last_generated_at` timestamp

## Edge Cases & Implementation Notes

### Server Downtime

**Scenario:** Server offline Saturday-Monday, "daily 8am" quest misses 2 days

**Behavior:**
- On next board load Monday 2pm: generates Monday's instance only
- Does NOT backfill Saturday/Sunday instances
- Keeps board clean, prevents spam

**Trade-off:** Users lose history of missed days, but prevents overwhelming quest board after downtime.

### Timezone Handling

**Storage:**
- All times stored in UTC internally (`datetime.now(timezone.utc)`)
- Schedule JSON stores time in "HH:MM" format (assumed user's local timezone)

**Conversion:**
- Frontend displays times in user's local timezone
- Backend converts schedule times to UTC when calculating `next_generation_time`

**Assumption:** For self-hosted home use, assume single timezone per household (simplifies MVP).

### Template Editing

**Scenario:** User changes schedule from "daily 8am" to "daily 6pm"

**Behavior:**
- `last_generated_at` stays unchanged
- Next generation uses new time (6pm)
- No retroactive changes to existing quest instances

**Effect:** Schedule changes take effect on next generation cycle.

### Multiple Users in Home

**Generation:**
- One template → one quest instance per home member per generation
- Each user gets their own copy
- Instances are independent (one user completes, others stay active)

**Example:**
- "Take out trash" template, 3 users in home
- Monday 6pm: creates 3 quest instances (one per user)
- User A completes Monday 7pm → their instance marked complete
- User B and C instances remain active until they complete

### Manual "Generate Now" Timing

**Scenario:** User clicks "Generate Now" at 7:55am, then board auto-generates at 8:00am

**Behavior:**
- Manual generation updates `last_generated_at` to 7:55am
- Auto-generation at 8:00am checks `calculate_next_generation_time(7:55am, schedule)`
- Returns tomorrow 8am (not today) → skips duplicate creation

**Result:** Safe - manual generation blocks immediate auto-generation.

### Incomplete Quest Blocking

**Scenario:** Monday's "Trash" quest incomplete, Tuesday arrives

**Behavior:**
- Generation logic checks for incomplete instance → skips creation
- User completes Monday's quest Tuesday morning
- Wednesday board load generates Wednesday's instance (NOT Tuesday's)

**Trade-off:**
- ✅ Simpler logic, cleaner board
- ❌ User "loses" Tuesday if they complete late

**Alternative (future):** Could implement "catch-up" mode that generates missed days when incomplete is cleared.

### Quest Type Inheritance

**Scenario:** Recurring template has `quest_type="standard"`

**Behavior:**
- Generated instances inherit `quest_type="standard"`
- If instance becomes corrupted, only the instance's `quest_type` changes to "corrupted"
- Template remains "standard" for future generations
- Already working via existing corruption system

### Performance Optimization

**Query optimization:**
```python
# Only check templates that might need generation
templates = session.exec(
    select(QuestTemplate)
    .where(QuestTemplate.home_id == home_id)
    .where(QuestTemplate.recurrence != "one-off")
    .where(
        # Skip if generated within last hour (prevents redundant checks)
        or_(
            QuestTemplate.last_generated_at.is_(None),
            QuestTemplate.last_generated_at < datetime.now(timezone.utc) - timedelta(hours=1)
        )
    )
).all()
```

**Why fast:**
- Typical home has <50 recurring templates
- `last_generated_at` filter reduces unnecessary time calculations
- Most checks result in "not due yet" → quick exit

**Expected overhead:**
- Quest Board load: +10-50ms for generation check
- Negligible for self-hosted single-family use

## Testing Strategy

### Unit Tests

**Time Calculation Tests:**
```python
# Daily
def test_daily_first_generation_before_scheduled_time()
def test_daily_first_generation_after_scheduled_time()
def test_daily_already_generated_today()

# Weekly
def test_weekly_next_occurrence_same_week()
def test_weekly_next_occurrence_next_week()
def test_weekly_already_generated_this_week()

# Monthly
def test_monthly_generation_normal_day()
def test_monthly_generation_invalid_day()  # Feb 31 -> Feb 28/29
def test_monthly_already_generated_this_month()
```

**Generation Logic Tests:**
```python
def test_generate_creates_instance_when_due()
def test_generate_skips_when_incomplete_exists()
def test_generate_creates_for_all_home_users()
def test_generate_updates_last_generated_at()
def test_generate_sets_due_date_from_template()
def test_generate_skips_templates_without_schedule()
def test_generate_handles_malformed_schedule_json()
```

**Validation Tests:**
```python
def test_template_creation_with_valid_schedule()
def test_template_creation_rejects_invalid_schedule()
def test_template_creation_rejects_recurrence_schedule_mismatch()
def test_template_creation_rejects_invalid_day_name()
def test_template_creation_rejects_invalid_time_format()
```

### Integration Tests

```python
def test_quest_board_triggers_generation(client, auth_headers)
def test_manual_generation_endpoint(client, auth_headers)
def test_template_creation_with_schedule(client, auth_headers)
def test_template_update_changes_schedule(client, auth_headers)
def test_generation_respects_incomplete_quest_blocking(client, auth_headers)
def test_due_date_calculated_from_template(client, auth_headers)
```

### Manual Testing Checklist

- [ ] Create daily template, verify generation at scheduled time
- [ ] Create weekly template, verify generation on correct day
- [ ] Create monthly template, verify generation on correct day
- [ ] Create monthly template for 31st, verify handling in February
- [ ] Complete quest, verify next instance generates on schedule
- [ ] Leave quest incomplete, verify new generation is skipped
- [ ] Edit template schedule, verify next generation uses new time
- [ ] Click "Generate Now" button, verify immediate instance creation
- [ ] Test with multiple users in home, verify all get instances
- [ ] Set `due_in_hours` on template, verify instances have correct due dates
- [ ] Verify Quest Board shows recurring indicators
- [ ] Verify template list shows generation status

## Implementation Phases

### Phase 1: Backend Foundation
- Add schema fields to `QuestTemplate` model
- Implement `calculate_next_generation_time()` function
- Implement `generate_due_quests()` function
- Add generation trigger to `GET /api/quests`
- Add validation to template create/update endpoints
- Write unit tests for time calculation
- Write unit tests for generation logic

### Phase 2: Manual Generation
- Implement `POST /api/quest-templates/{id}/generate-instance` endpoint
- Add validation and error handling
- Write integration tests

### Phase 3: Frontend UI
- Update quest template creation form with recurrence selector
- Add optional deadline checkbox and hours input
- Add recurring indicators to quest board cards
- Update template list with generation status
- Add "Generate Now" button to template list
- Add helper text and tooltips

### Phase 4: Polish & Testing
- Manual testing of all scenarios
- Edge case testing (server downtime, timezone edge cases)
- Performance testing with large numbers of templates
- Documentation updates
- User feedback and iteration

## Future Enhancements

**Not in initial implementation, consider for later:**

- **Backfill mode:** Generate missed instances when incomplete is cleared
- **Per-user schedules:** Different users can have different schedules for same template
- **Interval-based recurrence:** "Every 3 days" instead of fixed days
- **Advanced monthly:** "2nd Monday of month", "Last Friday of month"
- **Pause/resume:** Temporarily disable recurring generation (vacation mode)
- **Generation history:** Track all generated instances for analytics
- **Bulk operations:** "Generate all overdue quests" admin button
- **Background scheduler:** Optional cron job for guaranteed timing (reduces on-demand load)
- **Timezone per user:** Support multi-timezone households

## Success Criteria

**MVP is successful when:**
- Users can create templates with daily/weekly/monthly schedules
- Quest instances auto-generate at scheduled times (within 5 minutes)
- "Skip if incomplete" logic prevents quest spam
- Manual "Generate Now" works reliably
- Auto-deadlines (`due_in_hours`) work with corruption system
- UI clearly shows recurring status and next generation time
- All tests pass
- No performance degradation on Quest Board load

## Open Questions

None - design is complete and validated.
