from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.auth import get_current_user
from app.crud import home as crud_home
from app.crud import user as crud_user
from app.database import get_db
from app.errors import ErrorCode, create_error_detail
from app.models.home import HomeCreate, HomeRead
from app.models.user import UserCreate, UserRead

router = APIRouter(prefix="/api/homes", tags=["homes"])


# GET endpoints
@router.get("", response_model=List[HomeRead])
def get_all_homes(db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Get all homes (admin endpoint - requires authentication)"""
    # TODO: Add admin-only check if needed
    return crud_home.get_all_homes(db)


@router.get("/{home_id}", response_model=HomeRead)
def get_home(home_id: int, db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Get home by ID"""
    # Verify user belongs to this home
    if auth["home_id"] != home_id:
        raise HTTPException(
            status_code=403,
            detail=create_error_detail(
                ErrorCode.UNAUTHORIZED_ACCESS,
                message="You are not authorized to access this home",
                details={"home_id": home_id, "your_home_id": auth["home_id"]},
            ),
        )

    home = crud_home.get_home(db, home_id)
    if not home:
        raise HTTPException(
            status_code=404, detail=create_error_detail(ErrorCode.HOME_NOT_FOUND, details={"home_id": home_id})
        )

    return home


@router.get("/{home_id}/users", response_model=List[UserRead])
def get_home_users(home_id: int, db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Get all users in a home"""
    # Verify user belongs to this home
    if auth["home_id"] != home_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this home")

    home = crud_home.get_home(db, home_id)
    if not home:
        raise HTTPException(status_code=404, detail="Home not found")

    return crud_user.get_home_users(db, home_id)


# POST endpoints
@router.post("", response_model=HomeRead)
def create_home(home: HomeCreate, db: Session = Depends(get_db)):
    """Create a new home"""
    try:
        return crud_home.create_home(db, home)
    except ValueError as e:
        # Check if it's a duplicate home name error
        error_msg = str(e)
        if "already exists" in error_msg:
            raise HTTPException(
                status_code=400,
                detail=create_error_detail(
                    ErrorCode.DUPLICATE_HOME_NAME, message=error_msg, details={"home_name": home.name}
                ),
            )
        else:
            raise HTTPException(status_code=400, detail=create_error_detail(ErrorCode.INVALID_INPUT, message=error_msg))


@router.post("/{home_id}/join", response_model=UserRead)
def join_home(home_id: int, user: UserCreate, db: Session = Depends(get_db)):
    """Join a home"""
    home = crud_home.get_home(db, home_id)
    if not home:
        raise HTTPException(
            status_code=404, detail=create_error_detail(ErrorCode.HOME_NOT_FOUND, details={"home_id": home_id})
        )

    # Check if username already exists in this home
    existing_user = crud_user.get_user_by_username(db, home_id, user.username)
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail=create_error_detail(
                ErrorCode.DUPLICATE_USERNAME,
                message="Username already exists in this home",
                details={"username": user.username, "home_id": home_id},
            ),
        )

    return crud_user.create_user(db, home_id, user)


# DELETE endpoints
@router.delete("/{home_id}")
def delete_home(home_id: int, db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Delete a home"""
    # Verify user belongs to this home
    if auth["home_id"] != home_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this home")

    if not crud_home.delete_home(db, home_id):
        raise HTTPException(status_code=404, detail="Home not found")

    return {"detail": "Home deleted"}
