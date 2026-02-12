# Quest-First, Template-Optional Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor quest creation to default to standalone quests, with optional template conversion

**Architecture:** Modify AI service to work with quest IDs, add conversion endpoint, update frontend to create standalone quests with optional template upgrade checkbox

**Tech Stack:** Python/FastAPI, TypeScript/React, SQLModel, pytest

---

## Task 1: Add ConvertToTemplateRequest Schema

**Files:**
- Modify: `backend/app/models/quest.py` (add to end of file, before final newline)

**Step 1: Write schema model**

Add after `UserTemplateSubscriptionUpdate` class:

```python
class ConvertToTemplateRequest(SQLModel):
    """Schema for converting standalone quest to template"""

    recurrence: str = Field(default="one-off")  # "one-off", "daily", "weekly", "monthly"
    schedule: Optional[str] = None  # JSON string with schedule details
    due_in_hours: Optional[int] = Field(default=None, ge=1, le=8760)
```

**Step 2: Update imports in quest.py if needed**

Verify `Field` is imported at top of file:
```python
from sqlmodel import Field, Relationship, SQLModel, UniqueConstraint
```

**Step 3: Commit**

```bash
git add backend/app/models/quest.py
git commit -m "feat: add ConvertToTemplateRequest schema"
```

---

## Task 2: Refactor AI Service to Work with Quest IDs

**Files:**
- Modify: `backend/app/services/scribe.py:51-100`
- Modify: `backend/app/routes/quest.py:438-478`

**Step 1: Update AI background function signature**

In `backend/app/routes/quest.py`, change `_generate_and_update_quest_template`:

```python
def _generate_and_update_quest(quest_id: int, quest_title: str):
    """Background task to generate quest content and update quest"""
    import time

    time.sleep(0.5)  # Small delay to ensure quest is committed

    try:
        from sqlmodel import Session

        from app.database import engine
        from app.crud import quest as crud_quest

        # Generate content using Groq
        scribe_response = generate_quest_content(quest_title)
        if not scribe_response:
            return  # Silently fail if Groq unavailable

        # Update quest with generated content
        with Session(engine) as db:
            quest = crud_quest.get_quest(db, quest_id)
            if not quest:
                return

            # Only update if fields are empty (don't override user input)
            if not quest.display_name:
                quest.display_name = scribe_response.display_name
            if not quest.description:
                quest.description = scribe_response.description
            if not quest.tags:
                quest.tags = scribe_response.tags

            # Always update rewards based on calculated values
            quest.xp_reward = scribe_response.calculate_xp()
            quest.gold_reward = scribe_response.calculate_gold()

            db.add(quest)
            db.commit()
    except Exception as e:
        import logging

        logging.error(f"Error in scribe background task: {e}")
```

**Step 2: Keep old function for backward compatibility**

Rename old function to `_generate_and_update_quest_template_legacy` (keep it for now, we'll remove after migration).

**Step 3: Test AI function manually**

Create test file `backend/test_ai_manual.py`:

```python
from app.services.scribe import generate_quest_content

response = generate_quest_content("Clean kitchen")
if response:
    print(f"Display name: {response.display_name}")
    print(f"Description: {response.description}")
    print(f"XP: {response.calculate_xp()}")
else:
    print("AI generation failed (check GROQ_API_KEY)")
```

Run: `cd backend && python test_ai_manual.py`
Expected: Either displays AI response OR "AI generation failed" message

**Step 4: Commit**

```bash
git add backend/app/routes/quest.py
git commit -m "refactor: add AI generation for quests (not just templates)"
```

---

## Task 3: Add Convert-to-Template Endpoint

**Files:**
- Modify: `backend/app/routes/quest.py` (add new endpoint after delete_quest_template)

**Step 1: Write test for convert endpoint**

Create `backend/tests/test_quest_conversion.py`:

```python
import json
from fastapi.testclient import TestClient
from sqlmodel import Session

def test_convert_standalone_quest_to_template(client: TestClient, db_home_with_users):
    """Test converting a standalone quest to a template"""
    home, user, _user2 = db_home_with_users

    # Create standalone quest
    quest_response = client.post(
        f"/api/quests/standalone?user_id={user.id}",
        json={
            "title": "Clean kitchen",
            "display_name": "The Kitchen Cleanse",
            "description": "Vanquish the grime",
            "tags": "chores,cleaning",
            "xp_reward": 30,
            "gold_reward": 15
        }
    )
    assert quest_response.status_code == 200
    quest = quest_response.json()
    assert quest["quest_template_id"] is None

    # Convert to template with weekly schedule
    convert_response = client.post(
        f"/api/quests/{quest['id']}/convert-to-template",
        json={
            "recurrence": "weekly",
            "schedule": json.dumps({"type": "weekly", "day": "monday", "time": "08:00"}),
            "due_in_hours": 24
        }
    )
    assert convert_response.status_code == 200
    template = convert_response.json()

    # Verify template created
    assert template["title"] == "Clean kitchen"
    assert template["display_name"] == "The Kitchen Cleanse"
    assert template["recurrence"] == "weekly"

    # Verify quest now linked to template
    quest_check = client.get(f"/api/quests/{quest['id']}")
    assert quest_check.status_code == 200
    updated_quest = quest_check.json()
    assert updated_quest["quest_template_id"] == template["id"]

    # Verify subscription created for user
    subs_response = client.get("/api/subscriptions")
    assert subs_response.status_code == 200
    subscriptions = subs_response.json()
    user_sub = next((s for s in subscriptions if s["quest_template_id"] == template["id"]), None)
    assert user_sub is not None
    assert user_sub["recurrence"] == "weekly"


def test_convert_already_templated_quest_fails(client: TestClient, db_home_with_users):
    """Test that converting an already-templated quest fails"""
    home, user, _user2 = db_home_with_users

    # Create template
    template_response = client.post(
        f"/api/quests/templates?created_by={user.id}",
        json={"title": "Clean kitchen"}
    )
    assert template_response.status_code == 200
    template = template_response.json()

    # Create quest from template
    quest_response = client.post(
        f"/api/quests?user_id={user.id}",
        json={"quest_template_id": template["id"]}
    )
    assert quest_response.status_code == 200
    quest = quest_response.json()

    # Try to convert (should fail)
    convert_response = client.post(
        f"/api/quests/{quest['id']}/convert-to-template",
        json={"recurrence": "daily"}
    )
    assert convert_response.status_code == 400
    assert "already linked" in convert_response.json()["detail"].lower()
```

**Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_quest_conversion.py -v`
Expected: FAIL - endpoint doesn't exist yet

**Step 3: Implement convert endpoint**

Add to `backend/app/routes/quest.py` after `delete_quest_template`:

```python
@router.post("/quests/{quest_id}/convert-to-template", response_model=QuestTemplateRead)
def convert_quest_to_template(
    quest_id: int,
    conversion_data: ConvertToTemplateRequest,
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
):
    """
    Convert a standalone quest to a reusable template.

    Creates a template from the quest's snapshot data,
    links the quest to the template, and auto-subscribes
    the user if the template is recurring.
    """
    home_id = auth["home_id"]
    user_id = auth["user_id"]

    # Get quest
    quest = crud_quest.get_quest(db, quest_id)
    if not quest or quest.home_id != home_id:
        raise HTTPException(status_code=404, detail="Quest not found")

    # Validate quest is standalone
    if quest.quest_template_id is not None:
        raise HTTPException(
            status_code=400,
            detail="Quest is already linked to a template"
        )

    # Validate schedule configuration
    _validate_quest_schedule(conversion_data.recurrence, conversion_data.schedule)

    # Create template from quest snapshot
    template_data = QuestTemplateCreate(
        title=quest.title,
        display_name=quest.display_name,
        description=quest.description,
        tags=quest.tags,
        xp_reward=quest.xp_reward,
        gold_reward=quest.gold_reward,
        quest_type=quest.quest_type,
        recurrence=conversion_data.recurrence,
        schedule=conversion_data.schedule,
        due_in_hours=conversion_data.due_in_hours
    )
    template = crud_quest_template.create_quest_template(
        db, home_id, quest.user_id, template_data
    )

    # Link quest to template
    quest.quest_template_id = template.id
    quest.recurrence = conversion_data.recurrence
    quest.schedule = conversion_data.schedule
    db.add(quest)
    db.commit()
    db.refresh(quest)

    # Auto-subscribe user if recurring
    if conversion_data.recurrence != "one-off":
        from app.crud import subscription as crud_subscription
        from app.models.quest import UserTemplateSubscriptionCreate

        subscription_data = UserTemplateSubscriptionCreate(
            quest_template_id=template.id,
            recurrence=conversion_data.recurrence,
            schedule=conversion_data.schedule,
            due_in_hours=conversion_data.due_in_hours
        )
        crud_subscription.create_subscription(db, user_id, subscription_data)

    return template
```

**Step 4: Add import at top of quest.py**

```python
from app.models.quest import (
    Quest,
    QuestCreate,
    QuestCreateStandalone,
    QuestRead,
    QuestTemplate,
    QuestTemplateCreate,
    QuestTemplateRead,
    QuestTemplateUpdate,
    QuestUpdate,
    ConvertToTemplateRequest,  # Add this
)
```

**Step 5: Run test to verify it passes**

Run: `pytest backend/tests/test_quest_conversion.py -v`
Expected: PASS (both tests)

**Step 6: Commit**

```bash
git add backend/app/routes/quest.py backend/tests/test_quest_conversion.py
git commit -m "feat: add endpoint to convert quest to template"
```

---

## Task 4: Add AI Scribe Standalone Quest Creation

**Files:**
- Modify: `backend/app/routes/quest.py` (add new endpoint)

**Step 1: Write test for AI Scribe endpoint**

Add to `backend/tests/test_quests.py`:

```python
def test_create_ai_scribe_quest(client: TestClient, db_home_with_users):
    """Test creating standalone quest via AI Scribe"""
    home, user, _user2 = db_home_with_users

    response = client.post(
        f"/api/quests/ai-scribe?user_id={user.id}&skip_ai=true",
        json={
            "title": "Clean kitchen",
            "tags": "chores,cleaning",
            "xp_reward": 25,
            "gold_reward": 15
        }
    )

    assert response.status_code == 200
    quest = response.json()
    assert quest["title"] == "Clean kitchen"
    assert quest["tags"] == "chores,cleaning"
    assert quest["quest_template_id"] is None  # Standalone
    assert quest["completed"] is False
```

**Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_quests.py::test_create_ai_scribe_quest -v`
Expected: FAIL - endpoint doesn't exist

**Step 3: Implement AI Scribe endpoint**

Add to `backend/app/routes/quest.py` after `create_standalone_quest`:

```python
@router.post("/ai-scribe", response_model=QuestRead)
def create_ai_scribe_quest(
    user_id: int = Query(...),
    skip_ai: bool = Query(False),
    quest_data: QuestCreateStandalone = None,
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Create a standalone quest with optional AI-generated content.

    - **user_id**: User ID to assign quest to
    - **skip_ai**: Set to true to skip AI generation (default: false)
    - **quest_data**: Quest data (title required, other fields optional)

    If skip_ai=false and GROQ_API_KEY is set, AI will generate
    display_name, description, and tags in the background.
    """
    home_id = auth["home_id"]

    # Verify user exists in home
    user = crud_user.get_user(db, user_id)
    if not user or user.home_id != home_id:
        raise HTTPException(status_code=404, detail="User not found in home")

    # Create standalone quest
    quest = crud_quest.create_standalone_quest(db, home_id, user_id, quest_data)

    # Trigger AI generation in background (unless skipping)
    if not skip_ai:
        background_tasks.add_task(
            _generate_and_update_quest,
            quest_id=quest.id,
            quest_title=quest.title,
        )

    return quest
```

**Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_quests.py::test_create_ai_scribe_quest -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/routes/quest.py backend/tests/test_quests.py
git commit -m "feat: add AI Scribe endpoint for standalone quests"
```

---

## Task 5: Add Random Quest Endpoint

**Files:**
- Modify: `backend/app/routes/quest.py` (add new endpoint)

**Step 1: Write test for random quest endpoint**

Add to `backend/tests/test_quests.py`:

```python
def test_create_random_quest(client: TestClient, db_home_with_users):
    """Test creating random quest with sample data"""
    home, user, _user2 = db_home_with_users

    response = client.post(f"/api/quests/random?user_id={user.id}")

    assert response.status_code == 200
    quest = response.json()
    assert quest["title"] is not None
    assert quest["display_name"] is not None
    assert quest["quest_template_id"] is None  # Standalone
    assert quest["xp_reward"] > 0
```

**Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_quests.py::test_create_random_quest -v`
Expected: FAIL - endpoint doesn't exist

**Step 3: Check sample quests data**

Look at `frontend/src/constants/sampleQuests.ts` for sample data structure. We'll replicate this in Python.

**Step 4: Implement random quest endpoint**

Add to `backend/app/routes/quest.py` after `create_ai_scribe_quest`:

```python
@router.post("/random", response_model=QuestRead)
def create_random_quest(
    user_id: int = Query(...),
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
):
    """
    Create a standalone quest with random sample data.

    Useful for testing and demo purposes.
    """
    import random

    home_id = auth["home_id"]

    # Verify user exists in home
    user = crud_user.get_user(db, user_id)
    if not user or user.home_id != home_id:
        raise HTTPException(status_code=404, detail="User not found in home")

    # Sample quest data
    samples = [
        {
            "title": "Clean kitchen",
            "display_name": "The Kitchen Cleanse",
            "description": "Vanquish the grimy counters and slay the sink dragon.",
            "tags": "chores,cleaning",
            "time": 3,
            "effort": 2,
            "dread": 4,
        },
        {
            "title": "Do laundry",
            "display_name": "The Garb Guardian",
            "description": "Sort, wash, and fold the cloth of champions.",
            "tags": "chores",
            "time": 4,
            "effort": 2,
            "dread": 3,
        },
        {
            "title": "Exercise",
            "display_name": "The Body Forge",
            "description": "Forge your body in the crucible of effort.",
            "tags": "exercise,health",
            "time": 3,
            "effort": 4,
            "dread": 3,
        },
    ]

    sample = random.choice(samples)
    xp_reward = (sample["time"] + sample["effort"] + sample["dread"]) * 2
    gold_reward = xp_reward // 2

    quest_data = QuestCreateStandalone(
        title=sample["title"],
        display_name=sample["display_name"],
        description=sample["description"],
        tags=sample["tags"],
        xp_reward=xp_reward,
        gold_reward=gold_reward,
    )

    quest = crud_quest.create_standalone_quest(db, home_id, user_id, quest_data)
    return quest
```

**Step 5: Run test to verify it passes**

Run: `pytest backend/tests/test_quests.py::test_create_random_quest -v`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/app/routes/quest.py backend/tests/test_quests.py
git commit -m "feat: add random quest endpoint with sample data"
```

---

## Task 6: Frontend - Add Conversion API Methods

**Files:**
- Modify: `frontend/src/types/api.ts` (add type)
- Modify: `frontend/src/services/api.ts` (add methods)

**Step 1: Add ConvertToTemplateRequest type**

Add to `frontend/src/types/api.ts` after `UserTemplateSubscriptionUpdate`:

```typescript
export interface ConvertToTemplateRequest {
  recurrence: string;
  schedule?: string | null;
  due_in_hours?: number | null;
}
```

**Step 2: Add API methods**

Add to `frontend/src/services/api.ts` in the `quests` section, after `deleteTemplate`:

```typescript
    createAIScribe: async (
      questData: {
        title: string;
        tags?: string;
        xp_reward?: number;
        gold_reward?: number;
      },
      token: string,
      userId: number,
      skipAI: boolean = false
    ): Promise<Quest> => {
      const res = await fetch(
        `${API_URL}/quests/ai-scribe?user_id=${userId}&skip_ai=${skipAI}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(questData),
        }
      );
      if (!res.ok) throw new Error("Failed to create AI Scribe quest");
      return res.json();
    },

    createRandom: async (token: string, userId: number): Promise<Quest> => {
      const res = await fetch(`${API_URL}/quests/random?user_id=${userId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to create random quest");
      return res.json();
    },

    convertToTemplate: async (
      questId: number,
      conversionData: ConvertToTemplateRequest,
      token: string
    ): Promise<QuestTemplate> => {
      const res = await fetch(
        `${API_URL}/quests/${questId}/convert-to-template`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(conversionData),
        }
      );
      if (!res.ok) throw new Error("Failed to convert quest to template");
      return res.json();
    },
```

**Step 3: Update imports**

Add to imports at top of `frontend/src/services/api.ts`:

```typescript
import type {
  // ... existing imports
  ConvertToTemplateRequest,
} from "../types/api";
```

**Step 4: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/services/api.ts
git commit -m "feat: add frontend API methods for quest conversion"
```

---

## Task 7: Frontend - Refactor CreateQuestForm AI Scribe

**Files:**
- Modify: `frontend/src/components/CreateQuestForm.tsx` (handleSubmit function)

**Step 1: Backup current AI Scribe flow**

Read current `handleSubmit` in CreateQuestForm.tsx to understand structure.

**Step 2: Replace AI Scribe flow to use standalone quest API**

Find `handleSubmit` function and replace the quest creation logic:

```typescript
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    const userId = parseInt(localStorage.getItem("userId") || "");
    if (!userId) {
      setError("User ID not found in session");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create standalone quest (AI generates content in background)
      const quest = await api.quests.createAIScribe(
        {
          title: title.trim(),
          ...(selectedTags.length > 0 && { tags: selectedTags.join(",") }),
          xp_reward: 25,
          gold_reward: 15,
        },
        token,
        userId,
        skipAI
      );

      // Open EditQuestModal with quest
      setEditingQuestId(quest.id);
      setShowEditModal(true);

      // Reset form
      setTitle("");
      setSelectedTags([]);
      setDueDate("");
      setSkipAI(false);
      setRecurrence("one-off");
      setScheduleTime("08:00");
      setScheduleDay("monday");
      setScheduleDayOfMonth(1);
      setDueInHours("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quest");
    } finally {
      setLoading(false);
    }
  };
```

**Step 3: Update state management**

Add state variable at top of CreateQuestForm:
```typescript
const [editingQuestId, setEditingQuestId] = useState<number | null>(null);
```

Remove unused state:
```typescript
// Remove these if they exist:
// const [createdTemplateId, setCreatedTemplateId] = useState<number | null>(null);
// const [templateInitialData, setTemplateInitialData] = useState<any>(null);
// const [showCreateMode, setShowCreateMode] = useState(false);
```

**Step 4: Commit**

```bash
git add frontend/src/components/CreateQuestForm.tsx
git commit -m "refactor: AI Scribe creates standalone quests"
```

---

## Task 8: Frontend - Refactor CreateQuestForm Random

**Files:**
- Modify: `frontend/src/components/CreateQuestForm.tsx` (handleRandomQuest function)

**Step 1: Replace Random flow**

Find `handleRandomQuest` function and replace:

```typescript
  const handleRandomQuest = async () => {
    const userId = parseInt(localStorage.getItem("userId") || "");
    if (!userId) {
      setError("User ID not found in session");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create standalone quest with random sample data
      const quest = await api.quests.createRandom(token, userId);

      // Open EditQuestModal with quest
      setEditingQuestId(quest.id);
      setShowEditModal(true);
      setSkipAI(true);  // AI already populated by backend
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quest");
    } finally {
      setLoading(false);
    }
  };
```

**Step 2: Commit**

```bash
git add frontend/src/components/CreateQuestForm.tsx
git commit -m "refactor: Random creates standalone quests"
```

---

## Task 9: Frontend - Refactor EditQuestModal Props

**Files:**
- Modify: `frontend/src/components/EditQuestModal.tsx` (interface and useEffect)

**Step 1: Simplify EditQuestModal props**

Update interface at top of EditQuestModal:

```typescript
interface EditQuestModalProps {
  // Edit existing quest (fetch by ID)
  questId?: number;

  token: string;
  skipAI: boolean;
  onSave?: () => void;
  onClose?: () => void;
}
```

Remove obsolete props:
- `templateId`
- `initialData`
- `createQuestOnSave`

**Step 2: Update component signature**

```typescript
export default function EditQuestModal({
  questId,
  token,
  skipAI,
  onSave,
  onClose,
}: EditQuestModalProps) {
```

**Step 3: Simplify useEffect to only fetch quest**

Replace the complex conditional loading with simple quest fetch:

```typescript
  useEffect(() => {
    const loadQuest = async () => {
      if (!questId) {
        setError("No quest ID provided");
        setLoading(false);
        return;
      }

      try {
        // Wait for AI if not skipping (gives AI time to populate)
        if (!skipAI) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

        // Fetch quest
        const response = await api.quests.getQuest(questId, token);

        // Set form values from quest snapshot
        setDisplayName(response.display_name || "");
        setDescription(response.description || "");

        // Parse tags
        if (response.tags) {
          const tags = response.tags.split(",").map(t => {
            const trimmed = t.trim();
            return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
          });
          setSelectedTags(tags);
        }

        // Set recurrence/schedule from quest snapshot
        setRecurrence(response.recurrence as "one-off" | "daily" | "weekly" | "monthly");
        setOriginalRecurrence(response.recurrence as "one-off" | "daily" | "weekly" | "monthly");

        if (response.schedule) {
          try {
            const schedule = JSON.parse(response.schedule);
            if (schedule.time) setScheduleTime(schedule.time);
            if (schedule.day && typeof schedule.day === "string") setScheduleDay(schedule.day);
            if (schedule.day && typeof schedule.day === "number")
              setScheduleDayOfMonth(schedule.day);
          } catch (err) {
            console.error("Failed to parse schedule:", err);
          }
        }

        // Store quest for UI state decisions
        setQuest(response);
        setLoading(false);

        // Show typewriter animation if there's AI content
        if (response.display_name || response.description) {
          setShowTypeWriter(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load quest");
        setLoading(false);
      }
    };

    loadQuest();
  }, [questId, token, skipAI]);
```

**Step 4: Add quest state and getQuest API method**

Add state:
```typescript
const [quest, setQuest] = useState<Quest | null>(null);
```

Add to `frontend/src/services/api.ts` in quests section:

```typescript
    getQuest: async (questId: number, token: string): Promise<Quest> => {
      const res = await fetch(`${API_URL}/quests/${questId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch quest");
      return res.json();
    },
```

**Step 5: Commit**

```bash
git add frontend/src/components/EditQuestModal.tsx frontend/src/services/api.ts
git commit -m "refactor: simplify EditQuestModal to work with quest IDs"
```

---

## Task 10: Frontend - Add Template Conversion UI

**Files:**
- Modify: `frontend/src/components/EditQuestModal.tsx` (add checkbox and conversion logic)

**Step 1: Add conversion state**

Add state variables after existing state declarations:

```typescript
const [saveAsTemplate, setSaveAsTemplate] = useState(false);
```

**Step 2: Add UI for standalone quests**

Add this section in the form, after the Tags section and before existing Recurrence section:

```typescript
{/* Template Conversion (only for standalone quests) */}
{quest && quest.quest_template_id === null && (
  <div className="mb-6">
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={saveAsTemplate}
        onChange={e => setSaveAsTemplate(e.target.checked)}
        className="w-4 h-4"
        style={{ accentColor: COLORS.gold }}
        disabled={saving}
      />
      <span
        className="text-sm uppercase tracking-wider font-serif"
        style={{ color: COLORS.gold }}
      >
        Save as reusable template
      </span>
    </label>
    {saveAsTemplate && (
      <p className="text-xs mt-1 font-serif italic" style={{ color: COLORS.parchment }}>
        Template can be reused and scheduled for recurring quests
      </p>
    )}
  </div>
)}
```

**Step 3: Show recurrence only when checkbox checked**

Wrap the existing Recurrence Configuration section with conditional:

```typescript
{/* Recurrence Configuration - only show if saving as template */}
{saveAsTemplate && (
  <div className="mb-6">
    <label
      className="block text-sm uppercase tracking-wider mb-2 font-serif"
      style={{ color: COLORS.gold }}
    >
      Recurrence
    </label>
    {/* ... existing recurrence UI ... */}
  </div>
)}
```

**Step 4: Add template info badge for templated quests**

Add before the form starts (after error display):

```typescript
{/* Template Info Badge (for templated quests) */}
{quest && quest.quest_template_id !== null && (
  <div
    className="mb-4 px-3 py-2 rounded text-sm font-serif"
    style={{
      backgroundColor: `rgba(212, 175, 55, 0.1)`,
      borderColor: COLORS.gold,
      borderWidth: "1px",
      color: COLORS.parchment,
    }}
  >
    📜 From template: {quest.template?.display_name || quest.template?.title || "Unknown"}
    <div className="text-xs mt-1 italic">
      Changes only affect this quest. To edit template/schedule, go to template management.
    </div>
  </div>
)}
```

**Step 5: Update save handler to call conversion**

Replace `handleSave` function:

```typescript
  const handleSave = useCallback(async () => {
    if (!quest) return;

    setSaving(true);
    setError(null);

    try {
      // Calculate XP/Gold based on sliders
      const baseXP = (time + effort + dread) * 2;
      const baseGold = Math.floor(baseXP / 2);

      // Build schedule JSON if converting to template
      let schedule: string | null = null;
      if (saveAsTemplate && recurrence !== "one-off") {
        if (recurrence === "daily") {
          schedule = JSON.stringify({ type: "daily", time: scheduleTime });
        } else if (recurrence === "weekly") {
          schedule = JSON.stringify({ type: "weekly", day: scheduleDay, time: scheduleTime });
        } else if (recurrence === "monthly") {
          schedule = JSON.stringify({
            type: "monthly",
            day: scheduleDayOfMonth,
            time: scheduleTime,
          });
        }
      }

      // Update quest fields (always happens)
      const updateData = {
        ...(displayName.trim() && { display_name: displayName.trim() }),
        ...(description.trim() && { description: description.trim() }),
        ...(selectedTags.length > 0 && { tags: selectedTags.join(",").toLowerCase() }),
        xp_reward: baseXP,
        gold_reward: baseGold,
      };

      await api.quests.update(quest.id, updateData, token);

      // Convert to template if checkbox checked
      if (saveAsTemplate && quest.quest_template_id === null) {
        await api.quests.convertToTemplate(
          quest.id,
          {
            recurrence: recurrence,
            schedule: schedule,
            due_in_hours: dueInHours ? parseInt(dueInHours) : null,
          },
          token
        );
      }

      onSave?.();
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save quest");
    } finally {
      setSaving(false);
    }
  }, [
    quest,
    time,
    effort,
    dread,
    displayName,
    description,
    selectedTags,
    saveAsTemplate,
    recurrence,
    scheduleTime,
    scheduleDay,
    scheduleDayOfMonth,
    dueInHours,
    token,
    onSave,
    onClose,
  ]);
```

**Step 6: Add quest.update API method**

Add to `frontend/src/services/api.ts` in quests section:

```typescript
    update: async (
      questId: number,
      questData: {
        display_name?: string;
        description?: string;
        tags?: string;
        xp_reward?: number;
        gold_reward?: number;
      },
      token: string
    ): Promise<Quest> => {
      const res = await fetch(`${API_URL}/quests/${questId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(questData),
      });
      if (!res.ok) throw new Error("Failed to update quest");
      return res.json();
    },
```

**Step 7: Commit**

```bash
git add frontend/src/components/EditQuestModal.tsx frontend/src/services/api.ts
git commit -m "feat: add template conversion checkbox to EditQuestModal"
```

---

## Task 11: Frontend - Update CreateQuestForm Modal Integration

**Files:**
- Modify: `frontend/src/components/CreateQuestForm.tsx` (EditQuestModal usage)

**Step 1: Update EditQuestModal instantiation**

Find the EditQuestModal component at the bottom of CreateQuestForm and replace:

```typescript
      {/* Edit Quest Modal */}
      {showEditModal && editingQuestId && (
        <EditQuestModal
          questId={editingQuestId}
          token={token}
          skipAI={skipAI}
          onSave={() => {
            setShowEditModal(false);
            setEditingQuestId(null);
            onQuestCreated();
            onClose();
          }}
          onClose={() => {
            setShowEditModal(false);
            setEditingQuestId(null);
            onClose();
          }}
        />
      )}
```

**Step 2: Remove template deletion logic**

Remove any cleanup/delete template logic in onClose (no longer needed since we're not creating templates upfront).

**Step 3: Commit**

```bash
git add frontend/src/components/CreateQuestForm.tsx
git commit -m "refactor: update CreateQuestForm to pass quest ID to EditQuestModal"
```

---

## Task 12: Integration Testing

**Files:**
- Create: `backend/tests/test_integration_quest_first.py`

**Step 1: Write end-to-end integration test**

Create `backend/tests/test_integration_quest_first.py`:

```python
import json
import time
from fastapi.testclient import TestClient

def test_ai_scribe_to_template_conversion_flow(client: TestClient, db_home_with_users):
    """Test complete AI Scribe → Edit → Convert to Template flow"""
    home, user, _user2 = db_home_with_users

    # Step 1: Create AI Scribe quest (standalone)
    quest_response = client.post(
        f"/api/quests/ai-scribe?user_id={user.id}&skip_ai=true",
        json={
            "title": "Clean kitchen",
            "tags": "chores,cleaning",
            "xp_reward": 25,
            "gold_reward": 15,
        }
    )
    assert quest_response.status_code == 200
    quest = quest_response.json()
    assert quest["quest_template_id"] is None
    quest_id = quest["id"]

    # Step 2: Update quest (simulate user edits in EditQuestModal)
    update_response = client.put(
        f"/api/quests/{quest_id}",
        json={
            "display_name": "The Kitchen Cleanse",
            "description": "Vanquish the grimy counters",
            "xp_reward": 30,
        }
    )
    assert update_response.status_code == 200

    # Step 3: Convert to template with weekly schedule
    convert_response = client.post(
        f"/api/quests/{quest_id}/convert-to-template",
        json={
            "recurrence": "weekly",
            "schedule": json.dumps({"type": "weekly", "day": "monday", "time": "08:00"}),
            "due_in_hours": 24,
        }
    )
    assert convert_response.status_code == 200
    template = convert_response.json()

    # Verify template has user's edits
    assert template["display_name"] == "The Kitchen Cleanse"
    assert template["xp_reward"] == 30
    assert template["recurrence"] == "weekly"

    # Verify quest is now linked
    quest_check = client.get(f"/api/quests/{quest_id}")
    assert quest_check.json()["quest_template_id"] == template["id"]

    # Verify subscription created
    subs_response = client.get("/api/subscriptions")
    subscriptions = subs_response.json()
    assert any(s["quest_template_id"] == template["id"] for s in subscriptions)


def test_random_quest_stays_standalone(client: TestClient, db_home_with_users):
    """Test random quest remains standalone if not converted"""
    home, user, _user2 = db_home_with_users

    # Create random quest
    quest_response = client.post(f"/api/quests/random?user_id={user.id}")
    assert quest_response.status_code == 200
    quest = quest_response.json()

    # Verify standalone
    assert quest["quest_template_id"] is None

    # Update quest (simulate edit without conversion)
    update_response = client.put(
        f"/api/quests/{quest['id']}",
        json={"xp_reward": 50}
    )
    assert update_response.status_code == 200

    # Verify still standalone
    quest_check = client.get(f"/api/quests/{quest['id']}")
    assert quest_check.json()["quest_template_id"] is None


def test_template_list_not_cluttered(client: TestClient, db_home_with_users):
    """Test that template list only shows converted templates"""
    home, user, _user2 = db_home_with_users

    # Create 3 standalone quests
    for i in range(3):
        client.post(
            f"/api/quests/ai-scribe?user_id={user.id}&skip_ai=true",
            json={"title": f"Quest {i}"}
        )

    # Check template list is empty
    templates_response = client.get("/api/quests/templates/all")
    assert templates_response.status_code == 200
    templates = templates_response.json()
    assert len(templates) == 0

    # Convert one quest to template
    quest_response = client.post(
        f"/api/quests/ai-scribe?user_id={user.id}&skip_ai=true",
        json={"title": "Convert me"}
    )
    quest_id = quest_response.json()["id"]

    client.post(
        f"/api/quests/{quest_id}/convert-to-template",
        json={"recurrence": "daily"}
    )

    # Now template list has 1 entry
    templates_response = client.get("/api/quests/templates/all")
    templates = templates_response.json()
    assert len(templates) == 1
    assert templates[0]["title"] == "Convert me"
```

**Step 2: Run integration tests**

Run: `pytest backend/tests/test_integration_quest_first.py -v`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add backend/tests/test_integration_quest_first.py
git commit -m "test: add integration tests for quest-first flow"
```

---

## Task 13: Manual Testing & Documentation

**Files:**
- Create: `docs/testing/quest-first-manual-tests.md`

**Step 1: Write manual test checklist**

Create `docs/testing/quest-first-manual-tests.md`:

```markdown
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
```

**Step 2: Perform manual testing**

Follow checklist and verify all tests pass.

**Step 3: Commit**

```bash
git add docs/testing/quest-first-manual-tests.md
git commit -m "docs: add manual testing checklist"
```

---

## Task 14: Update Documentation

**Files:**
- Modify: `docs/plans/2026-01-30-quest-first-template-optional.md`

**Step 1: Mark design as implemented**

Change status line:
```markdown
**Status:** ✅ Implemented - 2026-01-30
```

**Step 2: Add implementation notes**

Add section at end:

```markdown
## Implementation Notes

**Completed:** 2026-01-30

**Changes from Design:**
- AI generation refactored to work with quest IDs (not just templates)
- Random quest endpoint uses Python list of samples (not separate file)
- EditQuestModal simplified to always work with quest IDs
- Template conversion is atomic (single API call)

**Testing:**
- Unit tests: ✅ All passing
- Integration tests: ✅ All passing
- Manual testing: ✅ Complete

**Migration:**
- No database migration needed (Quest model already has snapshot fields)
- No breaking changes to existing workflows
```

**Step 3: Commit**

```bash
git add docs/plans/2026-01-30-quest-first-template-optional.md
git commit -m "docs: mark quest-first design as implemented"
```

---

## Success Criteria Verification

Run all tests to verify implementation:

```bash
# Backend tests
cd backend
pytest tests/ -v

# Verify specific tests pass
pytest tests/test_quest_conversion.py -v
pytest tests/test_integration_quest_first.py -v

# Check all quest tests still pass
pytest tests/test_quests.py -v
pytest tests/test_subscriptions.py -v
pytest tests/test_recurring_quests.py -v
```

All tests should pass ✅

**Manual verification:**
- AI Scribe creates standalone quests ✅
- Random creates standalone quests ✅
- Template list only shows converted templates ✅
- Conversion checkbox works in EditQuestModal ✅
- Templated quests show info badge ✅
- "From Template" workflow unchanged ✅

---

**Implementation Complete! 🎉**

The quest-first, template-optional architecture is now live. Users can create quests freely and convert to templates only when they need recurring schedules.
