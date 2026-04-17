from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import delete
from sqlmodel import Session, select

from app.models.quest import Quest, QuestCreate, QuestCreateStandalone, QuestParticipant, QuestTemplate, QuestUpdate


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
    """Get all quests where a user is a participant, optionally filtered by completion status"""
    query = (
        select(Quest)
        .join(QuestParticipant, QuestParticipant.quest_id == Quest.id)
        .where((Quest.home_id == home_id) & (QuestParticipant.user_id == user_id))
    )

    if completed is not None:
        query = query.where(Quest.completed == completed)

    return db.exec(query.order_by(Quest.created_at.desc())).all()


def _dedupe_user_ids(user_ids: list[int]) -> list[int]:
    """
    Preserve request order while removing duplicate user IDs.

    API clients can send duplicate participant IDs. Collapsing them here avoids
    unique-constraint failures and prevents duplicated reward shares while keeping
    the first selected user as the legacy primary participant.
    """
    seen: set[int] = set()
    deduped: list[int] = []
    for user_id in user_ids:
        if user_id in seen:
            continue
        seen.add(user_id)
        deduped.append(user_id)
    return deduped


def get_quest_participants(db: Session, quest_id: int) -> list[QuestParticipant]:
    """Get all participants for a quest."""
    return db.exec(
        select(QuestParticipant)
        .where(QuestParticipant.quest_id == quest_id)
        .order_by(QuestParticipant.id)
    ).all()


def ensure_quest_participants(db: Session, quest: Quest) -> list[QuestParticipant]:
    """
    Ensure a quest has participant rows.

    Existing production data is backfilled at startup, but this protects direct
    model-created test data and any legacy rows created before the new table.
    """
    if quest.id is None:
        return []

    participants = get_quest_participants(db, quest.id)
    if participants or quest.user_id is None:
        return participants

    participant = QuestParticipant(
        quest_id=quest.id,
        user_id=quest.user_id,
        xp_awarded=quest.xp_reward if quest.completed else None,
        gold_awarded=quest.gold_reward if quest.completed else None,
        completed_at=quest.completed_at if quest.completed else None,
    )
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return [participant]


def replace_quest_participants(db: Session, quest: Quest, participant_user_ids: list[int]) -> list[QuestParticipant]:
    """
    Replace the users participating in a quest and keep legacy Quest.user_id aligned.

    Quest.user_id is no longer the sole assignee; it is the primary participant
    retained for older API callers and UI paths that still expect a single user.
    """
    if quest.id is None:
        raise ValueError("Quest must be persisted before participants can be assigned")

    deduped_user_ids = _dedupe_user_ids(participant_user_ids)
    if not deduped_user_ids:
        raise ValueError("Quest requires at least one participant")

    db.exec(delete(QuestParticipant).where(QuestParticipant.quest_id == quest.id))

    participants = [
        QuestParticipant(quest_id=quest.id, user_id=participant_user_id)
        for participant_user_id in deduped_user_ids
    ]
    for participant in participants:
        db.add(participant)

    quest.user_id = deduped_user_ids[0]
    db.add(quest)
    db.flush()
    return participants


def create_quest(
    db: Session, home_id: int, created_by: int, participant_user_ids: list[int], quest_in: QuestCreate, template: QuestTemplate
) -> Quest:
    """Create a new quest instance for participants from a template, snapshotting template data"""
    primary_user_id = participant_user_ids[0]
    db_quest = Quest(
        home_id=home_id,
        created_by=created_by,
        user_id=primary_user_id,
        quest_template_id=template.id,
        # Snapshot template data
        title=template.title,
        display_name=template.display_name,
        description=template.description,
        tags=template.tags,
        xp_reward=template.xp_reward,
        gold_reward=template.gold_reward,
        recurrence=template.recurrence,
        schedule=template.schedule,
        due_in_hours=template.due_in_hours,
    )
    db.add(db_quest)
    db.flush()
    replace_quest_participants(db, db_quest, participant_user_ids)
    db.commit()
    db.refresh(db_quest)
    return db_quest


def create_standalone_quest(
    db: Session, home_id: int, created_by: int, participant_user_ids: list[int], quest_in: QuestCreateStandalone
) -> Quest:
    """Create a standalone quest without a template"""
    primary_user_id = participant_user_ids[0]
    db_quest = Quest(
        home_id=home_id,
        created_by=created_by,
        user_id=primary_user_id,
        quest_template_id=None,  # No template
        # Set fields directly from input
        title=quest_in.title,
        display_name=quest_in.display_name,
        description=quest_in.description,
        tags=quest_in.tags,
        xp_reward=quest_in.xp_reward,
        gold_reward=quest_in.gold_reward,
        due_in_hours=quest_in.due_in_hours,
    )
    db.add(db_quest)
    db.flush()
    replace_quest_participants(db, db_quest, participant_user_ids)
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
    participant_user_ids = update_data.pop("participant_user_ids", None)
    if participant_user_ids is None and update_data.get("user_id") is not None:
        participant_user_ids = [update_data["user_id"]]

    for key, value in update_data.items():
        setattr(db_quest, key, value)

    db.add(db_quest)
    if participant_user_ids is not None:
        replace_quest_participants(db, db_quest, participant_user_ids)
    db.commit()
    db.refresh(db_quest)
    return db_quest


def delete_quest(db: Session, quest_id: int) -> bool:
    """Delete quest"""
    db_quest = get_quest(db, quest_id)
    if not db_quest:
        return False

    db.exec(delete(QuestParticipant).where(QuestParticipant.quest_id == quest_id))
    db.delete(db_quest)
    db.commit()
    return True


def check_and_corrupt_overdue_quests(db: Session) -> list[Quest]:
    """
    Check for quests that are past their due time and not completed.
    Mark them as corrupted if they haven't been corrupted already.
    Returns list of newly corrupted quests.
    """
    from datetime import timedelta

    now = datetime.now(timezone.utc)

    # Find quests that are:
    # - Not completed
    # - Have due_in_hours set
    # - Past their deadline (created_at + due_in_hours)
    # - Not already corrupted
    query = select(Quest).where(
        (Quest.completed == False)  # noqa: E712
        & (Quest.due_in_hours.isnot(None))
        & (Quest.quest_type != "corrupted")
    )

    all_quests_with_deadline = db.exec(query).all()

    corrupted_quests = []
    for quest in all_quests_with_deadline:
        # Calculate deadline from created_at + due_in_hours
        # Ensure created_at is timezone-aware
        created_at = quest.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)

        deadline = created_at + timedelta(hours=quest.due_in_hours)
        if deadline < now:
            quest.quest_type = "corrupted"
            quest.corrupted_at = now
            db.add(quest)
            corrupted_quests.append(quest)

    if corrupted_quests:
        db.commit()

    return corrupted_quests
