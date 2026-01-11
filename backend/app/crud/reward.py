from typing import List, Optional

from sqlmodel import Session, select

from app.models.reward import Reward, RewardCreate, UserRewardClaim


def get_reward(db: Session, reward_id: int) -> Optional[Reward]:
    """Get reward by ID"""
    return db.exec(select(Reward).where(Reward.id == reward_id)).first()


def get_home_rewards(db: Session, home_id: int) -> List[Reward]:
    """Get all rewards in a home"""
    return db.exec(select(Reward).where(Reward.home_id == home_id)).all()


def get_user_reward_claims(db: Session, user_id: int) -> List[UserRewardClaim]:
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
    """User claims a reward"""
    # Verify reward exists
    if not get_reward(db, reward_id):
        return None

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
