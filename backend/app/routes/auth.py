"""Authentication routes"""

import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from app.auth import create_access_token, verify_password
from app.crud import user as crud_user
from app.database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str
    home_id: int


@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user and return JWT access token.

    - **username**: User's username (unique within home)
    - **password**: User's password
    - **home_id**: Home/household ID the user belongs to

    Returns access token for authenticated API requests.
    Include token in subsequent requests: `Authorization: Bearer <token>`
    """
    # Find user by username in the requested home
    user = crud_user.get_user_by_username(db, request.home_id, request.username)

    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(user.id, user.home_id)
    return {"access_token": token, "token_type": "bearer", "user_id": user.id, "home_id": user.home_id}


@router.get("/dev/token")
def get_dev_token(user_id: int = 1, db: Session = Depends(get_db)):
    """
    **Development Only**: Generate test JWT token for any user.

    - **user_id**: User ID to generate token for (default: 1)

    ⚠️ This endpoint is disabled in production (NODE_ENV=production).
    Use for testing and local development only.
    """
    if os.getenv("NODE_ENV") == "production":
        raise HTTPException(status_code=403, detail="Not available in production")

    user = crud_user.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")

    token = create_access_token(user.id, user.home_id)
    return {"access_token": token, "token_type": "bearer", "user": user.username, "home_id": user.home_id}
