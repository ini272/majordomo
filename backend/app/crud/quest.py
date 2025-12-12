from datetime import datetime, timezone
from typing import Optional, List
from sqlmodel import select, Session
from app.models.quest import Quest, QuestCreate, QuestUpdate


def create_quest(db: Session, user_id: int, quest_in: QuestCreate) -> Quest:
    """Create a new quest for a user"""
    db_quest = Quest(**quest_in.model_dump(), user_id=user_id)
    db.add(db_quest)
    db.commit()
    db.refresh(db_quest)
    return db_quest


def get_quest(db: Session, quest_id: int) -> Optional[Quest]:
    """Get quest by ID"""
    return db.exec(select(Quest).where(Quest.id == quest_id)).first()


def get_all_quests(db: Session) -> List[Quest]:
    """Get all quests"""
    return db.exec(select(Quest).order_by(Quest.created_at.desc())).all()


def get_quests_by_user(db: Session, user_id: int, completed: Optional[bool] = None) -> List[Quest]:
    """Get all quests for a user, optionally filtered by completion status"""
    query = select(Quest).where(Quest.user_id == user_id)
    
    if completed is not None:
        query = query.where(Quest.completed == completed)
    
    return db.exec(query.order_by(Quest.created_at.desc())).all()


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


def complete_quest(db: Session, quest_id: int) -> Optional[Quest]:
    """Mark quest as completed"""
    db_quest = get_quest(db, quest_id)
    if not db_quest:
        return None
    
    db_quest.completed = True
    db_quest.completed_at = datetime.now(timezone.utc)
    
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
