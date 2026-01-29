from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.auth import get_current_user
from app.crud import achievement as crud_achievement
from app.crud import daily_bounty as crud_daily_bounty
from app.crud import quest as crud_quest
from app.crud import quest_template as crud_quest_template
from app.crud import user as crud_user
from app.database import get_db
from app.errors import ErrorCode, create_error_detail
from app.models.quest import (
    Quest,
    QuestCreate,
    QuestRead,
    QuestTemplateCreate,
    QuestTemplateRead,
    QuestTemplateUpdate,
    QuestUpdate,
)
from app.models.user import User
from app.services.recurring_quests import generate_due_quests
from app.services.scribe import generate_quest_content

router = APIRouter(prefix="/api/quests", tags=["quests"])


def _calculate_corruption_debuff(db: Session, home_id: int, user: User) -> float:
    """
    Calculate house-wide corruption debuff multiplier.

    Returns multiplier to apply to rewards (1.0 = no debuff, 0.85 = -15% debuff, etc.)

    Debuff calculation:
    - Each corrupted quest in the home adds -5% penalty
    - Stacks up to -50% cap (10 corrupted quests)
    - Shield suppresses debuff temporarily (returns 1.0 if active)
    """
    # Check if user has active shield
    now = datetime.now(timezone.utc)
    if user.active_shield_expiry and user.active_shield_expiry > now:
        return 1.0  # No debuff - shield protects

    # Count corrupted quests in the home
    corrupted_count = db.exec(
        select(Quest).where((Quest.home_id == home_id) & (Quest.quest_type == "corrupted") & (Quest.completed == False))  # noqa: E712
    ).all()

    corrupted_count = len(corrupted_count)

    # Calculate debuff: -5% per corrupted quest, cap at -50%
    debuff_percent = min(corrupted_count * 5, 50)
    multiplier = 1.0 - (debuff_percent / 100.0)

    return multiplier


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

    return crud_quest.get_quests_by_home(db, auth["home_id"])


@router.get("/{quest_id}", response_model=QuestRead)
def get_quest(quest_id: int, db: Session = Depends(get_db), auth: dict = Depends(get_current_user)):
    """Get quest by ID (only those in your home can access)"""
    quest = crud_quest.get_quest(db, quest_id)
    if not quest or quest.home_id != auth["home_id"]:
        raise HTTPException(
            status_code=404,
            detail=create_error_detail(ErrorCode.QUEST_NOT_FOUND, details={"quest_id": quest_id}),
        )

    return quest


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

    return crud_quest.get_quests_by_user(db, auth["home_id"], user_id, completed)


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
    quest: QuestCreate, user_id: int = Query(...), db: Session = Depends(get_db), auth: dict = Depends(get_current_user)
):
    """Create a new quest instance for a user"""
    home_id = auth["home_id"]

    # Verify user exists in home and belongs to authenticated home
    user = crud_user.get_user(db, user_id)
    if not user or user.home_id != home_id:
        raise HTTPException(status_code=404, detail="User not found in home")

    # Verify template exists in home
    template = crud_quest_template.get_quest_template(db, quest.quest_template_id)
    if not template or template.home_id != home_id:
        raise HTTPException(status_code=404, detail="Quest template not found in home")

    return crud_quest.create_quest(db, home_id, user_id, quest, template)


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

    # Calculate due date if template specifies
    due_date = None
    if template.due_in_hours:
        due_date = now + timedelta(hours=template.due_in_hours)

    # Create quest instance for requesting user only, snapshotting template data
    new_quest = Quest(
        home_id=auth["home_id"],
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
        due_date=due_date,
    )
    db.add(new_quest)

    # Update last_generated_at
    template.last_generated_at = now
    db.add(template)
    db.commit()
    db.refresh(new_quest)

    return QuestRead.model_validate(new_quest)


@router.post("/{quest_id}/complete")
def complete_quest(quest_id: int, db: Session = Depends(get_db), auth: dict = Depends(get_current_user)):
    """
    Complete a quest and award rewards to the user.

    - **quest_id**: Quest instance ID to complete

    Automatically awards XP and gold from the quest template.

    **Reward Calculation Order**:
    1. Base rewards from template
    2. Apply corruption debuff (-5% per corrupted quest in home, capped at -50%)
    3. Apply bounty multiplier (2x if daily bounty)
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

    # Prevent double-completion
    if quest.completed:
        raise HTTPException(
            status_code=400,
            detail=create_error_detail(
                ErrorCode.QUEST_ALREADY_COMPLETED,
                details={
                    "quest_id": quest_id,
                    "completed_at": quest.completed_at.isoformat() if quest.completed_at else None,
                },
            ),
        )

    # Get user for consumable checks and debuff calculation
    user = crud_user.get_user(db, quest.user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail=create_error_detail(ErrorCode.USER_NOT_FOUND, details={"user_id": quest.user_id}),
        )

    # Check if this quest's template is today's daily bounty
    today_bounty = crud_daily_bounty.get_today_bounty(db, auth["home_id"])
    is_daily_bounty = today_bounty and today_bounty.quest_template_id == quest.quest_template_id

    # Check if quest is corrupted (overdue) - for display purposes only (not bonus rewards)
    is_corrupted = quest.quest_type == "corrupted"

    # Calculate corruption debuff (house-wide penalty)
    corruption_debuff_multiplier = _calculate_corruption_debuff(db, auth["home_id"], user)

    # Check for active XP boost (Heroic Elixir)
    has_xp_boost = user.active_xp_boost_count > 0

    # Award XP and gold to user from template
    # Apply order: base → corruption_debuff → bounty_multiplier → xp_boost
    xp_awarded = 0
    gold_awarded = 0
    base_xp = 0
    base_gold = 0
    bounty_multiplier = 2 if is_daily_bounty else 1
    xp_boost_multiplier = 2 if has_xp_boost else 1

    # Use quest's snapshot fields as base values
    base_xp = quest.xp_reward
    base_gold = quest.gold_reward

    # Apply corruption debuff to both XP and gold
    xp_after_debuff = base_xp * corruption_debuff_multiplier
    gold_after_debuff = base_gold * corruption_debuff_multiplier

    # Apply bounty multiplier to both
    xp_after_bounty = xp_after_debuff * bounty_multiplier
    gold_after_bounty = gold_after_debuff * bounty_multiplier

    # Apply XP boost only to XP (not gold)
    xp_awarded = int(xp_after_bounty * xp_boost_multiplier)
    gold_awarded = int(gold_after_bounty)

    # Mark quest as completed and store actual earned rewards
    quest = crud_quest.complete_quest(db, quest_id, final_xp=xp_awarded, final_gold=gold_awarded)

    try:
        crud_user.add_xp(db, quest.user_id, xp_awarded)
        crud_user.add_gold(db, quest.user_id, gold_awarded)
    except ValueError as e:
        error_msg = str(e)
        # Determine error code based on error message
        if "XP amount" in error_msg:
            error_code = ErrorCode.NEGATIVE_XP
        elif "Insufficient gold" in error_msg:
            error_code = ErrorCode.INSUFFICIENT_GOLD
        else:
            error_code = ErrorCode.INVALID_INPUT

        raise HTTPException(
            status_code=400,
            detail=create_error_detail(error_code, message=error_msg, details={"quest_id": quest_id}),
        )

    # Decrement XP boost counter if active
    if has_xp_boost:
        user.active_xp_boost_count -= 1
        db.add(user)
        db.commit()

    # Check and award any newly earned achievements
    newly_awarded_achievements = crud_achievement.check_and_award_achievements(db, quest.user_id)

    return {
        "quest": QuestRead.model_validate(quest),
        "rewards": {
            "xp": xp_awarded,
            "gold": gold_awarded,
            "base_xp": base_xp,
            "base_gold": base_gold,
            "is_daily_bounty": is_daily_bounty,
            "is_corrupted": is_corrupted,
            "corruption_debuff": corruption_debuff_multiplier,
            "bounty_multiplier": bounty_multiplier,
            "xp_boost_active": has_xp_boost,
            "xp_boost_remaining": user.active_xp_boost_count,  # After decrement
        },
        "achievements": [{"id": ua.achievement_id, "unlocked_at": ua.unlocked_at} for ua in newly_awarded_achievements],
    }


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


def _generate_and_update_quest_template(template_id: int, quest_title: str):
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
    created_by: int = Query(...),
    skip_ai: bool = Query(False),
    template: QuestTemplateCreate = None,
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
    background_tasks: BackgroundTasks = BackgroundTasks(),
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
            _generate_and_update_quest_template,
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
