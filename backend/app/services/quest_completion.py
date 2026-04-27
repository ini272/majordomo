from datetime import datetime, timezone

from fastapi import HTTPException
from sqlmodel import Session, select

from app.crud import achievement as crud_achievement
from app.crud import daily_bounty as crud_daily_bounty
from app.crud import quest as crud_quest
from app.crud import user as crud_user
from app.errors import ErrorCode, create_error_detail
from app.models.quest import Quest, QuestRead
from app.models.user import User

CORRUPTION_DEBUFF_PERCENT = 20


def as_aware_datetime(value: datetime) -> datetime:
    """Treat legacy naive datetimes as UTC so reward logic remains consistent."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def has_active_shield(user: User) -> bool:
    if not user.active_shield_expiry:
        return False

    return as_aware_datetime(user.active_shield_expiry) > datetime.now(timezone.utc)


def get_corrupted_quest_count(db: Session, home_id: int) -> int:
    corrupted_quests = db.exec(
        select(Quest.id).where(
            (Quest.home_id == home_id)
            & (Quest.quest_type == "corrupted")
            & (Quest.completed == False)  # noqa: E712
        )
    ).all()
    return len(corrupted_quests)


def corruption_multiplier(corrupted_quest_count: int) -> float:
    if corrupted_quest_count <= 0:
        return 1.0

    return 1.0 - (CORRUPTION_DEBUFF_PERCENT / 100.0)


def calculate_corruption_debuff(db: Session, home_id: int, user: User) -> float:
    """
    Calculate house-wide corruption debuff multiplier.

    Debuff calculation:
    - Any active corrupted quest in the home applies a flat -20% penalty
    - Additional corrupted quests do not increase the penalty
    - Shield suppresses debuff temporarily
    """
    if has_active_shield(user):
        return 1.0

    return corruption_multiplier(get_corrupted_quest_count(db, home_id))


def complete_quest_with_rewards(db: Session, quest: Quest, auth: dict) -> dict:
    """
    Complete a quest and award rewards to every participant.

    This is shared by board completion and NFC/template triggers so reward
    rules do not drift between entry points.
    """
    if quest.home_id != auth["home_id"]:
        raise HTTPException(
            status_code=404,
            detail=create_error_detail(ErrorCode.QUEST_NOT_FOUND, details={"quest_id": quest.id}),
        )

    if quest.completed:
        raise HTTPException(
            status_code=400,
            detail=create_error_detail(
                ErrorCode.QUEST_ALREADY_COMPLETED,
                details={
                    "quest_id": quest.id,
                    "completed_at": quest.completed_at.isoformat() if quest.completed_at else None,
                },
            ),
        )

    participants = crud_quest.ensure_quest_participants(db, quest)
    if not participants:
        raise HTTPException(status_code=400, detail="Quest has no participants")

    participants = sorted(participants, key=lambda participant: participant.user_id)
    participant_users: dict[int, User] = {}
    for participant in participants:
        participant_user = crud_user.get_user(db, participant.user_id)
        if not participant_user or participant_user.home_id != auth["home_id"]:
            raise HTTPException(
                status_code=404,
                detail=create_error_detail(ErrorCode.USER_NOT_FOUND, details={"user_id": participant.user_id}),
            )
        participant_users[participant.user_id] = participant_user

    is_corrupted = quest.quest_type == "corrupted"
    base_xp = quest.xp_reward
    base_gold = quest.gold_reward
    completed_at = datetime.now(timezone.utc)
    bounty_decisions = {
        participant.user_id: crud_daily_bounty.get_or_create_today_bounty(db, auth["home_id"], participant.user_id)
        for participant in participants
    }

    participant_reward_breakdowns = []
    total_xp_awarded = 0
    total_gold_awarded = 0
    any_daily_bounty = False
    any_xp_boost = False
    first_participant_xp_boost_remaining = 0

    for index, participant in enumerate(participants):
        user = participant_users[participant.user_id]

        today_bounty = bounty_decisions[user.id]
        is_daily_bounty = bool(today_bounty.status == "assigned" and today_bounty.quest_id == quest.id)
        any_daily_bounty = any_daily_bounty or is_daily_bounty

        corruption_debuff = calculate_corruption_debuff(db, auth["home_id"], user)
        has_xp_boost = user.active_xp_boost_count > 0
        any_xp_boost = any_xp_boost or has_xp_boost

        participant_base_xp = base_xp
        participant_base_gold = base_gold
        bounty_gold_multiplier = 3 if is_daily_bounty else 1
        bounty_xp_multiplier = 1
        xp_boost_multiplier = 2 if has_xp_boost else 1

        xp_after_debuff = participant_base_xp * corruption_debuff
        gold_after_debuff = participant_base_gold * corruption_debuff
        xp_after_bounty = xp_after_debuff * bounty_xp_multiplier
        gold_after_bounty = gold_after_debuff * bounty_gold_multiplier
        xp_awarded = int(xp_after_bounty * xp_boost_multiplier)
        gold_awarded = int(gold_after_bounty)

        participant.xp_awarded = xp_awarded
        participant.gold_awarded = gold_awarded
        participant.completed_at = completed_at
        db.add(participant)

        user.xp += xp_awarded
        user.level = crud_user.calculate_level(user.xp)
        user.gold_balance += gold_awarded

        if has_xp_boost:
            user.active_xp_boost_count -= 1

        db.add(user)

        if index == 0:
            first_participant_xp_boost_remaining = user.active_xp_boost_count

        total_xp_awarded += xp_awarded
        total_gold_awarded += gold_awarded
        participant_reward_breakdowns.append(
            {
                "user_id": user.id,
                "xp": xp_awarded,
                "gold": gold_awarded,
                "base_xp": participant_base_xp,
                "base_gold": participant_base_gold,
                "is_daily_bounty": is_daily_bounty,
                "is_corrupted": is_corrupted,
                "corruption_debuff": corruption_debuff,
                "bounty_multiplier": bounty_gold_multiplier,
                "bounty_gold_multiplier": bounty_gold_multiplier,
                "bounty_xp_multiplier": bounty_xp_multiplier,
                "xp_boost_active": has_xp_boost,
                "xp_boost_remaining": user.active_xp_boost_count,
            }
        )

    quest.completed = True
    quest.completed_at = completed_at
    db.add(quest)

    db.commit()
    db.refresh(quest)

    newly_awarded_achievements = []
    for participant in participants:
        for user_achievement in crud_achievement.check_and_award_achievements(db, participant.user_id):
            newly_awarded_achievements.append(
                {
                    "user_id": participant.user_id,
                    "id": user_achievement.achievement_id,
                    "unlocked_at": user_achievement.unlocked_at,
                }
            )

    return {
        "quest": QuestRead.model_validate(quest),
        "rewards": {
            "xp": total_xp_awarded,
            "gold": total_gold_awarded,
            "base_xp": base_xp,
            "base_gold": base_gold,
            "is_daily_bounty": any_daily_bounty,
            "is_corrupted": is_corrupted,
            "corruption_debuff": min(
                (reward["corruption_debuff"] for reward in participant_reward_breakdowns),
                default=1.0,
            ),
            "bounty_multiplier": 3 if any_daily_bounty else 1,
            "bounty_gold_multiplier": 3 if any_daily_bounty else 1,
            "bounty_xp_multiplier": 1,
            "xp_boost_active": any_xp_boost,
            "xp_boost_remaining": first_participant_xp_boost_remaining,
            "participants": participant_reward_breakdowns,
        },
        "achievements": newly_awarded_achievements,
    }
