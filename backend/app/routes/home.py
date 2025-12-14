from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from app.database import get_db
from app.models.home import Home, HomeCreate, HomeRead, HomeJoin
from app.models.user import User, UserCreate, UserRead
from app.crud import home as crud_home
from app.crud import user as crud_user

router = APIRouter(prefix="/api/homes", tags=["homes"])


# GET endpoints
@router.get("", response_model=List[HomeRead])
def get_all_homes(db: Session = Depends(get_db)):
    """Get all homes"""
    return crud_home.get_all_homes(db)


@router.get("/{home_id}", response_model=HomeRead)
def get_home(home_id: int, db: Session = Depends(get_db)):
    """Get home by ID"""
    home = crud_home.get_home(db, home_id)
    if not home:
        raise HTTPException(status_code=404, detail="Home not found")
    
    return home


@router.get("/{home_id}/users", response_model=List[UserRead])
def get_home_users(home_id: int, db: Session = Depends(get_db)):
    """Get all users in a home"""
    home = crud_home.get_home(db, home_id)
    if not home:
        raise HTTPException(status_code=404, detail="Home not found")
    
    return crud_user.get_home_users(db, home_id)


# POST endpoints
@router.post("", response_model=HomeRead)
def create_home(home: HomeCreate, db: Session = Depends(get_db)):
    """Create a new home"""
    return crud_home.create_home(db, home)


@router.post("/{home_id}/join", response_model=UserRead)
def join_home(home_id: int, user: UserCreate, db: Session = Depends(get_db)):
    """Join a home"""
    home = crud_home.get_home(db, home_id)
    if not home:
        raise HTTPException(status_code=404, detail="Home not found")
    
    # Check if username already exists in this home
    existing_user = crud_user.get_user_by_username(db, home_id, user.username)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists in this home")
    
    return crud_user.create_user(db, home_id, user)


# DELETE endpoints
@router.delete("/{home_id}")
def delete_home(home_id: int, db: Session = Depends(get_db)):
    """Delete a home"""
    if not crud_home.delete_home(db, home_id):
        raise HTTPException(status_code=404, detail="Home not found")
    
    return {"detail": "Home deleted"}
