
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.auth import get_current_user
from app.crud import reward as crud_reward
from app.crud import user as crud_user
from app.database import get_db
from app.errors import ErrorCode, create_error_detail
from app.models.reward import RewardCreate, RewardRead, UserRewardClaimRead

router = APIRouter(prefix="/api/rewards", tags=["rewards"])


# GET endpoints
@router.get("", response_model=list[RewardRead])
def get_home_rewards(db: Session = Depends(get_db), auth: dict = Depends(get_current_user)):
    """Get all rewards in the authenticated user's home"""
    return crud_reward.get_home_rewards(db, auth["home_id"])


@router.get("/{reward_id}", response_model=RewardRead)
def get_reward(reward_id: int, db: Session = Depends(get_db), auth: dict = Depends(get_current_user)):
    """Get reward by ID"""
    reward = crud_reward.get_reward(db, reward_id)
    if not reward or reward.home_id != auth["home_id"]:
        raise HTTPException(
            status_code=404, detail=create_error_detail(ErrorCode.REWARD_NOT_FOUND, details={"reward_id": reward_id})
        )

    return reward


@router.get("/user/{user_id}/claims", response_model=list[UserRewardClaimRead])
def get_user_reward_claims(user_id: int, db: Session = Depends(get_db), auth: dict = Depends(get_current_user)):
    """Get all reward claims for a user"""
    # Verify user exists and belongs to authenticated home
    user = crud_user.get_user(db, user_id)
    if not user or user.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="User not found")

    return crud_reward.get_user_reward_claims(db, user_id)


# POST endpoints
@router.post("", response_model=RewardRead)
def create_reward(reward: RewardCreate, db: Session = Depends(get_db), auth: dict = Depends(get_current_user)):
    """Create a new reward in the authenticated user's home"""
    return crud_reward.create_reward(db, auth["home_id"], reward)


@router.post("/{reward_id}/claim", response_model=UserRewardClaimRead)
def claim_reward(
    reward_id: int, user_id: int = Query(...), db: Session = Depends(get_db), auth: dict = Depends(get_current_user)
):
    """
    User claims a reward.

    Validates user has sufficient gold balance and deducts the reward cost.

    Args:
        reward_id: ID of the reward to claim
        user_id: ID of the user claiming the reward

    Returns:
        UserRewardClaimRead: Created claim record

    Raises:
        404: User or reward not found, or not in authenticated home
        400: Insufficient gold balance (returns INSUFFICIENT_GOLD error code)
    """
    # Verify user exists and belongs to authenticated home
    user = crud_user.get_user(db, user_id)
    if not user or user.home_id != auth["home_id"]:
        raise HTTPException(
            status_code=404, detail=create_error_detail(ErrorCode.USER_NOT_FOUND, details={"user_id": user_id})
        )

    # Verify reward exists and belongs to same home
    reward = crud_reward.get_reward(db, reward_id)
    if not reward or reward.home_id != auth["home_id"]:
        raise HTTPException(
            status_code=404, detail=create_error_detail(ErrorCode.REWARD_NOT_FOUND, details={"reward_id": reward_id})
        )

    try:
        claim = crud_reward.claim_reward(db, user_id, reward_id)
    except ValueError as e:
        # ValueError from add_gold (insufficient gold)
        # e.args[0] is the error_detail dict from create_error_detail()
        error_detail = e.args[0]
        raise HTTPException(status_code=400, detail=error_detail)

    if not claim:
        raise HTTPException(
            status_code=400,
            detail=create_error_detail(
                ErrorCode.INVALID_INPUT,
                message="Failed to claim reward",
                details={"user_id": user_id, "reward_id": reward_id},
            ),
        )

    return claim


# DELETE endpoints
@router.delete("/{reward_id}")
def delete_reward(reward_id: int, db: Session = Depends(get_db), auth: dict = Depends(get_current_user)):
    """Delete reward"""
    reward = crud_reward.get_reward(db, reward_id)
    if not reward or reward.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="Reward not found")

    if not crud_reward.delete_reward(db, reward_id):
        raise HTTPException(status_code=404, detail="Failed to delete reward")

    return {"detail": "Reward deleted"}
