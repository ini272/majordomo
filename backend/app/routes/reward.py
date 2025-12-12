from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session
from app.database import get_db
from app.models.reward import Reward, RewardCreate, RewardRead, UserRewardClaimCreate, UserRewardClaimRead
from app.crud import reward as crud_reward
from app.crud import user as crud_user

router = APIRouter(prefix="/api/rewards", tags=["rewards"])


@router.post("", response_model=RewardRead)
def create_reward(reward: RewardCreate, db: Session = Depends(get_db)):
    """Create a new reward"""
    return crud_reward.create_reward(db, reward)


@router.get("/{reward_id}", response_model=RewardRead)
def get_reward(reward_id: int, db: Session = Depends(get_db)):
    """Get reward by ID"""
    reward = crud_reward.get_reward(db, reward_id)
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    return reward


@router.get("", response_model=List[RewardRead])
def get_all_rewards(db: Session = Depends(get_db)):
    """Get all rewards"""
    return crud_reward.get_all_rewards(db)


@router.delete("/{reward_id}")
def delete_reward(reward_id: int, db: Session = Depends(get_db)):
    """Delete reward"""
    if not crud_reward.delete_reward(db, reward_id):
        raise HTTPException(status_code=404, detail="Reward not found")
    
    return {"detail": "Reward deleted"}


@router.post("/{reward_id}/claim", response_model=UserRewardClaimRead)
def claim_reward(
    reward_id: int,
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """User claims a reward"""
    # Verify user exists
    if not crud_user.get_user(db, user_id):
        raise HTTPException(status_code=404, detail="User not found")
    
    claim = crud_reward.claim_reward(db, user_id, reward_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    return claim


@router.get("/user/{user_id}/claims", response_model=list[UserRewardClaimRead])
def get_user_reward_claims(user_id: int, db: Session = Depends(get_db)):
    """Get all reward claims for a user"""
    # Verify user exists
    if not crud_user.get_user(db, user_id):
        raise HTTPException(status_code=404, detail="User not found")
    
    return crud_reward.get_user_reward_claims(db, user_id)
