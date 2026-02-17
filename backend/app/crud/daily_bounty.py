import random
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.models.daily_bounty import DailyBounty
from app.models.home import Home
from app.models.quest import Quest


MIN_BOUNTY_AGE_HOURS = 48


def _get_home_timezone(db: Session, home_id: int) -> str:
    home = db.get(Home, home_id)
    if not home or not home.timezone:
        return "UTC"
    return home.timezone


def _get_home_today(db: Session, home_id: int) -> date:
    timezone_name = _get_home_timezone(db, home_id)
    try:
        local_now = datetime.now(ZoneInfo(timezone_name))
    except ZoneInfoNotFoundError:
        local_now = datetime.now(ZoneInfo("UTC"))
    return local_now.date()


def get_bounty_for_date(db: Session, home_id: int, user_id: int, target_date: date) -> Optional[DailyBounty]:
    """Get a user's daily bounty decision for a specific date."""
    return db.exec(
        select(DailyBounty)
        .where(DailyBounty.home_id == home_id)
        .where(DailyBounty.user_id == user_id)
        .where(DailyBounty.bounty_date == target_date)
    ).first()


def get_today_bounty(db: Session, home_id: int, user_id: int) -> Optional[DailyBounty]:
    """Get today's bounty decision for a specific user."""
    return get_bounty_for_date(db, home_id, user_id, _get_home_today(db, home_id))


def _get_eligible_active_quests(db: Session, home_id: int, user_id: int) -> list[Quest]:
    """Get active user quests that are old enough to be bounty candidates."""
    age_cutoff = datetime.now(timezone.utc) - timedelta(hours=MIN_BOUNTY_AGE_HOURS)
    candidates = db.exec(
        select(Quest)
        .where(Quest.home_id == home_id)
        .where(Quest.user_id == user_id)
        .where(Quest.completed == False)  # noqa: E712
        .where(Quest.created_at <= age_cutoff)
    ).all()
    return list(candidates)


def _create_decision(
    db: Session,
    home_id: int,
    user_id: int,
    target_date: date,
    status: str,
    quest_id: Optional[int] = None,
) -> DailyBounty:
    decision = DailyBounty(
        home_id=home_id,
        user_id=user_id,
        quest_id=quest_id,
        bounty_date=target_date,
        status=status,
    )
    db.add(decision)
    db.commit()
    db.refresh(decision)
    return decision


def get_or_create_today_bounty(db: Session, home_id: int, user_id: int) -> DailyBounty:
    """
    Resolve today's bounty decision for a user.

    Behavior:
    - First call of the day creates and locks the decision.
    - If no eligible quests exist, creates `none_eligible`.
    - Excludes yesterday's quest when there is more than one candidate.
    """
    today = _get_home_today(db, home_id)
    existing = get_bounty_for_date(db, home_id, user_id, today)
    if existing:
        return existing

    candidates = _get_eligible_active_quests(db, home_id, user_id)

    chosen_quest_id: Optional[int] = None
    status = "none_eligible"

    if candidates:
        yesterday = today - timedelta(days=1)
        yesterday_decision = get_bounty_for_date(db, home_id, user_id, yesterday)
        candidate_ids = [quest.id for quest in candidates]

        # Avoid consecutive repeat if we have another option.
        if (
            len(candidates) > 1
            and yesterday_decision
            and yesterday_decision.status == "assigned"
            and yesterday_decision.quest_id in candidate_ids
        ):
            candidates = [quest for quest in candidates if quest.id != yesterday_decision.quest_id]

        chosen = random.choice(candidates)
        chosen_quest_id = chosen.id
        status = "assigned"

    try:
        return _create_decision(
            db=db,
            home_id=home_id,
            user_id=user_id,
            target_date=today,
            status=status,
            quest_id=chosen_quest_id,
        )
    except IntegrityError:
        # Concurrent request created today's row first.
        db.rollback()
        existing_after_conflict = get_bounty_for_date(db, home_id, user_id, today)
        if existing_after_conflict:
            return existing_after_conflict
        raise


def refresh_bounty(db: Session, home_id: int, user_id: int) -> DailyBounty:
    """
    Force-refresh today's bounty decision for a user (mainly for testing).
    """
    today = _get_home_today(db, home_id)
    existing = get_bounty_for_date(db, home_id, user_id, today)
    if existing:
        db.delete(existing)
        db.commit()

    return get_or_create_today_bounty(db, home_id, user_id)
