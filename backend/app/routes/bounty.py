from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.auth import get_current_user
from app.crud import daily_bounty as crud_daily_bounty
from app.crud import quest as crud_quest
from app.database import get_db
from app.models.daily_bounty import DailyBounty
from app.models.quest import QuestRead

router = APIRouter(prefix="/api/bounty", tags=["bounty"])


def _serialize_bounty_response(db: Session, decision: DailyBounty) -> dict:
    quest = crud_quest.get_quest(db, decision.quest_id) if decision.quest_id else None

    return {
        "bounty_date": decision.bounty_date.isoformat(),
        "status": decision.status,
        "bonus_multiplier": 2 if decision.status == "assigned" else 1,
        "quest": QuestRead.model_validate(quest) if quest else None,
    }


@router.get("/today")
def get_today_bounty(
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
) -> dict:
    """
    Get today's daily bounty decision for the authenticated user.

    Behavior:
    - Creates and locks one decision row on first request of the day
    - Returns assigned quest (if any) or `none_eligible`
    """
    decision = crud_daily_bounty.get_or_create_today_bounty(db, auth["home_id"], auth["user_id"])
    return _serialize_bounty_response(db, decision)


@router.post("/refresh")
def refresh_bounty(
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
) -> dict:
    """
    Force refresh today's user bounty decision (for testing).
    """
    decision = crud_daily_bounty.refresh_bounty(db, auth["home_id"], auth["user_id"])
    return _serialize_bounty_response(db, decision)


@router.get("/check/{quest_id}")
def check_if_bounty(
    quest_id: int,
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
) -> dict:
    """
    Check if a specific quest instance is today's assigned bounty.
    """
    decision = crud_daily_bounty.get_or_create_today_bounty(db, auth["home_id"], auth["user_id"])

    is_bounty = decision.status == "assigned" and decision.quest_id == quest_id

    return {
        "is_daily_bounty": is_bounty,
        "bonus_multiplier": 2 if is_bounty else 1,
    }
