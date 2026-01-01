"""Authentication routes"""
import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session
from app.database import get_db
from app.models.user import UserCreate
from app.crud import user as crud_user
from app.auth import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str
    home_id: int


@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login with username and password, returns JWT token"""
    # Find user by username in the requested home
    user = crud_user.get_user_by_username(db, request.home_id, request.username)
    
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    token = create_access_token(user.id, user.home_id)
    return {"access_token": token, "token_type": "bearer", "user_id": user.id, "home_id": user.home_id}


@router.get("/dev/token")
def get_dev_token(user_id: int = 1, db: Session = Depends(get_db)):
    """Dev-only: Get a test token for any user"""
    if os.getenv("NODE_ENV") == "production":
        raise HTTPException(status_code=403, detail="Not available in production")
    
    user = crud_user.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")
    
    token = create_access_token(user.id, user.home_id)
    return {"access_token": token, "token_type": "bearer", "user": user.username, "home_id": user.home_id}
