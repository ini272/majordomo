# Quest-First Manual Testing Checklist

## Prerequisites
- Fresh database: `rm backend/majordomo.db`
- Seed test data: `cd backend && uv run python seed_test_data.py`
- Backend running: `cd backend && uv run fastapi dev`
- Frontend running: `cd frontend && npm run dev`
- Login with: dragon slayer / dragon

## Test 1: AI Scribe Creates Standalone Quest
- [ ] Click "Create Quest"
- [ ] Select "AI Scribe" mode
- [ ] Enter title: "Clean kitchen"
- [ ] Add tag: "Chores"
- [ ] Click "Create Quest"
- [ ] EditQuestModal opens with AI-generated content
- [ ] Checkbox visible: "☐ Save as reusable template"
- [ ] Click "Save Quest" without checking box
- [ ] Quest appears on board
- [ ] Go to Templates list - should be EMPTY

## Test 2: Convert Quest to Template
- [ ] Find the "Clean kitchen" quest card
- [ ] Click edit button on quest card
- [ ] EditQuestModal opens
- [ ] Check "☐ Save as reusable template"
- [ ] Recurrence selector appears
- [ ] Select "Weekly"
- [ ] Choose "Monday" at "08:00"
- [ ] Click "Save Quest"
- [ ] Go to Templates list - should now show "Clean Kitchen" template
- [ ] Original quest card still visible on board

## Test 3: Random Quest Stays Standalone
- [ ] Click "Create Quest"
- [ ] Click "Random" button
- [ ] EditQuestModal opens with random quest
- [ ] Do NOT check template box
- [ ] Customize XP slider
- [ ] Click "Save Quest"
- [ ] Quest appears on board
- [ ] Templates list unchanged

## Test 4: From Template (Existing Flow)
- [ ] Go to Templates list
- [ ] Click "Review & Edit" on a template
- [ ] Customize schedule/name
- [ ] Click "Create Quest"
- [ ] Quest created with customizations
- [ ] Quest card shows template info badge

## Test 5: Templated Quest Cannot Be Re-Converted
- [ ] Find quest created from template (Test 4)
- [ ] Click edit button
- [ ] EditQuestModal opens
- [ ] Info badge shows: "From template: [name]"
- [ ] NO checkbox visible for "Save as template"
- [ ] Note displayed: "Changes only affect this quest"

## Test 6: Recurring Template Auto-Generates
- [ ] Wait for next scheduled time (or adjust system clock)
- [ ] Trigger generation: GET /api/quests/board
- [ ] New quest instance appears
- [ ] Subscription working correctly

## Expected Results
✅ AI Scribe creates standalone quests
✅ Random creates standalone quests
✅ Template list only shows converted templates
✅ Conversion checkbox works correctly
✅ Templated quests show info badge
✅ Recurring templates auto-generate via subscriptions
