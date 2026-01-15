from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.auth import get_current_user
from app.crud import achievement as crud_achievement
from app.crud import user as crud_user
from app.database import get_db
from app.models.achievement import (
    AchievementCreate,
    AchievementRead,
    UserAchievementRead,
    UserAchievementWithDetails,
)

router = APIRouter(prefix="/api/achievements", tags=["achievements"])


# GET endpoints
@router.get("", response_model=List[AchievementRead])
def get_home_achievements(db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Get all achievements in the authenticated user's home"""
    return crud_achievement.get_home_achievements(db, auth["home_id"])


@router.get("/{achievement_id}", response_model=AchievementRead)
def get_achievement(achievement_id: int, db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Get achievement by ID"""
    achievement = crud_achievement.get_achievement(db, achievement_id)
    if not achievement:
        raise HTTPException(status_code=404, detail="Achievement not found")

    # Allow access to system achievements or achievements from user's home
    if not achievement.is_system and achievement.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="Achievement not found")

    return achievement


@router.get("/users/{user_id}/achievements", response_model=List[UserAchievementWithDetails])
def get_user_achievements(user_id: int, db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Get all achievements unlocked by a user, with full achievement details"""
    # Verify user exists and belongs to authenticated home
    user = crud_user.get_user(db, user_id)
    if not user or user.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="User not found")

    # Get user achievements
    user_achievements = crud_achievement.get_user_achievements(db, user_id)

    # Build response with achievement details
    result = []
    for ua in user_achievements:
        achievement = crud_achievement.get_achievement(db, ua.achievement_id)
        if achievement:
            result.append(
                UserAchievementWithDetails(
                    id=ua.id,
                    user_id=ua.user_id,
                    achievement_id=ua.achievement_id,
                    unlocked_at=ua.unlocked_at,
                    achievement=AchievementRead.model_validate(achievement),
                )
            )

    return result


# Convenience endpoint for current user
@router.get("/me/achievements", response_model=List[UserAchievementWithDetails])
def get_my_achievements(db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Get all achievements unlocked by the authenticated user"""
    return get_user_achievements(auth["user_id"], db, auth)


# POST endpoints
@router.post("", response_model=AchievementRead)
def create_achievement(achievement: AchievementCreate, db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Create a new achievement in the authenticated user's home"""
    return crud_achievement.create_achievement(db, auth["home_id"], achievement)


@router.post("/{achievement_id}/award/{user_id}", response_model=UserAchievementRead)
def award_achievement(
    achievement_id: int, user_id: int, db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)
):
    """Manually award an achievement to a user"""
    # Verify user exists and belongs to authenticated home
    user = crud_user.get_user(db, user_id)
    if not user or user.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify achievement exists and belongs to same home
    achievement = crud_achievement.get_achievement(db, achievement_id)
    if not achievement or achievement.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="Achievement not found")

    # Check if user already has this achievement
    if crud_achievement.has_user_achievement(db, user_id, achievement_id):
        raise HTTPException(status_code=400, detail="User already has this achievement")

    # Award achievement
    awarded = crud_achievement.award_achievement(db, user_id, achievement_id)
    if not awarded:
        raise HTTPException(status_code=400, detail="Failed to award achievement")

    return awarded


@router.post("/users/{user_id}/check", response_model=List[UserAchievementRead])
def check_user_achievements(user_id: int, db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """
    Check if user has earned any new achievements and award them automatically.
    Returns list of newly awarded achievements.
    """
    # Verify user exists and belongs to authenticated home
    user = crud_user.get_user(db, user_id)
    if not user or user.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="User not found")

    # Check and award achievements
    newly_awarded = crud_achievement.check_and_award_achievements(db, user_id)

    return newly_awarded


# DELETE endpoints
@router.delete("/{achievement_id}")
def delete_achievement(achievement_id: int, db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Delete achievement"""
    achievement = crud_achievement.get_achievement(db, achievement_id)
    if not achievement or achievement.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="Achievement not found")

    if not crud_achievement.delete_achievement(db, achievement_id):
        raise HTTPException(status_code=400, detail="Failed to delete achievement")

    return {"detail": "Achievement deleted"}
