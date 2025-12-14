"""Authentication routes"""
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from app.database import get_db
from app.models.user import UserCreate
from app.crud import user as crud_user
from app.auth import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest:
    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password


@router.post("/login")
def login(username: str, password: str, db: Session = Depends(get_db)):
    """Login with username and password, returns JWT token"""
    # Find user by username (search across all homes for now)
    # In a real app, you'd also select a specific home
    user = crud_user.get_user_by_username_any_home(db, username)
    
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    token = create_access_token(user.id, user.home_id)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/dev/token")
def get_dev_token(db: Session = Depends(get_db)):
    """Dev-only: Get a test token for first user (alice from seed)"""
    if os.getenv("NODE_ENV") == "production":
        raise HTTPException(status_code=403, detail="Not available in production")
    
    # Get first user (alice) from seed data
    user = crud_user.get_user(db, 1)
    if not user:
        raise HTTPException(status_code=404, detail="No test user found. Run seed.py first.")
    
    token = create_access_token(user.id, user.home_id)
    return {"access_token": token, "token_type": "bearer", "user": user.username}
