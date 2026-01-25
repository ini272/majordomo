from typing import Optional

from sqlmodel import Session, select

from app.crud import user as crud_user
from app.errors import ErrorCode, create_error_detail
from app.models.reward import Reward, RewardCreate, UserRewardClaim


def get_reward(db: Session, reward_id: int) -> Optional[Reward]:
    """Get reward by ID"""
    return db.exec(select(Reward).where(Reward.id == reward_id)).first()


def get_home_rewards(db: Session, home_id: int) -> list[Reward]:
    """Get all rewards in a home"""
    return db.exec(select(Reward).where(Reward.home_id == home_id)).all()


def get_user_reward_claims(db: Session, user_id: int) -> list[UserRewardClaim]:
    """Get all reward claims for a user"""
    return db.exec(select(UserRewardClaim).where(UserRewardClaim.user_id == user_id)).all()


def create_reward(db: Session, home_id: int, reward_in: RewardCreate) -> Reward:
    """Create a new reward in a home"""
    db_reward = Reward(**reward_in.model_dump(), home_id=home_id)
    db.add(db_reward)
    db.commit()
    db.refresh(db_reward)
    return db_reward


def claim_reward(db: Session, user_id: int, reward_id: int) -> Optional[UserRewardClaim]:
    """
    User claims a reward.

    Validates:
    - Reward exists
    - User has sufficient gold balance

    Deducts reward cost from user's gold balance.

    Raises:
        ValueError: If user has insufficient gold (caught by route handler)

    Returns:
        UserRewardClaim if successful, None if reward not found
    """
    # Verify reward exists
    reward = get_reward(db, reward_id)
    if not reward:
        return None

    # Verify user has sufficient gold
    user = crud_user.get_user(db, user_id)
    if not user:
        return None

    if user.gold_balance < reward.cost:
        raise ValueError(
            create_error_detail(
                ErrorCode.INSUFFICIENT_GOLD,
                details={
                    "required": reward.cost,
                    "current": user.gold_balance,
                    "user_id": user_id,
                    "reward_id": reward_id,
                },
            )
        )

    # Deduct gold using add_gold helper (safe, handles validation)
    crud_user.add_gold(db, user_id, -reward.cost)

    # Create claim record
    claim = UserRewardClaim(user_id=user_id, reward_id=reward_id)
    db.add(claim)
    db.commit()
    db.refresh(claim)
    return claim


def delete_reward(db: Session, reward_id: int) -> bool:
    """Delete reward"""
    db_reward = get_reward(db, reward_id)
    if not db_reward:
        return False

    db.delete(db_reward)
    db.commit()
    return True
