from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.auth import get_current_user
from app.crud import reward as crud_reward
from app.crud import user as crud_user
from app.database import get_db
from app.models.reward import RewardCreate, RewardRead, UserRewardClaimRead

router = APIRouter(prefix="/api/rewards", tags=["rewards"])


# GET endpoints
@router.get("", response_model=List[RewardRead])
def get_home_rewards(db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Get all rewards in the authenticated user's home"""
    return crud_reward.get_home_rewards(db, auth["home_id"])


@router.get("/{reward_id}", response_model=RewardRead)
def get_reward(reward_id: int, db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Get reward by ID"""
    reward = crud_reward.get_reward(db, reward_id)
    if not reward or reward.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="Reward not found")

    return reward


@router.get("/user/{user_id}/claims", response_model=list[UserRewardClaimRead])
def get_user_reward_claims(user_id: int, db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Get all reward claims for a user"""
    # Verify user exists and belongs to authenticated home
    user = crud_user.get_user(db, user_id)
    if not user or user.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="User not found")

    return crud_reward.get_user_reward_claims(db, user_id)


# POST endpoints
@router.post("", response_model=RewardRead)
def create_reward(reward: RewardCreate, db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Create a new reward in the authenticated user's home"""
    return crud_reward.create_reward(db, auth["home_id"], reward)


@router.post("/{reward_id}/claim", response_model=UserRewardClaimRead)
def claim_reward(
    reward_id: int, user_id: int = Query(...), db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)
):
    """User claims a reward"""
    # Verify user exists and belongs to authenticated home
    user = crud_user.get_user(db, user_id)
    if not user or user.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify reward exists and belongs to same home
    reward = crud_reward.get_reward(db, reward_id)
    if not reward or reward.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="Reward not found")

    claim = crud_reward.claim_reward(db, user_id, reward_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Failed to claim reward")

    return claim


# DELETE endpoints
@router.delete("/{reward_id}")
def delete_reward(reward_id: int, db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Delete reward"""
    reward = crud_reward.get_reward(db, reward_id)
    if not reward or reward.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="Reward not found")

    if not crud_reward.delete_reward(db, reward_id):
        raise HTTPException(status_code=404, detail="Failed to delete reward")

    return {"detail": "Reward deleted"}
