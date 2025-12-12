from typing import Optional, List
from sqlmodel import select, Session
from app.models.user import User, UserCreate, UserUpdate


def calculate_level(xp: int) -> int:
    """
    Calculate level based on total XP using cumulative formula.
    
    Level progression:
    - Level 1: 0-99 XP
    - Level 2: 100-299 XP (requires 100 XP)
    - Level 3: 300-599 XP (requires 300 more XP)
    etc.
    """
    level = 1
    xp_threshold = 0
    
    while xp >= xp_threshold:
        xp_threshold += level * 100
        level += 1
    
    return level - 1


def create_user(db: Session, user_in: UserCreate) -> User:
    """Create a new user"""
    db_user = User(**user_in.model_dump())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_user(db: Session, user_id: int) -> Optional[User]:
    """Get user by ID"""
    return db.exec(select(User).where(User.id == user_id)).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """Get user by username"""
    return db.exec(select(User).where(User.username == username)).first()


def get_all_users(db: Session) -> List[User]:
    """Get all users"""
    return db.exec(select(User)).all()


def update_user(db: Session, user_id: int, user_in: UserUpdate) -> Optional[User]:
    """Update user"""
    db_user = get_user(db, user_id)
    if not db_user:
        return None
    
    update_data = user_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_user, key, value)
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def delete_user(db: Session, user_id: int) -> bool:
    """Delete user"""
    db_user = get_user(db, user_id)
    if not db_user:
        return False
    
    db.delete(db_user)
    db.commit()
    return True


def add_xp(db: Session, user_id: int, amount: int) -> Optional[User]:
    """Add XP to user and update level automatically"""
    db_user = get_user(db, user_id)
    if not db_user:
        return None
    
    db_user.xp += amount
    db_user.level = calculate_level(db_user.xp)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def add_gold(db: Session, user_id: int, amount: int) -> Optional[User]:
    """Add gold to user"""
    db_user = get_user(db, user_id)
    if not db_user:
        return None
    
    db_user.gold_balance += amount
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
