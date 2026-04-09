import secrets
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlmodel import Session, delete, select

from app.crud import reward as crud_reward
from app.models.achievement import Achievement, UserAchievement
from app.models.daily_bounty import DailyBounty
from app.models.home import Home, HomeCreate
from app.models.quest import Quest, QuestTemplate, UserTemplateSubscription
from app.models.reward import Reward, UserRewardClaim
from app.models.user import User


def generate_invite_code() -> str:
    """Generate a unique invite code"""
    return secrets.token_urlsafe(8)


def get_all_homes(db: Session) -> list[Home]:
    """Get all homes"""
    return db.exec(select(Home)).all()


def get_home(db: Session, home_id: int) -> Optional[Home]:
    """Get home by ID"""
    return db.exec(select(Home).where(Home.id == home_id)).first()


def get_home_by_invite_code(db: Session, invite_code: str) -> Optional[Home]:
    """Get home by invite code"""
    return db.exec(select(Home).where(Home.invite_code == invite_code)).first()


def get_home_by_name(db: Session, name: str) -> Optional[Home]:
    """Get home by name"""
    return db.exec(select(Home).where(Home.name == name)).first()


def create_home(db: Session, home_in: HomeCreate) -> Home:
    """Create a new home"""
    # Check for duplicate home name
    existing_home = get_home_by_name(db, home_in.name)
    if existing_home:
        raise ValueError(f"A home with the name '{home_in.name}' already exists")

    timezone = home_in.timezone.strip() if home_in.timezone else "UTC"
    try:
        ZoneInfo(timezone)
    except ZoneInfoNotFoundError as exc:
        raise ValueError(f"Invalid home timezone: {timezone}") from exc

    db_home = Home(
        **home_in.model_dump(exclude={"timezone"}),
        timezone=timezone,
        invite_code=generate_invite_code(),
    )
    db.add(db_home)
    db.commit()
    db.refresh(db_home)

    # Ensure each home starts with the default shop consumables.
    crud_reward.ensure_starter_rewards(db, db_home.id)

    return db_home


def delete_home(db: Session, home_id: int) -> bool:
    """Delete home"""
    db_home = get_home(db, home_id)
    if not db_home:
        return False

    user_ids = db.exec(select(User.id).where(User.home_id == home_id)).all()
    template_ids = db.exec(select(QuestTemplate.id).where(QuestTemplate.home_id == home_id)).all()
    reward_ids = db.exec(select(Reward.id).where(Reward.home_id == home_id)).all()
    achievement_ids = db.exec(select(Achievement.id).where(Achievement.home_id == home_id)).all()

    db.exec(delete(DailyBounty).where(DailyBounty.home_id == home_id))
    db.exec(delete(Quest).where(Quest.home_id == home_id))

    if reward_ids:
        db.exec(delete(UserRewardClaim).where(UserRewardClaim.reward_id.in_(reward_ids)))

    if achievement_ids:
        db.exec(delete(UserAchievement).where(UserAchievement.achievement_id.in_(achievement_ids)))

    if template_ids:
        db.exec(delete(UserTemplateSubscription).where(UserTemplateSubscription.quest_template_id.in_(template_ids)))

    db.exec(delete(Reward).where(Reward.home_id == home_id))
    db.exec(delete(QuestTemplate).where(QuestTemplate.home_id == home_id))
    db.exec(delete(Achievement).where(Achievement.home_id == home_id))

    if user_ids:
        db.exec(delete(UserRewardClaim).where(UserRewardClaim.user_id.in_(user_ids)))
        db.exec(delete(UserAchievement).where(UserAchievement.user_id.in_(user_ids)))
        db.exec(delete(UserTemplateSubscription).where(UserTemplateSubscription.user_id.in_(user_ids)))
        db.exec(delete(User).where(User.id.in_(user_ids)))

    db.delete(db_home)
    db.commit()
    return True
