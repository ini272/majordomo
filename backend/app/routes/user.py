from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.auth import get_current_user
from app.crud import home as crud_home
from app.crud import user as crud_user
from app.database import get_db
from app.errors import ErrorCode, create_error_detail
from app.models.user import UserProfileUpdate, UserRead, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])


# GET endpoints
@router.get("/me", response_model=UserRead)
def get_current_user_stats(db: Session = Depends(get_db), auth: dict = Depends(get_current_user)):
    """Get current authenticated user's stats"""
    user = crud_user.get_user(db, auth["user_id"])
    if not user:
        raise HTTPException(
            status_code=404,
            detail=create_error_detail(ErrorCode.USER_NOT_FOUND, details={"user_id": auth["user_id"]}),
        )
    return user


@router.put("/me", response_model=UserRead)
def update_current_user_profile(
    profile_update: UserProfileUpdate, db: Session = Depends(get_db), auth: dict = Depends(get_current_user)
):
    """Update the authenticated user's profile settings."""
    user = crud_user.get_user(db, auth["user_id"])
    if not user:
        raise HTTPException(
            status_code=404,
            detail=create_error_detail(ErrorCode.USER_NOT_FOUND, details={"user_id": auth["user_id"]}),
        )

    try:
        updated_user = crud_user.update_user_profile(db, auth["user_id"], profile_update)
    except ValueError as exc:
        error_msg = str(exc)
        if "already exists in this home" in error_msg:
            raise HTTPException(
                status_code=400,
                detail=create_error_detail(
                    ErrorCode.DUPLICATE_USERNAME,
                    message=error_msg,
                    details={"user_id": auth["user_id"]},
                ),
            )
        if "already registered" in error_msg:
            raise HTTPException(
                status_code=400,
                detail=create_error_detail(
                    ErrorCode.DUPLICATE_EMAIL,
                    message=error_msg,
                    details={"user_id": auth["user_id"]},
                ),
            )

        raise HTTPException(
            status_code=400,
            detail=create_error_detail(
                ErrorCode.INVALID_INPUT,
                message=error_msg,
                details={"user_id": auth["user_id"]},
            ),
        )

    if not updated_user:
        raise HTTPException(
            status_code=404,
            detail=create_error_detail(ErrorCode.USER_NOT_FOUND, details={"user_id": auth["user_id"]}),
        )

    return updated_user


@router.delete("/me")
def delete_current_user_account(db: Session = Depends(get_db), auth: dict = Depends(get_current_user)):
    """Delete the authenticated user's account only."""
    user = crud_user.get_user(db, auth["user_id"])
    if not user:
        raise HTTPException(
            status_code=404,
            detail=create_error_detail(ErrorCode.USER_NOT_FOUND, details={"user_id": auth["user_id"]}),
        )

    home_users = crud_user.get_home_users(db, auth["home_id"])

    if len(home_users) <= 1:
        if not crud_home.delete_home(db, auth["home_id"]):
            raise HTTPException(
                status_code=404,
                detail=create_error_detail(ErrorCode.HOME_NOT_FOUND, details={"home_id": auth["home_id"]}),
            )
        return {"detail": "Account and home deleted"}

    if not crud_user.delete_user(db, auth["user_id"]):
        raise HTTPException(
            status_code=404,
            detail=create_error_detail(ErrorCode.USER_NOT_FOUND, details={"user_id": auth["user_id"]}),
        )

    return {"detail": "Account deleted"}


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
