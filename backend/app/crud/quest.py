from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Session, select

from app.models.quest import Quest, QuestCreate, QuestCreateStandalone, QuestTemplate, QuestUpdate


def get_quest(db: Session, quest_id: int) -> Optional[Quest]:
    """Get quest by ID"""
    return db.exec(select(Quest).where(Quest.id == quest_id)).first()


def get_all_quests(db: Session) -> list[Quest]:
    """Get all quests"""
    return db.exec(select(Quest).order_by(Quest.created_at.desc())).all()


def get_quests_by_home(db: Session, home_id: int) -> list[Quest]:
    """Get all quests in a home"""
    return db.exec(select(Quest).where(Quest.home_id == home_id).order_by(Quest.created_at.desc())).all()


def get_quests_by_user(db: Session, home_id: int, user_id: int, completed: Optional[bool] = None) -> list[Quest]:
    """Get all quests for a user in a home, optionally filtered by completion status"""
    query = select(Quest).where((Quest.home_id == home_id) & (Quest.user_id == user_id))

    if completed is not None:
        query = query.where(Quest.completed == completed)

    return db.exec(query.order_by(Quest.created_at.desc())).all()


def create_quest(db: Session, home_id: int, user_id: int, quest_in: QuestCreate, template: QuestTemplate) -> Quest:
    """Create a new quest instance for a user from a template, snapshotting template data"""
    db_quest = Quest(
        home_id=home_id,
        user_id=user_id,
        quest_template_id=template.id,
        # Snapshot template data
        title=template.title,
        display_name=template.display_name,
        description=template.description,
        tags=template.tags,
        xp_reward=template.xp_reward,
        gold_reward=template.gold_reward,
        due_date=quest_in.due_date,
    )
    db.add(db_quest)
    db.commit()
    db.refresh(db_quest)
    return db_quest


def create_standalone_quest(db: Session, home_id: int, user_id: int, quest_in: QuestCreateStandalone) -> Quest:
    """Create a standalone quest without a template"""
    db_quest = Quest(
        home_id=home_id,
        user_id=user_id,
        quest_template_id=None,  # No template
        # Set fields directly from input
        title=quest_in.title,
        display_name=quest_in.display_name,
        description=quest_in.description,
        tags=quest_in.tags,
        xp_reward=quest_in.xp_reward,
        gold_reward=quest_in.gold_reward,
        due_date=quest_in.due_date,
    )
    db.add(db_quest)
    db.commit()
    db.refresh(db_quest)
    return db_quest


def complete_quest(
    db: Session, quest_id: int, final_xp: Optional[int] = None, final_gold: Optional[int] = None
) -> Optional[Quest]:
    """Mark quest as completed and update rewards to actual earned amounts"""
    db_quest = get_quest(db, quest_id)
    if not db_quest:
        return None

    db_quest.completed = True
    db_quest.completed_at = datetime.now(timezone.utc)
    # Update reward fields to actual earned amounts
    if final_xp is not None:
        db_quest.xp_reward = final_xp
    if final_gold is not None:
        db_quest.gold_reward = final_gold

    db.add(db_quest)
    db.commit()
    db.refresh(db_quest)
    return db_quest


def update_quest(db: Session, quest_id: int, quest_in: QuestUpdate) -> Optional[Quest]:
    """Update quest"""
    db_quest = get_quest(db, quest_id)
    if not db_quest:
        return None

    update_data = quest_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_quest, key, value)

    db.add(db_quest)
    db.commit()
    db.refresh(db_quest)
    return db_quest


def delete_quest(db: Session, quest_id: int) -> bool:
    """Delete quest"""
    db_quest = get_quest(db, quest_id)
    if not db_quest:
        return False

    db.delete(db_quest)
    db.commit()
    return True


def check_and_corrupt_overdue_quests(db: Session) -> list[Quest]:
    """
    Check for quests that are past their due date and not completed.
    Mark them as corrupted if they haven't been corrupted already.
    Returns list of newly corrupted quests.
    """
    now = datetime.now(timezone.utc)

    # Find quests that are:
    # - Not completed
    # - Have a due_date set
    # - Past their due_date
    # - Not already corrupted
    query = select(Quest).where(
        (Quest.completed == False)  # noqa: E712
        & (Quest.due_date.isnot(None))
        & (Quest.due_date < now)
        & (Quest.quest_type != "corrupted")
    )

    overdue_quests = db.exec(query).all()

    corrupted_quests = []
    for quest in overdue_quests:
        quest.quest_type = "corrupted"
        quest.corrupted_at = now
        db.add(quest)
        corrupted_quests.append(quest)

    if corrupted_quests:
        db.commit()

    return corrupted_quests
