# Quest-First, Template-Optional Design

**Date:** 2026-01-30
**Status:** Design Complete - Ready for Implementation
**Related:** Phase 1-3 Quest Template Refactoring (complete)

## Problem Statement

Currently, every quest creation (AI Scribe, Random) automatically creates a template, even for one-time tasks. This causes:

1. **Template Clutter**: Template list filled with one-off quests ("Clean kitchen Monday 3pm")
2. **Conceptual Confusion**: Users see "templates" for tasks they'll never repeat
3. **Wasted Resources**: Extra database records for non-reusable quests
4. **Poor UX**: "Review & Edit" workflow implies editing a one-time quest affects a template

## Proposed Solution

**Mental Model Shift:**
- **Quest** = A task to do (default, lightweight)
- **Template** = Reusable blueprint for recurring quests (intentional upgrade)
- **Default**: Create standalone quests
- **Upgrade**: Convert quest → template when user realizes "I want this recurring"

## Core Concept

### Three Creation Flows

**1. AI Scribe**
```
User: Enters title "Clean kitchen", tags, schedule options
      Optional: ☐ Skip AI Scribe (for manual)
→ Backend: Creates standalone quest
→ AI: Generates display_name/description on quest (if not skipped)
→ EditQuestModal: Shows AI content + "☐ Save as reusable template"
→ User: Reviews, optionally checks template box (adds recurrence)
→ Save: Quest created, optionally template+subscription if checked
```

**2. Random Quest**
```
User: Clicks "Random Quest"
→ Backend: Creates standalone quest with sample data
→ EditQuestModal: Shows quest + "☐ Save as reusable template"
→ User: Customizes, optionally checks template box
→ Save: Quest created, optionally template+subscription if checked
```

**3. From Template** (existing workflow, unchanged)
```
User: Browses template list → [Review & Edit] or [Quick Create]
→ Backend: Quest created from template (snapshots template data)
→ Links to template (quest_template_id set)
→ No conversion option needed (already templated)
```

## EditQuestModal Behavior

### Three UI States

**State 1: Standalone Quest** (quest_template_id = NULL)
```
Shows:
- All quest fields (editable): title, display_name, description, tags
- XP/Gold sliders
- Recurrence: "one-off" (readonly or not shown)
- NEW: ☐ Save as reusable template

When checkbox checked:
- Recurrence selector appears (daily/weekly/monthly)
- Schedule configuration appears
- Due in hours option appears

On Save:
- Update quest with edits
- IF checkbox checked:
  → Create template from quest data
  → Set quest.quest_template_id to new template
  → Create subscription for user (if recurring)
- Close modal
```

**State 2: Templated Quest** (quest_template_id = 42)
```
Shows:
- All quest fields (editable) - snapshot data
- XP/Gold sliders
- Info badge: "From template: Clean Kitchen" (not editable)
- Recurrence/schedule shown as readonly info
- NO "Save as template" checkbox

Note displayed:
"Changes only affect this quest. To edit template/schedule,
 go to template management."

On Save:
- Update quest snapshot fields only
- Template unchanged
- Close modal
```

**State 3: New Quest** (AI Scribe/Random in create flow)
```
Same as State 1, but:
- Quest is unsaved (newly created)
- User is reviewing AI/random content
- Can customize before finalizing
```

## Backend Changes

### API Modifications

**1. AI Service Refactor**
```python
# Current: AI updates template
def generate_quest_content(template_id: int, title: str):
    # Calls Groq API
    # Updates QuestTemplate fields

# NEW: AI updates quest
def generate_quest_content(quest_id: int, title: str):
    # Calls Groq API
    # Updates Quest.display_name, Quest.description
    # Works with standalone quests
```

**2. New Endpoint: Convert Quest to Template**
```python
POST /api/quests/{quest_id}/convert-to-template

Request Body:
{
  "recurrence": "weekly",
  "schedule": {"type": "weekly", "day": "monday", "time": "08:00"},
  "due_in_hours": 24
}

Response: QuestTemplate

Logic:
1. Validate quest is standalone (quest_template_id = NULL)
2. Create QuestTemplate from quest snapshot data
3. Update quest.quest_template_id = new_template.id
4. Create UserTemplateSubscription for requesting user (if recurring)
5. Return created template
```

**3. Modified Endpoints**

```python
# NEW: AI Scribe - Create standalone quest
POST /api/quests/ai-scribe
Request: { title, tags, ... }
Response: Quest
→ Creates standalone Quest (not QuestTemplate)
→ Triggers AI generation on quest_id
→ Returns quest immediately

# NEW: Random - Create standalone quest
POST /api/quests/random
Response: Quest
→ Creates standalone Quest with sample data
→ Returns quest immediately

# UNCHANGED: From template
POST /api/quests
Request: { quest_template_id, due_date }
Response: Quest
→ Creates quest from template_id
→ Snapshots template data
→ Sets quest_template_id
```

## Frontend Changes

### CreateQuestForm Updates

**AI Scribe Flow**
```typescript
handleSubmit():
  // No template creation anymore
  const quest = await api.quests.createAIScribe({
    title: title.trim(),
    tags: selectedTags.join(","),
    recurrence: recurrence,
    schedule: schedule,
    due_in_hours: dueInHours
  });

  // Open EditQuestModal with quest (not template)
  setEditingQuest(quest);
  setShowEditModal(true);
```

**Random Flow**
```typescript
handleRandomQuest():
  const quest = await api.quests.createRandom();

  // Open EditQuestModal with quest
  setEditingQuest(quest);
  setShowEditModal(true);
```

### EditQuestModal Updates

**New Props**
```typescript
interface EditQuestModalProps {
  questId?: number;          // For editing existing quest
  initialQuestData?: Quest;  // For new quests (AI/Random)
  token: string;
  onSave?: () => void;
  onClose?: () => void;
}
```

**Template Conversion UI**
```typescript
// Only show if quest.quest_template_id === null
{!quest.quest_template_id && (
  <div className="template-section">
    <label>
      <input
        type="checkbox"
        checked={saveAsTemplate}
        onChange={e => setSaveAsTemplate(e.target.checked)}
      />
      Save as reusable template
    </label>

    {saveAsTemplate && (
      <RecurrenceScheduleSection
        recurrence={recurrence}
        onRecurrenceChange={setRecurrence}
        // ... schedule fields
      />
    )}
  </div>
)}
```

**Save Logic**
```typescript
handleSave():
  // 1. Update quest fields
  await api.quests.update(questId, {
    display_name: displayName,
    description: description,
    tags: tags,
    xp_reward: calculatedXP,
    gold_reward: calculatedGold
  });

  // 2. If template checkbox checked
  if (saveAsTemplate) {
    await api.quests.convertToTemplate(questId, {
      recurrence: recurrence,
      schedule: schedule,
      due_in_hours: dueInHours
    });
  }

  onSave();
```

## Template Conversion Mechanics

### Backend Conversion Flow

```python
def convert_quest_to_template(
    quest_id: int,
    conversion_data: ConvertToTemplateRequest,
    user_id: int
) -> QuestTemplate:
    quest = get_quest(db, quest_id)

    # Validation
    if quest.quest_template_id is not None:
        raise HTTPException(400, "Quest already linked to template")

    # 1. Create template from quest snapshot
    template = QuestTemplate(
        home_id=quest.home_id,
        title=quest.title,
        display_name=quest.display_name,
        description=quest.description,
        tags=quest.tags,
        xp_reward=quest.xp_reward,
        gold_reward=quest.gold_reward,
        quest_type=quest.quest_type,
        recurrence=conversion_data.recurrence,
        schedule=conversion_data.schedule,
        due_in_hours=conversion_data.due_in_hours,
        created_by=quest.user_id  # Quest creator owns template
    )
    db.add(template)
    db.commit()

    # 2. Link quest to template
    quest.quest_template_id = template.id
    quest.recurrence = conversion_data.recurrence
    quest.schedule = conversion_data.schedule
    db.commit()

    # 3. Auto-subscribe user if recurring
    if conversion_data.recurrence != "one-off":
        subscription = UserTemplateSubscription(
            user_id=quest.user_id,
            quest_template_id=template.id,
            recurrence=conversion_data.recurrence,
            schedule=conversion_data.schedule,
            due_in_hours=conversion_data.due_in_hours
        )
        db.add(subscription)
        db.commit()

    return template
```

### New Schema
```python
class ConvertToTemplateRequest(SQLModel):
    recurrence: str  # "one-off", "daily", "weekly", "monthly"
    schedule: Optional[str] = None  # JSON string
    due_in_hours: Optional[int] = Field(default=None, ge=1, le=8760)
```

## Data Model

### Quest Model (No Changes!)
```python
class Quest(SQLModel, table=True):
    id: Optional[int]
    home_id: int
    user_id: int
    quest_template_id: Optional[int]  # NULL = standalone, ID = templated

    # Snapshot fields (already exist from Phase 1-3)
    title: str
    display_name: Optional[str]
    description: Optional[str]
    tags: Optional[str]
    xp_reward: int
    gold_reward: int
    recurrence: str  # Snapshot of schedule context
    schedule: Optional[str]  # Snapshot of schedule

    # Status fields
    completed: bool
    quest_type: str
    due_date: Optional[datetime]
    corrupted_at: Optional[datetime]
```

**Key insight:** Quest model already has everything needed! Phase 1-3 gave us the snapshot pattern.

### No Model Changes Required
- QuestTemplate: Unchanged
- UserTemplateSubscription: Unchanged (Phase 3)
- Quest: Already has all snapshot fields

## Error Handling & Edge Cases

### Converting Already-Templated Quest
```python
if quest.quest_template_id is not None:
    raise HTTPException(400, "Quest is already linked to a template")
```
- Frontend prevents this (checkbox hidden for templated quests)
- Backend validates as safety check

### AI Generation Failures
```python
try:
    generate_quest_content(quest_id, title)
except GroqAPIError:
    # Quest already created with user's title
    # AI fields (display_name, description) remain empty
    # User can still edit manually in EditQuestModal
```
- Graceful degradation: quest exists even if AI fails
- User sees empty display_name/description, can fill manually

### Orphaned Templates
```
User converts quest → template created → User deletes quest

Result: Template remains, can still be used by household
Behavior: Intended (template is now shared resource)
```

### Duplicate Templates
```
User A: "Clean kitchen" → converts to template
User B: "Clean kitchen" → converts to template

Result: Two separate templates (no deduplication)
Behavior: Intended (users may have different schedules/preferences)
```

## Implementation Plan

### Phase 1: Backend AI Refactor
1. Modify AI service to accept `quest_id` instead of `template_id`
2. Update AI background task to update Quest fields
3. Test AI generation on standalone quests
4. Verify existing template-based AI still works (backward compat)

### Phase 2: Backend Conversion Endpoint
1. Create `POST /api/quests/{quest_id}/convert-to-template`
2. Implement conversion logic (template creation, linking, subscription)
3. Add validation (prevent re-conversion)
4. Write unit tests for conversion

### Phase 3: Frontend AI Scribe/Random Updates
1. Change AI Scribe to call standalone quest creation API
2. Change Random to call standalone quest creation API
3. Update EditQuestModal to receive quest instead of template
4. Test both flows create standalone quests correctly

### Phase 4: Frontend Template Conversion UI
1. Add checkbox "Save as reusable template" to EditQuestModal
2. Add recurrence/schedule fields (conditional on checkbox)
3. Call conversion API on save if checked
4. Test conversion flow end-to-end

### Phase 5: UI State Management
1. Implement adaptive EditQuestModal states (standalone vs templated)
2. Hide checkbox for templated quests
3. Show template info badge for templated quests
4. Test all three UI states

## Testing Strategy

### Unit Tests
- AI service with quest_id parameter
- Convert-to-template endpoint logic
- Subscription auto-creation on conversion
- Validation: prevent re-conversion

### Integration Tests
- AI Scribe → standalone quest → convert to template
- Random → standalone quest → convert to template
- From Template → quest remains linked, no conversion option
- AI failure → quest still created with manual fields

### Manual Testing
- Complete user journey for each creation flow
- Verify template list only shows intentional templates
- Verify recurring quests auto-generate from subscriptions
- Test EditQuestModal shows correct UI state for each quest type

## Success Criteria

✅ AI Scribe creates standalone quests (not templates)
✅ Random creates standalone quests (not templates)
✅ Template list only contains intentionally reusable quests
✅ Users can convert any standalone quest to template via EditQuestModal
✅ Converted quests link to template (quest_template_id set)
✅ Recurring template conversions auto-subscribe creating user
✅ EditQuestModal shows appropriate UI for standalone vs templated quests
✅ AI generation works on standalone quests
✅ No breaking changes to existing "From Template" workflow

## Benefits

1. **Cleaner Template List**: Only intentionally reusable quests
2. **Clearer Mental Model**: Quest = one-time, Template = reusable
3. **Less Database Pollution**: No unnecessary template records
4. **Better UX**: "Make template when needed" vs "always template"
5. **Intentional Reusability**: Template creation becomes a conscious choice
6. **Backward Compatible**: Existing templates and "From Template" flow unchanged
