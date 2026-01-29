from typing import Optional

from sqlmodel import Session, select

from app.models.quest import (
    UserTemplateSubscription,
    UserTemplateSubscriptionCreate,
    UserTemplateSubscriptionUpdate,
)


def get_subscription(db: Session, subscription_id: int) -> Optional[UserTemplateSubscription]:
    """Get subscription by ID"""
    return db.exec(
        select(UserTemplateSubscription).where(UserTemplateSubscription.id == subscription_id)
    ).first()


def get_user_subscriptions(db: Session, user_id: int, active_only: bool = False) -> list[UserTemplateSubscription]:
    """Get all subscriptions for a user"""
    query = select(UserTemplateSubscription).where(UserTemplateSubscription.user_id == user_id)

    if active_only:
        query = query.where(UserTemplateSubscription.is_active == True)  # noqa: E712

    return list(db.exec(query.order_by(UserTemplateSubscription.created_at.desc())).all())


def get_subscription_by_user_template(
    db: Session, user_id: int, template_id: int
) -> Optional[UserTemplateSubscription]:
    """Get subscription for a specific user and template"""
    return db.exec(
        select(UserTemplateSubscription)
        .where(UserTemplateSubscription.user_id == user_id)
        .where(UserTemplateSubscription.quest_template_id == template_id)
    ).first()


def create_subscription(
    db: Session, user_id: int, subscription_in: UserTemplateSubscriptionCreate
) -> UserTemplateSubscription:
    """Create a new subscription for a user"""
    db_subscription = UserTemplateSubscription(
        user_id=user_id,
        quest_template_id=subscription_in.quest_template_id,
        recurrence=subscription_in.recurrence,
        schedule=subscription_in.schedule,
        due_in_hours=subscription_in.due_in_hours,
    )
    db.add(db_subscription)
    db.commit()
    db.refresh(db_subscription)
    return db_subscription


def update_subscription(
    db: Session, subscription_id: int, subscription_in: UserTemplateSubscriptionUpdate
) -> Optional[UserTemplateSubscription]:
    """Update subscription"""
    db_subscription = get_subscription(db, subscription_id)
    if not db_subscription:
        return None

    update_data = subscription_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_subscription, key, value)

    db.add(db_subscription)
    db.commit()
    db.refresh(db_subscription)
    return db_subscription


def delete_subscription(db: Session, subscription_id: int) -> bool:
    """Delete subscription"""
    db_subscription = get_subscription(db, subscription_id)
    if not db_subscription:
        return False

    db.delete(db_subscription)
    db.commit()
    return True
