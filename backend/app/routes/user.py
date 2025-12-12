from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session
from app.database import get_db
from app.models.user import User, UserCreate, UserRead, UserUpdate
from app.crud import user as crud_user

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("", response_model=UserRead)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    """Create a new user"""
    existing_user = crud_user.get_user_by_username(db, user.username)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    return crud_user.create_user(db, user)


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: int, db: Session = Depends(get_db)):
    """Get user by ID"""
    user = crud_user.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user


@router.get("", response_model=List[UserRead])
def get_all_users(db: Session = Depends(get_db)):
    """Get all users"""
    return crud_user.get_all_users(db)


@router.put("/{user_id}", response_model=UserRead)
def update_user(user_id: int, user_update: UserUpdate, db: Session = Depends(get_db)):
    """Update user"""
    user = crud_user.update_user(db, user_id, user_update)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    """Delete user"""
    if not crud_user.delete_user(db, user_id):
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"detail": "User deleted"}


@router.post("/{user_id}/xp")
def add_xp_to_user(user_id: int, amount: int = Query(..., ge=0), db: Session = Depends(get_db)):
    """Add XP to user"""
    user = crud_user.add_xp(db, user_id, amount)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user


@router.post("/{user_id}/gold")
def add_gold_to_user(user_id: int, amount: int = Query(..., ge=0), db: Session = Depends(get_db)):
    """Add gold to user"""
    user = crud_user.add_gold(db, user_id, amount)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user
