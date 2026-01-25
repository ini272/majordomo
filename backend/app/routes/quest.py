from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlmodel import Session

from app.auth import get_current_user
from app.crud import achievement as crud_achievement
from app.crud import daily_bounty as crud_daily_bounty
from app.crud import quest as crud_quest
from app.crud import quest_template as crud_quest_template
from app.crud import user as crud_user
from app.database import get_db
from app.errors import ErrorCode, create_error_detail
from app.models.quest import (
    QuestCreate,
    QuestRead,
    QuestTemplateCreate,
    QuestTemplateRead,
    QuestTemplateUpdate,
    QuestUpdate,
)
from app.services.scribe import generate_quest_content

router = APIRouter(prefix="/api/quests", tags=["quests"])


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

    Automatically checks for overdue quests and marks them as corrupted.
    """
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

    return crud_quest.create_quest(db, home_id, user_id, quest)


@router.post("/{quest_id}/complete")
def complete_quest(quest_id: int, db: Session = Depends(get_db), auth: dict = Depends(get_current_user)):
    """
    Complete a quest and award rewards to the user.

    - **quest_id**: Quest instance ID to complete

    Automatically awards XP and gold from the quest template.
    **Daily Bounty Bonus**: If this quest matches today's daily bounty, rewards are doubled (2x multiplier).

    Returns quest details and reward breakdown including XP, gold, and bounty status.
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

    # Check if this quest's template is today's daily bounty
    today_bounty = crud_daily_bounty.get_today_bounty(db, auth["home_id"])
    is_daily_bounty = today_bounty and today_bounty.quest_template_id == quest.quest_template_id

    # Check if quest is corrupted (overdue)
    is_corrupted = quest.quest_type == "corrupted"

    # Apply multipliers: daily bounty (2x) or corrupted (1.5x)
    # If both, apply higher multiplier (daily bounty)
    if is_daily_bounty:
        multiplier = 2
    elif is_corrupted:
        multiplier = 1.5
    else:
        multiplier = 1

    # Mark quest as completed
    quest = crud_quest.complete_quest(db, quest_id)

    # Award XP and gold to user from template (with bounty multiplier)
    # Floor values to integers to avoid fractional XP/gold (e.g., 1.5x multiplier)
    xp_awarded = 0
    gold_awarded = 0
    if quest.template:
        xp_awarded = int(quest.template.xp_reward * multiplier)
        gold_awarded = int(quest.template.gold_reward * multiplier)
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

    # Check and award any newly earned achievements
    newly_awarded_achievements = crud_achievement.check_and_award_achievements(db, quest.user_id)

    return {
        "quest": QuestRead.model_validate(quest),
        "rewards": {
            "xp": xp_awarded,
            "gold": gold_awarded,
            "is_daily_bounty": is_daily_bounty,
            "is_corrupted": is_corrupted,
            "multiplier": multiplier,
        },
        "achievements": [{"id": ua.achievement_id, "unlocked_at": ua.unlocked_at} for ua in newly_awarded_achievements],
    }


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

    Template is created immediately; AI content is populated in the background.
    """
    home_id = auth["home_id"]

    # Verify user exists in home
    user = crud_user.get_user(db, created_by)
    if not user or user.home_id != home_id:
        raise HTTPException(status_code=404, detail="User not found in home")

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
    """Update quest template"""
    template = crud_quest_template.get_quest_template(db, template_id)
    if not template or template.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="Quest template not found")

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
