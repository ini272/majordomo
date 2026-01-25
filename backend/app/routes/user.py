
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.auth import get_current_user
from app.crud import user as crud_user
from app.database import get_db
from app.models.user import UserRead, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])


# GET endpoints
@router.get("/me", response_model=UserRead)
def get_current_user_stats(db: Session = Depends(get_db), auth: dict = Depends(get_current_user)):
    """Get current authenticated user's stats"""
    user = crud_user.get_user(db, auth["user_id"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("", response_model=list[UserRead])
def get_all_users(db: Session = Depends(get_db), auth: dict = Depends(get_current_user)):
    """Get all users in the authenticated user's home"""
    return crud_user.get_home_users(db, auth["home_id"])


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: int, db: Session = Depends(get_db), auth: dict = Depends(get_current_user)):
    """Get user by ID"""
    user = crud_user.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify user belongs to authenticated home
    if user.home_id != auth["home_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to access this user")

    return user


# POST endpoints
@router.post("/{user_id}/xp")
def add_xp_to_user(
    user_id: int, amount: int = Query(..., ge=0), db: Session = Depends(get_db), auth: dict = Depends(get_current_user)
):
    """Add XP to user"""
    user = crud_user.get_user(db, user_id)
    if not user or user.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="User not found")

    user = crud_user.add_xp(db, user_id, amount)
    return user


@router.post("/{user_id}/gold")
def add_gold_to_user(
    user_id: int, amount: int = Query(..., ge=0), db: Session = Depends(get_db), auth: dict = Depends(get_current_user)
):
    """Add gold to user"""
    user = crud_user.get_user(db, user_id)
    if not user or user.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="User not found")

    user = crud_user.add_gold(db, user_id, amount)
    return user


# PUT endpoints
@router.put("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int, user_update: UserUpdate, db: Session = Depends(get_db), auth: dict = Depends(get_current_user)
):
    """Update user"""
    user = crud_user.get_user(db, user_id)
    if not user or user.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="User not found")

    user = crud_user.update_user(db, user_id, user_update)
    return user


# DELETE endpoints
@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), auth: dict = Depends(get_current_user)):
    """Delete user"""
    user = crud_user.get_user(db, user_id)
    if not user or user.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="User not found")

    if not crud_user.delete_user(db, user_id):
        raise HTTPException(status_code=404, detail="Failed to delete user")

    return {"detail": "User deleted"}
