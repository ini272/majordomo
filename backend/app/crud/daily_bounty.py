from typing import Optional
from datetime import date, timedelta
import random
from sqlmodel import select, Session
from app.models.daily_bounty import DailyBounty
from app.models.quest import QuestTemplate


def get_bounty_for_date(db: Session, home_id: int, target_date: date) -> Optional[DailyBounty]:
    """Get the daily bounty for a specific date and home"""
    return db.exec(
        select(DailyBounty)
        .where(DailyBounty.home_id == home_id)
        .where(DailyBounty.bounty_date == target_date)
    ).first()


def get_today_bounty(db: Session, home_id: int) -> Optional[DailyBounty]:
    """Get today's daily bounty for a home"""
    return get_bounty_for_date(db, home_id, date.today())


def select_random_template(db: Session, home_id: int, exclude_template_id: Optional[int] = None) -> Optional[QuestTemplate]:
    """Select a random quest template from the home's templates"""
    query = select(QuestTemplate).where(QuestTemplate.home_id == home_id)

    if exclude_template_id:
        query = query.where(QuestTemplate.id != exclude_template_id)

    templates = db.exec(query).all()

    if not templates:
        return None

    return random.choice(templates)


def create_bounty(db: Session, home_id: int, quest_template_id: int, target_date: date) -> DailyBounty:
    """Create a new daily bounty record"""
    db_bounty = DailyBounty(
        home_id=home_id,
        quest_template_id=quest_template_id,
        bounty_date=target_date
    )
    db.add(db_bounty)
    db.commit()
    db.refresh(db_bounty)
    return db_bounty


def get_or_create_today_bounty(db: Session, home_id: int) -> Optional[DailyBounty]:
    """Get today's bounty, creating one if it doesn't exist"""
    today = date.today()

    # Check if we already have a bounty for today
    existing = get_bounty_for_date(db, home_id, today)
    if existing:
        return existing

    # Get yesterday's bounty to avoid repeating
    yesterday = today - timedelta(days=1)
    yesterday_bounty = get_bounty_for_date(db, home_id, yesterday)
    exclude_id = yesterday_bounty.quest_template_id if yesterday_bounty else None

    # Select a random template
    template = select_random_template(db, home_id, exclude_template_id=exclude_id)
    if not template:
        return None  # No templates available

    # Create the bounty
    return create_bounty(db, home_id, template.id, today)


def refresh_bounty(db: Session, home_id: int) -> Optional[DailyBounty]:
    """Force select a new bounty for today (for testing/manual refresh)"""
    today = date.today()

    # Delete existing bounty for today if any
    existing = get_bounty_for_date(db, home_id, today)
    if existing:
        db.delete(existing)
        db.commit()

    # Select a new random template
    template = select_random_template(db, home_id)
    if not template:
        return None

    return create_bounty(db, home_id, template.id, today)
