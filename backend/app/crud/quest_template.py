from typing import List, Optional

from sqlmodel import Session, select

from app.models.quest import QuestTemplate, QuestTemplateCreate, QuestTemplateUpdate


def get_quest_template(db: Session, template_id: int) -> Optional[QuestTemplate]:
    """Get quest template by ID"""
    return db.exec(select(QuestTemplate).where(QuestTemplate.id == template_id)).first()


def get_home_quest_templates(db: Session, home_id: int, system: Optional[bool] = None) -> List[QuestTemplate]:
    """Get all quest templates for a home (optionally filtered by system)"""
    query = select(QuestTemplate).where(QuestTemplate.home_id == home_id)

    if system is not None:
        query = query.where(QuestTemplate.system == system)

    return db.exec(query.order_by(QuestTemplate.created_at.desc())).all()


def create_quest_template(
    db: Session, home_id: int, created_by: int, template_in: QuestTemplateCreate
) -> QuestTemplate:
    """Create a new quest template"""
    db_template = QuestTemplate(**template_in.model_dump(), home_id=home_id, created_by=created_by, system=False)
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template


def update_quest_template(db: Session, template_id: int, template_in: QuestTemplateUpdate) -> Optional[QuestTemplate]:
    """Update quest template"""
    db_template = get_quest_template(db, template_id)
    if not db_template:
        return None

    update_data = template_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_template, key, value)

    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template


def delete_quest_template(db: Session, template_id: int) -> bool:
    """Delete quest template"""
    db_template = get_quest_template(db, template_id)
    if not db_template:
        return False

    db.delete(db_template)
    db.commit()
    return True
