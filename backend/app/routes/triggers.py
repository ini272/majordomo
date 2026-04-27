from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.auth import get_current_user
from app.crud import quest as crud_quest
from app.crud import quest_template as crud_quest_template
from app.crud import user as crud_user
from app.database import get_db
from app.models.quest import Quest, QuestCreate, QuestParticipant, QuestRead
from app.services.quest_completion import as_aware_datetime, complete_quest_with_rewards

router = APIRouter(prefix="/api/triggers", tags=["triggers"])

NFC_DUPLICATE_SCAN_COOLDOWN_SECONDS = 30


def _get_user_stats(db: Session, auth: dict) -> dict:
    user = crud_user.get_user(db, auth["user_id"])
    if not user or user.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "level": user.level,
        "xp": user.xp,
        "gold": user.gold_balance,
    }


def _find_active_user_quest_for_template(
    db: Session,
    home_id: int,
    user_id: int,
    quest_template_id: int,
) -> list[Quest]:
    return db.exec(
        select(Quest)
        .join(QuestParticipant, QuestParticipant.quest_id == Quest.id)
        .where(
            (Quest.home_id == home_id)
            & (Quest.quest_template_id == quest_template_id)
            & (Quest.completed == False)  # noqa: E712
            & (QuestParticipant.user_id == user_id)
        )
        .order_by(Quest.created_at.asc())
    ).all()


def _find_recent_completed_user_quest_for_template(
    db: Session,
    home_id: int,
    user_id: int,
    quest_template_id: int,
    now: datetime,
) -> Quest | None:
    cooldown_cutoff = now - timedelta(seconds=NFC_DUPLICATE_SCAN_COOLDOWN_SECONDS)
    return db.exec(
        select(Quest)
        .join(QuestParticipant, QuestParticipant.quest_id == Quest.id)
        .where(
            (Quest.home_id == home_id)
            & (Quest.quest_template_id == quest_template_id)
            & (Quest.completed == True)  # noqa: E712
            & (Quest.completed_at >= cooldown_cutoff)
            & (QuestParticipant.user_id == user_id)
        )
        .order_by(Quest.completed_at.desc())
    ).first()


def _cooldown_remaining_seconds(quest: Quest, now: datetime) -> int:
    if not quest.completed_at:
        return NFC_DUPLICATE_SCAN_COOLDOWN_SECONDS

    completed_at = as_aware_datetime(quest.completed_at)
    elapsed_seconds = max(0, int((now - completed_at).total_seconds()))
    return max(1, NFC_DUPLICATE_SCAN_COOLDOWN_SECONDS - elapsed_seconds)


def _duplicate_scan_response(db: Session, quest: Quest, auth: dict, now: datetime) -> dict:
    participants = crud_quest.ensure_quest_participants(db, quest)
    participant = next((item for item in participants if item.user_id == auth["user_id"]), None)
    previous_xp = participant.xp_awarded if participant and participant.xp_awarded is not None else 0
    previous_gold = participant.gold_awarded if participant and participant.gold_awarded is not None else 0

    return {
        "success": True,
        "duplicate": True,
        "source": "cooldown",
        "cooldown_seconds": NFC_DUPLICATE_SCAN_COOLDOWN_SECONDS,
        "cooldown_remaining_seconds": _cooldown_remaining_seconds(quest, now),
        "quest": QuestRead.model_validate(quest),
        "user_stats": _get_user_stats(db, auth),
        "rewards": {
            "xp": 0,
            "gold": 0,
            "base_xp": quest.xp_reward,
            "base_gold": quest.gold_reward,
            "is_daily_bounty": False,
            "is_corrupted": quest.quest_type == "corrupted",
            "corruption_debuff": 1.0,
            "bounty_multiplier": 1,
            "bounty_gold_multiplier": 1,
            "bounty_xp_multiplier": 1,
            "xp_boost_active": False,
            "xp_boost_remaining": 0,
            "duplicate_scan": True,
            "previous_xp": previous_xp,
            "previous_gold": previous_gold,
        },
        "achievements": [],
    }


def _completion_response(db: Session, quest: Quest, auth: dict, source: str) -> dict:
    completion = complete_quest_with_rewards(db, quest, auth)
    return {
        "success": True,
        "duplicate": False,
        "source": source,
        "cooldown_seconds": NFC_DUPLICATE_SCAN_COOLDOWN_SECONDS,
        **completion,
        "user_stats": _get_user_stats(db, auth),
    }


def _is_shared_quest(db: Session, quest: Quest) -> bool:
    participants = crud_quest.ensure_quest_participants(db, quest)
    return len(participants) > 1


@router.post("/nfc/{nfc_code}")
def trigger_quest(
    nfc_code: str,
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
) -> dict:
    """
    Trigger quest completion via NFC or manual trigger.
    - Completes the user's oldest active quest for this template when one exists
    - Otherwise creates a new quest instance from the template and completes it
    - Suppresses duplicate scans for a short cooldown window
    - Returns quest and rewards
    """
    template = crud_quest_template.get_nfc_quest_template(db, nfc_code)
    if not template or template.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="NFC trigger not found")

    quest_template_id = template.id
    if quest_template_id is None:
        raise HTTPException(status_code=404, detail="NFC trigger not found")

    now = datetime.now(timezone.utc)
    recent_quest = _find_recent_completed_user_quest_for_template(
        db,
        auth["home_id"],
        auth["user_id"],
        quest_template_id,
        now,
    )
    if recent_quest:
        return _duplicate_scan_response(db, recent_quest, auth, now)

    active_quests = _find_active_user_quest_for_template(
        db,
        auth["home_id"],
        auth["user_id"],
        quest_template_id,
    )
    for active_quest in active_quests:
        if not _is_shared_quest(db, active_quest):
            return _completion_response(db, active_quest, auth, "active_quest")

    if active_quests:
        raise HTTPException(
            status_code=409,
            detail="This is a shared quest. Complete it from the board.",
        )

    quest_in = QuestCreate(quest_template_id=quest_template_id)
    quest = crud_quest.create_quest(
        db,
        auth["home_id"],
        auth["user_id"],
        [auth["user_id"]],
        quest_in,
        template,
    )

    return _completion_response(db, quest, auth, "created_from_template")
