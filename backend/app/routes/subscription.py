from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.auth import get_current_user
from app.crud import subscription as crud_subscription
from app.crud import quest_template as crud_quest_template
from app.crud import user as crud_user
from app.database import get_db
from app.models.quest import (
    UserTemplateSubscriptionCreate,
    UserTemplateSubscriptionRead,
    UserTemplateSubscriptionUpdate,
)

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])


@router.get("", response_model=list[UserTemplateSubscriptionRead])
def get_my_subscriptions(
    active_only: bool = False,
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
):
    """Get all subscriptions for the authenticated user"""
    user_id = auth["user_id"]
    subscriptions = crud_subscription.get_user_subscriptions(db, user_id, active_only=active_only)

    # Load template data for each subscription
    result = []
    for sub in subscriptions:
        sub_dict = sub.model_dump()
        # Load template if it exists
        if sub.template:
            sub_dict["template"] = sub.template
        result.append(UserTemplateSubscriptionRead(**sub_dict))

    return result


@router.get("/{subscription_id}", response_model=UserTemplateSubscriptionRead)
def get_subscription(
    subscription_id: int,
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
):
    """Get a specific subscription"""
    user_id = auth["user_id"]
    subscription = crud_subscription.get_subscription(db, subscription_id)

    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    # Verify ownership
    if subscription.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this subscription")

    return subscription


@router.post("", response_model=UserTemplateSubscriptionRead, status_code=201)
def create_subscription(
    subscription: UserTemplateSubscriptionCreate,
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
):
    """Subscribe to a template with personalized schedule"""
    user_id = auth["user_id"]
    home_id = auth["home_id"]

    # Verify template exists and belongs to user's home
    template = crud_quest_template.get_quest_template(db, subscription.quest_template_id)
    if not template or template.home_id != home_id:
        raise HTTPException(status_code=404, detail="Quest template not found in home")

    # Check if subscription already exists
    existing = crud_subscription.get_subscription_by_user_template(
        db, user_id, subscription.quest_template_id
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="You are already subscribed to this template. Update the existing subscription instead.",
        )

    return crud_subscription.create_subscription(db, user_id, subscription)


@router.patch("/{subscription_id}", response_model=UserTemplateSubscriptionRead)
def update_subscription(
    subscription_id: int,
    subscription_update: UserTemplateSubscriptionUpdate,
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
):
    """Update subscription schedule or pause/resume"""
    user_id = auth["user_id"]

    # Verify subscription exists and user owns it
    existing = crud_subscription.get_subscription(db, subscription_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if existing.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this subscription")

    updated = crud_subscription.update_subscription(db, subscription_id, subscription_update)
    if not updated:
        raise HTTPException(status_code=404, detail="Subscription not found")

    return updated


@router.delete("/{subscription_id}", status_code=204)
def delete_subscription(
    subscription_id: int,
    db: Session = Depends(get_db),
    auth: dict = Depends(get_current_user),
):
    """Unsubscribe from a template"""
    user_id = auth["user_id"]

    # Verify subscription exists and user owns it
    existing = crud_subscription.get_subscription(db, subscription_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if existing.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this subscription")

    success = crud_subscription.delete_subscription(db, subscription_id)
    if not success:
        raise HTTPException(status_code=404, detail="Subscription not found")

    return None
