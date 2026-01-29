from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.auth import get_current_user
from app.crud import quest as crud_quest
from app.crud import quest_template as crud_quest_template
from app.crud import user as crud_user
from app.database import get_db
from app.models.quest import QuestCreate, QuestRead

router = APIRouter(prefix="/api/triggers", tags=["triggers"])


@router.post("/quest/{quest_template_id}")
def trigger_quest(
    quest_template_id: int,
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
) -> dict:
    """
    Trigger quest completion via NFC or manual trigger.
    - Creates a new quest instance from template
    - Completes it immediately
    - Awards XP and gold
    - Returns quest and rewards
    """
    # Get template
    template = crud_quest_template.get_quest_template(db, quest_template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Quest template not found")

    # Verify template belongs to user's home
    if template.home_id != auth["home_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to trigger this quest")

    # Create quest instance with snapshot of template data
    quest_in = QuestCreate(quest_template_id=quest_template_id)
    quest = crud_quest.create_quest(db, auth["home_id"], auth["user_id"], quest_in, template)

    # Complete the quest immediately with base rewards (no multipliers applied for NFC triggers)
    base_xp = quest.xp_reward
    base_gold = quest.gold_reward
    quest = crud_quest.complete_quest(db, quest.id, final_xp=base_xp, final_gold=base_gold)

    # Award XP and gold
    user = crud_user.add_xp(db, auth["user_id"], base_xp)
    user = crud_user.add_gold(db, auth["user_id"], base_gold)

    return {
        "success": True,
        "quest": QuestRead.model_validate(quest),
        "user_stats": {
            "level": user.level,
            "xp": user.xp,
            "gold": user.gold_balance,
        },
        "rewards": {
            "xp": base_xp,
            "gold": base_gold,
        },
    }
