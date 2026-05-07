from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlmodel import Session

from app.auth import get_current_user
from app.crud import quest as crud_quest
from app.crud import quest_template as crud_quest_template
from app.crud import user as crud_user
from app.database import get_db
from app.errors import ErrorCode, create_error_detail
from app.models.quest import (
    ConvertToTemplateRequest,
    Quest,
    QuestCreate,
    QuestCreateStandalone,
    QuestRead,
    QuestScribePreviewRead,
    QuestTemplateCreate,
    QuestTemplateRead,
    QuestTemplateUpdate,
    QuestUpdate,
)
from app.services.quest_completion import (
    complete_quest_with_rewards,
    corruption_multiplier,
    get_corrupted_quest_count,
    has_active_shield,
)
from app.services.recurring_quests import generate_due_quests
from app.services.scribe import ScribeResponse, generate_quest_content

router = APIRouter(prefix="/api/quests", tags=["quests"])


def _get_quest_reward_preview_context(db: Session, auth: dict) -> tuple[int, float]:
    user = crud_user.get_user(db, auth["user_id"])
    if not user or user.home_id != auth["home_id"]:
        raise HTTPException(
            status_code=404,
            detail=create_error_detail(ErrorCode.USER_NOT_FOUND, details={"user_id": auth["user_id"]}),
        )

    corrupted_quest_count = get_corrupted_quest_count(db, auth["home_id"])
    if has_active_shield(user):
        return corrupted_quest_count, 1.0

    return corrupted_quest_count, corruption_multiplier(corrupted_quest_count)


def _quest_to_read(quest: Quest, corrupted_quest_count: int, corruption_debuff: float) -> QuestRead:
    quest_read = QuestRead.model_validate(quest)

    if quest.completed:
        return quest_read

    quest_read.corrupted_quest_count = corrupted_quest_count
    quest_read.corruption_debuff = corruption_debuff
    quest_read.corruption_debuff_active = corrupted_quest_count > 0 and corruption_debuff < 1.0
    quest_read.effective_xp_reward = int(quest.xp_reward * corruption_debuff)
    quest_read.effective_gold_reward = int(quest.gold_reward * corruption_debuff)
    return quest_read


def _quests_to_read(quests: list[Quest], db: Session, auth: dict) -> list[QuestRead]:
    corrupted_quest_count, corruption_debuff = _get_quest_reward_preview_context(db, auth)
    return [_quest_to_read(quest, corrupted_quest_count, corruption_debuff) for quest in quests]


def _dedupe_user_ids(user_ids: list[int]) -> list[int]:
    """
    Preserve the caller's first-choice order while removing duplicates.

    The public API accepts raw arrays, so this guards direct clients from
    creating duplicate participant rows or duplicate reward awards.
    """
    seen: set[int] = set()
    deduped: list[int] = []
    for user_id in user_ids:
        if user_id in seen:
            continue
        seen.add(user_id)
        deduped.append(user_id)
    return deduped


def _resolve_participant_user_ids(
    db: Session,
    home_id: int,
    legacy_user_id: Optional[int],
    participant_user_ids: Optional[list[int]],
) -> list[int]:
    """
    Resolve participant IDs from the new request body field or legacy user_id query param.

    `participant_user_ids` is preferred. `user_id` remains accepted so older
    clients can still create single-participant quests during the transition.
    """
    resolved_user_ids = (
        participant_user_ids
        if participant_user_ids is not None
        else ([legacy_user_id] if legacy_user_id is not None else [])
    )
    resolved_user_ids = _dedupe_user_ids([user_id for user_id in resolved_user_ids if user_id is not None])

    if not resolved_user_ids:
        raise HTTPException(status_code=400, detail="Quest requires at least one participant")

    for participant_user_id in resolved_user_ids:
        user = crud_user.get_user(db, participant_user_id)
        if not user or user.home_id != home_id:
            raise HTTPException(status_code=404, detail="User not found in home")

    return resolved_user_ids


# GET endpoints
@router.get("/templates/all", response_model=list[QuestTemplateRead])
def get_all_quest_templates(db: Session = Depends(get_db), auth: dict = Depends(get_current_user)):
    """Get all quest templates in the authenticated user's home"""
    return crud_quest_template.get_home_quest_templates(db, auth["home_id"])


@router.get("", response_model=list[QuestRead])
def get_all_quests(db: Session = Depends(get_db), auth: dict = Depends(get_current_user)):
    """
    Get all quest instances in the authenticated user's home.

    Returns all active and completed quests for the household.
    Results are sorted by creation date (newest first).

    Automatically generates any due recurring quest instances and
    checks for overdue quests and marks them as corrupted.
    """
    # Generate any recurring quests that are due
    generate_due_quests(auth["home_id"], db)

    # Check and corrupt any overdue quests before returning the list
    crud_quest.check_and_corrupt_overdue_quests(db)

    quests = crud_quest.get_quests_by_home(db, auth["home_id"])
    return _quests_to_read(quests, db, auth)


@router.get("/{quest_id}", response_model=QuestRead)
def get_quest(quest_id: int, db: Session = Depends(get_db), auth: dict = Depends(get_current_user)):
    """Get quest by ID (only those in your home can access)"""
    crud_quest.check_and_corrupt_overdue_quests(db)

    quest = crud_quest.get_quest(db, quest_id)
    if not quest or quest.home_id != auth["home_id"]:
        raise HTTPException(
            status_code=404,
            detail=create_error_detail(ErrorCode.QUEST_NOT_FOUND, details={"quest_id": quest_id}),
        )

    corrupted_quest_count, corruption_debuff = _get_quest_reward_preview_context(db, auth)
    return _quest_to_read(quest, corrupted_quest_count, corruption_debuff)


@router.get("/user/{user_id}", response_model=list[QuestRead])
def get_user_quests(
    user_id: int,
    completed: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
):
    """Get all quests for a user, optionally filtered by completion status"""
    # Verify user exists in authenticated home
    user = crud_user.get_user(db, user_id)
    if not user or user.home_id != auth["home_id"]:
        raise HTTPException(
            status_code=404,
            detail=create_error_detail(ErrorCode.USER_NOT_FOUND, details={"user_id": user_id}),
        )

    crud_quest.check_and_corrupt_overdue_quests(db)
    quests = crud_quest.get_quests_by_user(db, auth["home_id"], user_id, completed)
    return _quests_to_read(quests, db, auth)


@router.get("/templates/{template_id}", response_model=QuestTemplateRead)
def get_quest_template(template_id: int, db: Session = Depends(get_db), auth: dict = Depends(get_current_user)):
    """Get quest template by ID"""
    template = crud_quest_template.get_quest_template(db, template_id)
    if not template or template.home_id != auth["home_id"]:
        raise HTTPException(
            status_code=404,
            detail=create_error_detail(ErrorCode.QUEST_TEMPLATE_NOT_FOUND, details={"template_id": template_id}),
        )

    return template


# POST endpoints
@router.post("", response_model=QuestRead)
def create_quest(
    quest: QuestCreate,
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
):
    """Create a new quest instance for one or more participants"""
    home_id = auth["home_id"]
    participant_user_ids = _resolve_participant_user_ids(db, home_id, user_id, quest.participant_user_ids)

    # Verify template exists in home
    template = crud_quest_template.get_quest_template(db, quest.quest_template_id)
    if not template or template.home_id != home_id:
        raise HTTPException(status_code=404, detail="Quest template not found in home")

    return crud_quest.create_quest(db, home_id, auth["user_id"], participant_user_ids, quest, template)


@router.post("/standalone", response_model=QuestRead)
def create_standalone_quest(
    quest: QuestCreateStandalone,
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
):
    """Create a standalone quest without a template"""
    home_id = auth["home_id"]
    participant_user_ids = _resolve_participant_user_ids(db, home_id, user_id, quest.participant_user_ids)

    return crud_quest.create_standalone_quest(db, home_id, auth["user_id"], participant_user_ids, quest)


@router.post("/ai-scribe", response_model=QuestRead)
def create_ai_scribe_quest(
    background_tasks: BackgroundTasks,
    user_id: Optional[int] = Query(None),
    skip_ai: bool = Query(False),
    quest_data: QuestCreateStandalone = None,
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
):
    """
    Create a standalone quest with optional AI-generated content.

    - **user_id**: Legacy single user ID to assign quest to
    - **skip_ai**: Set to true to skip AI generation (default: false)
    - **quest_data**: Quest data (title required, other fields optional)

    If skip_ai=false and GROQ_API_KEY is set, AI will generate
    display_name, description, and tags in the background.
    """
    home_id = auth["home_id"]
    if quest_data is None:
        raise HTTPException(status_code=400, detail="Quest data is required")

    participant_user_ids = _resolve_participant_user_ids(db, home_id, user_id, quest_data.participant_user_ids)

    # Create standalone quest
    quest = crud_quest.create_standalone_quest(db, home_id, auth["user_id"], participant_user_ids, quest_data)

    # Trigger AI generation in background (unless skipping)
    if not skip_ai:
        background_tasks.add_task(
            _generate_and_update_quest,
            quest_id=quest.id,
            quest_title=quest.title,
        )

    return quest


@router.post("/random", response_model=QuestRead)
def create_random_quest(
    user_id: Optional[int] = Query(None),
    participant_user_ids: Optional[list[int]] = Query(None),
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
):
    """
    Create a standalone quest with random sample data.

    Useful for testing and demo purposes.
    """
    import random

    home_id = auth["home_id"]
    resolved_participant_user_ids = _resolve_participant_user_ids(db, home_id, user_id, participant_user_ids)

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

    quest = crud_quest.create_standalone_quest(
        db, home_id, auth["user_id"], resolved_participant_user_ids, quest_data
    )
    return quest


@router.post("/templates/{template_id}/generate-instance", response_model=QuestRead)
def generate_quest_instance(
    template_id: int,
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
):
    """
    Manually generate a quest instance from this template.

    Creates a new quest instance for the requesting user immediately,
    bypassing the "skip if incomplete" check. Updates the template's
    last_generated_at timestamp to prevent duplicate auto-generation.

    Useful for:
    - Manual "Generate Now" button in UI
    - Creating extra instances on demand
    - Testing and debugging
    """
    template = crud_quest_template.get_quest_template(db, template_id)
    if not template or template.home_id != auth["home_id"]:
        raise HTTPException(
            status_code=404,
            detail=create_error_detail(
                ErrorCode.QUEST_TEMPLATE_NOT_FOUND,
                details={"template_id": template_id},
            ),
        )

    now = datetime.now(timezone.utc)

    # Create quest instance for requesting user only, snapshotting template data
    new_quest = Quest(
        home_id=auth["home_id"],
        created_by=auth["user_id"],
        user_id=auth["user_id"],
        quest_template_id=template.id,
        # Snapshot template data
        title=template.title,
        display_name=template.display_name,
        description=template.description,
        tags=template.tags,
        xp_reward=template.xp_reward,
        gold_reward=template.gold_reward,
        quest_type="standard",
        due_in_hours=template.due_in_hours,
        recurrence=template.recurrence,
        schedule=template.schedule,
    )
    db.add(new_quest)
    db.flush()
    crud_quest.replace_quest_participants(db, new_quest, [auth["user_id"]])

    # Update last_generated_at
    template.last_generated_at = now
    db.add(template)
    db.commit()
    db.refresh(new_quest)

    return QuestRead.model_validate(new_quest)


@router.post("/{quest_id}/complete")
def complete_quest(quest_id: int, db: Session = Depends(get_db), auth: dict = Depends(get_current_user)):
    """
    Complete a quest and award rewards to every participant.

    - **quest_id**: Quest instance ID to complete

    Automatically awards XP and gold from the quest template to each participant.

    **Reward Calculation Order**:
    1. Base rewards from template
    2. Apply corruption debuff (-20% while any corrupted quest exists in home)
    3. Apply bounty bonus (3x gold only if daily bounty; XP unchanged)
    4. Apply XP boost (2x if Heroic Elixir active)

    **Corruption System**: House-wide debuff applies when ANY quests are corrupted (overdue).
    Purification Shield suppresses this debuff for 24 hours.

    **Consumables**:
    - Heroic Elixir: 2x XP for next 3 completed quests
    - Purification Shield: Suppresses corruption debuff for 24 hours

    Returns quest details and reward breakdown including XP, gold, bounty status, and active effects.
    """
    quest = crud_quest.get_quest(db, quest_id)
    if not quest or quest.home_id != auth["home_id"]:
        raise HTTPException(
            status_code=404,
            detail=create_error_detail(ErrorCode.QUEST_NOT_FOUND, details={"quest_id": quest_id}),
        )

    return complete_quest_with_rewards(db, quest, auth)


@router.post("/{quest_id}/scribe-preview", response_model=QuestScribePreviewRead)
def regenerate_quest_scribe_preview(
    quest_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth: Annotated[dict, Depends(get_current_user)],
):
    """
    Generate fresh Scribe copy for an active quest without saving it.

    The edit modal applies this response to its local draft. Persistence still
    goes through the existing quest update endpoint.
    """
    quest = crud_quest.get_quest(db, quest_id)
    if not quest or quest.home_id != auth["home_id"]:
        raise HTTPException(
            status_code=404,
            detail=create_error_detail(ErrorCode.QUEST_NOT_FOUND, details={"quest_id": quest_id}),
        )

    if quest.completed:
        raise HTTPException(
            status_code=400,
            detail=create_error_detail(
                ErrorCode.QUEST_ALREADY_COMPLETED,
                message="Completed quests cannot regenerate Scribe copy",
                details={"quest_id": quest_id},
            ),
        )

    scribe_response = generate_quest_content(quest.title)
    if not scribe_response:
        raise HTTPException(
            status_code=503,
            detail=create_error_detail(
                ErrorCode.INVALID_INPUT,
                message="Scribe preview is temporarily unavailable",
                details={"quest_id": quest_id},
            ),
        )

    return QuestScribePreviewRead(
        display_name=scribe_response.display_name,
        description=scribe_response.description,
        tags=scribe_response.tags,
    )


def _validate_quest_schedule(recurrence: str, schedule: Optional[str]) -> None:
    """
    Validate quest template schedule configuration.

    Raises:
        HTTPException: If schedule is invalid
    """
    import json

    # One-off quests don't need schedule validation
    if recurrence == "one-off":
        return

    # Recurring quests must have a schedule
    if not schedule:
        raise HTTPException(
            status_code=400,
            detail=f"Schedule is required for {recurrence} recurrence",
        )

    # Parse and validate JSON
    try:
        schedule_data = json.loads(schedule)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400,
            detail="Schedule must be valid JSON",
        )

    # Validate schedule type matches recurrence
    schedule_type = schedule_data.get("type")
    if schedule_type != recurrence:
        raise HTTPException(
            status_code=400,
            detail=f"Schedule type '{schedule_type}' must match recurrence '{recurrence}'",
        )

    # Validate time format
    time_str = schedule_data.get("time", "00:00")
    try:
        hour, minute = map(int, time_str.split(":"))
        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            raise ValueError()
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid time format: {time_str}. Expected HH:MM (00:00 to 23:59)",
        )

    # Validate day for weekly schedules
    if schedule_type == "weekly":
        day_name = schedule_data.get("day", "").lower()
        valid_days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        if day_name not in valid_days:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid day: {day_name}. Must be one of {', '.join(valid_days)}",
            )

    # Validate day for monthly schedules
    if schedule_type == "monthly":
        day = schedule_data.get("day")
        if not isinstance(day, int) or not (1 <= day <= 31):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid day: {day}. Must be an integer between 1 and 31",
            )


def _apply_scribe_response_to_quest(db: Session, quest_id: int, scribe_response: ScribeResponse) -> bool:
    """Apply generated Scribe content to an existing quest."""
    quest = crud_quest.get_quest(db, quest_id)
    if not quest:
        return False

    # Only update empty descriptive fields so explicit user input wins.
    if not quest.display_name:
        quest.display_name = scribe_response.display_name
    if not quest.description:
        quest.description = scribe_response.description
    if not quest.tags:
        quest.tags = scribe_response.tags

    # Rewards are derived from the generated difficulty sliders.
    quest.xp_reward = scribe_response.calculate_xp()
    quest.gold_reward = scribe_response.calculate_gold()

    db.add(quest)
    db.commit()
    return True


def _generate_and_update_quest(quest_id: int, quest_title: str):
    """Background task to generate quest content and update quest"""
    import time

    time.sleep(0.5)  # Small delay to ensure quest is committed

    try:
        from sqlmodel import Session

        from app.database import engine
        # Generate content using Groq
        scribe_response = generate_quest_content(quest_title)
        if not scribe_response:
            return  # Silently fail if Groq unavailable

        # Update quest with generated content
        with Session(engine) as db:
            _apply_scribe_response_to_quest(db, quest_id, scribe_response)
    except Exception as e:
        import logging

        logging.error(f"Error in scribe background task: {e}")


def _generate_and_update_quest_template_legacy(template_id: int, quest_title: str):
    """Background task to generate quest content and update template"""
    import time

    time.sleep(0.5)  # Small delay to ensure template is committed

    try:
        from sqlmodel import Session

        from app.database import engine

        # Generate content using Groq
        scribe_response = generate_quest_content(quest_title)
        if not scribe_response:
            return  # Silently fail if Groq unavailable

        # Update template with generated content
        with Session(engine) as db:
            template = crud_quest_template.get_quest_template(db, template_id)
            if not template:
                return

            # Only update if fields are empty (don't override user input)
            if not template.display_name:
                template.display_name = scribe_response.display_name
            if not template.description:
                template.description = scribe_response.description
            if not template.tags:
                template.tags = scribe_response.tags

            # Always update rewards based on calculated values
            template.xp_reward = scribe_response.calculate_xp()
            template.gold_reward = scribe_response.calculate_gold()

            db.add(template)
            db.commit()
    except Exception as e:
        import logging

        logging.error(f"Error in scribe background task: {e}")


@router.post("/templates", response_model=QuestTemplateRead)
def create_quest_template(
    background_tasks: BackgroundTasks,
    created_by: int = Query(...),
    skip_ai: bool = Query(False),
    template: QuestTemplateCreate = None,
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
):
    """
    Create a new quest template (reusable quest definition).

    - **created_by**: User ID creating this template
    - **skip_ai**: Set to `true` to skip AI-generated description (default: false)
    - **template**: Quest template data (title, description, rewards, etc.)

    **AI Generation**: If `skip_ai=false` and GROQ_API_KEY is configured,
    the Scribe service will asynchronously generate:
    - Fantasy display name
    - Engaging description
    - Appropriate tags
    - Calculated XP/gold rewards based on time/effort/dread ratings

    **Recurring Quests**: Templates can have schedules (daily, weekly, monthly).
    - Recurrence types: "one-off", "daily", "weekly", "monthly"
    - Schedule format: JSON string with type, time, and day (for weekly/monthly)
    - Optional due_in_hours: Relative deadline for auto-generated instances

    Template is created immediately; AI content is populated in the background.
    """
    home_id = auth["home_id"]

    # Verify user exists in home
    user = crud_user.get_user(db, created_by)
    if not user or user.home_id != home_id:
        raise HTTPException(status_code=404, detail="User not found in home")

    # Validate schedule configuration
    _validate_quest_schedule(template.recurrence, template.schedule)

    # Create template with defaults
    new_template = crud_quest_template.create_quest_template(db, home_id, created_by, template)

    # Trigger background task to generate content from Groq (unless skipping AI)
    if not skip_ai:
        background_tasks.add_task(
            _generate_and_update_quest_template_legacy,
            template_id=new_template.id,
            quest_title=new_template.title,
        )

    return new_template


# PUT endpoints
@router.put("/templates/{template_id}", response_model=QuestTemplateRead)
def update_quest_template(
    template_id: int,
    template_update: QuestTemplateUpdate = None,
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
):
    """Update quest template including schedule configuration"""
    template = crud_quest_template.get_quest_template(db, template_id)
    if not template or template.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="Quest template not found")

    # If recurrence or schedule is being updated, validate the combination
    new_recurrence = template_update.recurrence if template_update.recurrence is not None else template.recurrence
    new_schedule = template_update.schedule if template_update.schedule is not None else template.schedule

    _validate_quest_schedule(new_recurrence, new_schedule)

    template = crud_quest_template.update_quest_template(db, template_id, template_update)
    return template


@router.delete("/templates/{template_id}")
def delete_quest_template(
    template_id: int,
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
):
    """Delete quest template and orphan associated quests"""
    template = crud_quest_template.get_quest_template(db, template_id)
    if not template or template.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="Quest template not found")

    crud_quest_template.delete_quest_template(db, template_id)
    return {"detail": "Quest template deleted"}


@router.post("/{quest_id}/convert-to-template", response_model=QuestTemplateRead)
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
    template = crud_quest_template.create_quest_template(db, home_id, auth["user_id"], template_data)

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


@router.put("/{quest_id}", response_model=QuestRead)
def update_quest(
    quest_id: int,
    quest_update: QuestUpdate = None,
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
):
    """Update quest"""
    quest = crud_quest.get_quest(db, quest_id)
    if not quest or quest.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="Quest not found")

    is_reassigning = bool(
        quest_update
        and (quest_update.user_id is not None or quest_update.participant_user_ids is not None)
    )
    if quest.completed and is_reassigning:
        raise HTTPException(status_code=400, detail="Completed quests cannot be reassigned")

    if quest_update and quest_update.participant_user_ids is not None:
        participant_user_ids = _resolve_participant_user_ids(
            db,
            auth["home_id"],
            None,
            quest_update.participant_user_ids,
        )
        quest_update.participant_user_ids = participant_user_ids
        quest_update.user_id = participant_user_ids[0]
    elif quest_update and quest_update.user_id is not None:
        target_user = crud_user.get_user(db, quest_update.user_id)
        if not target_user or target_user.home_id != auth["home_id"]:
            raise HTTPException(status_code=400, detail="Quest owner must belong to your home")
        quest_update.participant_user_ids = [quest_update.user_id]

    quest = crud_quest.update_quest(db, quest_id, quest_update)
    return quest


# DELETE endpoints
@router.delete("/{quest_id}")
def delete_quest(quest_id: int, db: Session = Depends(get_db), auth: dict = Depends(get_current_user)):
    """Delete quest"""
    quest = crud_quest.get_quest(db, quest_id)
    if not quest or quest.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="Quest not found")

    crud_quest.delete_quest(db, quest_id)
    return {"detail": "Quest deleted"}


# Corruption system endpoint
@router.post("/check-corruption")
def check_corruption(db: Session = Depends(get_db), auth: dict = Depends(get_current_user)):
    """
    Manually trigger corruption check for overdue quests.

    This endpoint can be called by a cron job or manually to check for quests
    that are past their due date and mark them as corrupted.

    Returns the number of quests that were corrupted.
    """
    corrupted_quests = crud_quest.check_and_corrupt_overdue_quests(db)

    return {
        "corrupted_count": len(corrupted_quests),
        "corrupted_quest_ids": [q.id for q in corrupted_quests],
    }
