"""Authentication routes"""

import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlmodel import Session

from app.auth import create_access_token, verify_password
from app.crud import achievement as crud_achievement
from app.crud import home as crud_home
from app.crud import user as crud_user
from app.database import get_db
from app.errors import ErrorCode, create_error_detail
from app.models.home import HomeCreate
from app.models.user import UserCreate

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str
    home_id: int


class LoginEmailRequest(BaseModel):
    email: EmailStr
    password: str


class SignupRequest(BaseModel):
    email: EmailStr
    username: str
    password: str
    home_name: str
    home_timezone: str = "UTC"


class JoinHomeRequest(BaseModel):
    invite_code: str
    email: EmailStr
    username: str
    password: str


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


@router.post("/login-email")
def login_email(request: LoginEmailRequest, db: Session = Depends(get_db)):
    """
    Authenticate user with email and return JWT access token.

    - **email**: User's email address (globally unique)
    - **password**: User's password

    Returns access token for authenticated API requests.
    Include token in subsequent requests: `Authorization: Bearer <token>`
    """
    # Find user by email
    user = crud_user.get_user_by_email(db, request.email)

    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail=create_error_detail(
                ErrorCode.INVALID_CREDENTIALS, message="Invalid email or password", details={"email": request.email}
            ),
        )

    token = create_access_token(user.id, user.home_id)
    return {"access_token": token, "token_type": "bearer", "user_id": user.id, "home_id": user.home_id}


@router.post("/signup")
def signup(request: SignupRequest, db: Session = Depends(get_db)):
    """
    Create a new home and user account, return JWT access token.

    - **email**: User's email address (will be globally unique)
    - **username**: Display name for the user (unique within the home)
    - **password**: User's password
    - **home_name**: Name for the new home/household
    - **home_timezone**: IANA timezone for this household (default `UTC`)

    Creates a new home with auto-generated invite code and registers the user as the first member.
    Returns access token for immediate login.
    """
    try:
        # Create the home
        home = crud_home.create_home(
            db,
            HomeCreate(name=request.home_name, timezone=request.home_timezone),
        )

        # Create default starter achievements for the new home
        crud_achievement.create_default_achievements(db, home.id)

        # Create the user (first member of the home)
        user = crud_user.create_user(
            db, home.id, UserCreate(username=request.username, email=request.email, password=request.password)
        )

        # Return token for immediate login
        token = create_access_token(user.id, user.home_id)
        return {
            "access_token": token,
            "token_type": "bearer",
            "user_id": user.id,
            "home_id": user.home_id,
            "invite_code": home.invite_code,
        }

    except ValueError as e:
        error_msg = str(e)
        if "already exists" in error_msg.lower():
            if "email" in error_msg.lower():
                raise HTTPException(
                    status_code=400,
                    detail=create_error_detail(
                        ErrorCode.DUPLICATE_USERNAME, message=error_msg, details={"email": request.email}
                    ),
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail=create_error_detail(
                        ErrorCode.DUPLICATE_HOME_NAME, message=error_msg, details={"home_name": request.home_name}
                    ),
                )
        raise HTTPException(status_code=400, detail=create_error_detail(ErrorCode.INVALID_INPUT, message=error_msg))


@router.post("/join")
def join_home(request: JoinHomeRequest, db: Session = Depends(get_db)):
    """
    Join an existing home using an invite code.

    - **invite_code**: Unique invite code for the home
    - **email**: User's email address (globally unique)
    - **username**: Display name for the user (unique within the home)
    - **password**: User's password

    Returns access token for immediate login.
    """
    # Find home by invite code
    home = crud_home.get_home_by_invite_code(db, request.invite_code)
    if not home:
        raise HTTPException(
            status_code=404,
            detail=create_error_detail(
                ErrorCode.HOME_NOT_FOUND, message="Invalid invite code", details={"invite_code": request.invite_code}
            ),
        )

    try:
        # Create the user
        user = crud_user.create_user(
            db, home.id, UserCreate(username=request.username, email=request.email, password=request.password)
        )

        # Return token for immediate login
        token = create_access_token(user.id, user.home_id)
        return {"access_token": token, "token_type": "bearer", "user_id": user.id, "home_id": user.home_id}

    except ValueError as e:
        error_msg = str(e)
        if "already exists" in error_msg.lower() or "already registered" in error_msg.lower():
            if "email" in error_msg.lower():
                raise HTTPException(
                    status_code=400,
                    detail=create_error_detail(
                        ErrorCode.DUPLICATE_USERNAME, message=error_msg, details={"email": request.email}
                    ),
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail=create_error_detail(
                        ErrorCode.DUPLICATE_USERNAME, message=error_msg, details={"username": request.username}
                    ),
                )
        raise HTTPException(status_code=400, detail=create_error_detail(ErrorCode.INVALID_INPUT, message=error_msg))


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
