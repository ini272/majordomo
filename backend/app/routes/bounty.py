
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.auth import get_current_user
from app.crud import daily_bounty as crud_daily_bounty
from app.crud import quest_template as crud_quest_template
from app.database import get_db
from app.models.quest import QuestTemplateRead

router = APIRouter(prefix="/api/bounty", tags=["bounty"])


@router.get("/today")
def get_today_bounty(
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
) -> dict:
    """
    Get today's daily bounty for the user's home.
    Creates a new bounty if one doesn't exist for today.
    Returns the bounty with full template data.
    """
    bounty = crud_daily_bounty.get_or_create_today_bounty(db, auth["home_id"])

    if not bounty:
        return {"bounty": None, "message": "No quest templates available to create bounty"}

    # Get full template data
    template = crud_quest_template.get_quest_template(db, bounty.quest_template_id)

    return {
        "bounty": {
            "id": bounty.id,
            "home_id": bounty.home_id,
            "quest_template_id": bounty.quest_template_id,
            "bounty_date": bounty.bounty_date.isoformat(),
            "created_at": bounty.created_at.isoformat(),
        },
        "template": QuestTemplateRead.model_validate(template) if template else None,
        "bonus_multiplier": 2,  # 2x rewards for daily bounty
    }


@router.post("/refresh")
def refresh_bounty(
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
) -> dict:
    """
    Force refresh today's bounty (for testing).
    Selects a new random template.
    """
    bounty = crud_daily_bounty.refresh_bounty(db, auth["home_id"])

    if not bounty:
        raise HTTPException(status_code=400, detail="No quest templates available to create bounty")

    # Get full template data
    template = crud_quest_template.get_quest_template(db, bounty.quest_template_id)

    return {
        "bounty": {
            "id": bounty.id,
            "home_id": bounty.home_id,
            "quest_template_id": bounty.quest_template_id,
            "bounty_date": bounty.bounty_date.isoformat(),
            "created_at": bounty.created_at.isoformat(),
        },
        "template": QuestTemplateRead.model_validate(template) if template else None,
        "bonus_multiplier": 2,
    }


@router.get("/check/{quest_template_id}")
def check_if_bounty(
    quest_template_id: int,
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
) -> dict:
    """
    Check if a specific quest template is today's bounty.
    Used to determine if bonus multiplier should apply.
    """
    bounty = crud_daily_bounty.get_today_bounty(db, auth["home_id"])

    is_bounty = bounty is not None and bounty.quest_template_id == quest_template_id

    return {
        "is_daily_bounty": is_bounty,
        "bonus_multiplier": 2 if is_bounty else 1,
    }
