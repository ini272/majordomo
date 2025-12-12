from typing import Optional, List
from sqlmodel import select, Session
from app.models.reward import Reward, RewardCreate, UserRewardClaim, UserRewardClaimCreate


def create_reward(db: Session, reward_in: RewardCreate) -> Reward:
    """Create a new reward"""
    db_reward = Reward(**reward_in.model_dump())
    db.add(db_reward)
    db.commit()
    db.refresh(db_reward)
    return db_reward


def get_reward(db: Session, reward_id: int) -> Optional[Reward]:
    """Get reward by ID"""
    return db.exec(select(Reward).where(Reward.id == reward_id)).first()


def get_all_rewards(db: Session) -> List[Reward]:
    """Get all rewards"""
    return db.exec(select(Reward)).all()


def delete_reward(db: Session, reward_id: int) -> bool:
    """Delete reward"""
    db_reward = get_reward(db, reward_id)
    if not db_reward:
        return False
    
    db.delete(db_reward)
    db.commit()
    return True


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


def get_user_reward_claims(db: Session, user_id: int) -> List[UserRewardClaim]:
    """Get all reward claims for a user"""
    return db.exec(
        select(UserRewardClaim).where(UserRewardClaim.user_id == user_id)
    ).all()
