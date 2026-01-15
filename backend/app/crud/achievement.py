from typing import List, Optional

from sqlmodel import Session, func, or_, select

from app.models.achievement import Achievement, AchievementCreate, UserAchievement
from app.models.quest import Quest
from app.models.user import User


def get_achievement(db: Session, achievement_id: int) -> Optional[Achievement]:
    """Get achievement by ID"""
    return db.exec(select(Achievement).where(Achievement.id == achievement_id)).first()


def get_home_achievements(db: Session, home_id: int) -> List[Achievement]:
    """Get all achievements available to a home (system + home-specific)"""
    return db.exec(
        select(Achievement).where(or_(Achievement.home_id == home_id, Achievement.is_system == True))
    ).all()


def get_user_achievements(db: Session, user_id: int) -> List[UserAchievement]:
    """Get all achievements unlocked by a user"""
    return db.exec(select(UserAchievement).where(UserAchievement.user_id == user_id)).all()


def has_user_achievement(db: Session, user_id: int, achievement_id: int) -> bool:
    """Check if user has already unlocked an achievement"""
    result = db.exec(
        select(UserAchievement)
        .where(UserAchievement.user_id == user_id)
        .where(UserAchievement.achievement_id == achievement_id)
    ).first()
    return result is not None


def create_achievement(db: Session, home_id: int, achievement_in: AchievementCreate, is_system: bool = False) -> Achievement:
    """Create a new achievement

    Args:
        db: Database session
        home_id: Home ID (ignored if is_system=True)
        achievement_in: Achievement data
        is_system: If True, creates a system-wide achievement (home_id will be None)
    """
    achievement_data = achievement_in.model_dump()
    achievement_data["is_system"] = is_system
    achievement_data["home_id"] = None if is_system else home_id

    db_achievement = Achievement(**achievement_data)
    db.add(db_achievement)
    db.commit()
    db.refresh(db_achievement)
    return db_achievement


def award_achievement(db: Session, user_id: int, achievement_id: int) -> Optional[UserAchievement]:
    """Award an achievement to a user (only if they don't already have it)"""
    # Check if user already has this achievement
    if has_user_achievement(db, user_id, achievement_id):
        return None

    # Verify achievement exists
    if not get_achievement(db, achievement_id):
        return None

    # Award achievement
    user_achievement = UserAchievement(user_id=user_id, achievement_id=achievement_id)
    db.add(user_achievement)
    db.commit()
    db.refresh(user_achievement)
    return user_achievement


def delete_achievement(db: Session, achievement_id: int) -> bool:
    """Delete achievement"""
    db_achievement = get_achievement(db, achievement_id)
    if not db_achievement:
        return False

    db.delete(db_achievement)
    db.commit()
    return True


# Helper functions to calculate user stats for achievement criteria


def get_user_quests_completed_count(db: Session, user_id: int) -> int:
    """Get total number of quests completed by a user"""
    result = db.exec(select(func.count(Quest.id)).where(Quest.user_id == user_id).where(Quest.completed == True)).first()
    return result or 0


def get_user_bounties_completed_count(db: Session, user_id: int) -> int:
    """Get total number of bounty quests completed by a user"""
    # A bounty quest is identified by quest_type = "bounty" in the template
    result = db.exec(
        select(func.count(Quest.id))
        .join(Quest.template)
        .where(Quest.user_id == user_id)
        .where(Quest.completed == True)
        .where(Quest.template.has(quest_type="bounty"))
    ).first()
    return result or 0


def check_and_award_achievements(db: Session, user_id: int) -> List[UserAchievement]:
    """
    Check if user has earned any new achievements based on their current stats.
    Returns list of newly awarded achievements.
    """
    # Get user and their stats
    user = db.exec(select(User).where(User.id == user_id)).first()
    if not user:
        return []

    # Get all achievements for this user's home
    home_achievements = get_home_achievements(db, user.home_id)

    newly_awarded = []

    for achievement in home_achievements:
        # Skip if user already has this achievement
        if has_user_achievement(db, user_id, achievement.id):
            continue

        # Check if user meets the criteria
        meets_criteria = False

        if achievement.criteria_type == "quests_completed":
            count = get_user_quests_completed_count(db, user_id)
            meets_criteria = count >= achievement.criteria_value

        elif achievement.criteria_type == "level_reached":
            meets_criteria = user.level >= achievement.criteria_value

        elif achievement.criteria_type == "gold_earned":
            # Note: This checks current gold balance, not total earned
            # For total earned, you'd need to track that separately
            meets_criteria = user.gold_balance >= achievement.criteria_value

        elif achievement.criteria_type == "xp_earned":
            meets_criteria = user.xp >= achievement.criteria_value

        elif achievement.criteria_type == "bounties_completed":
            count = get_user_bounties_completed_count(db, user_id)
            meets_criteria = count >= achievement.criteria_value

        # Award the achievement if criteria is met
        if meets_criteria:
            awarded = award_achievement(db, user_id, achievement.id)
            if awarded:
                newly_awarded.append(awarded)

    return newly_awarded


def create_default_achievements(db: Session, home_id: int = None) -> List[Achievement]:
    """
    Ensure default system achievements exist.

    This is idempotent - it only creates achievements if they don't already exist.
    System achievements are shared across all homes, so they're only created once.

    Args:
        db: Database session
        home_id: Ignored (kept for backward compatibility)

    Returns:
        List of system achievements (existing or newly created)
    """
    # Check if system achievements already exist
    existing_system = db.exec(select(Achievement).where(Achievement.is_system == True)).all()
    if existing_system:
        return existing_system

    # Define default system achievements
    default_achievements = [
        AchievementCreate(
            name="First Steps",
            description="Complete your first quest",
            criteria_type="quests_completed",
            criteria_value=1,
            icon="trophy-bronze",
        ),
        AchievementCreate(
            name="Quest Novice",
            description="Complete 10 quests",
            criteria_type="quests_completed",
            criteria_value=10,
            icon="trophy-silver",
        ),
        AchievementCreate(
            name="Rising Star",
            description="Reach level 5",
            criteria_type="level_reached",
            criteria_value=5,
            icon="star",
        ),
        AchievementCreate(
            name="Gold Digger",
            description="Earn 100 gold",
            criteria_type="gold_earned",
            criteria_value=100,
            icon="coin",
        ),
    ]

    # Create system achievements (home_id will be None)
    created = []
    for achievement_data in default_achievements:
        achievement = create_achievement(db, home_id=0, achievement_in=achievement_data, is_system=True)
        created.append(achievement)

    return created
