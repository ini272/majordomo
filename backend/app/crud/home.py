import secrets
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from typing import Optional

from sqlmodel import Session, select

from app.models.home import Home, HomeCreate


def generate_invite_code() -> str:
    """Generate a unique invite code"""
    return secrets.token_urlsafe(8)


def get_all_homes(db: Session) -> list[Home]:
    """Get all homes"""
    return db.exec(select(Home)).all()


def get_home(db: Session, home_id: int) -> Optional[Home]:
    """Get home by ID"""
    return db.exec(select(Home).where(Home.id == home_id)).first()


def get_home_by_invite_code(db: Session, invite_code: str) -> Optional[Home]:
    """Get home by invite code"""
    return db.exec(select(Home).where(Home.invite_code == invite_code)).first()


def get_home_by_name(db: Session, name: str) -> Optional[Home]:
    """Get home by name"""
    return db.exec(select(Home).where(Home.name == name)).first()


def create_home(db: Session, home_in: HomeCreate) -> Home:
    """Create a new home"""
    # Check for duplicate home name
    existing_home = get_home_by_name(db, home_in.name)
    if existing_home:
        raise ValueError(f"A home with the name '{home_in.name}' already exists")

    timezone = home_in.timezone.strip() if home_in.timezone else "UTC"
    try:
        ZoneInfo(timezone)
    except ZoneInfoNotFoundError as exc:
        raise ValueError(f"Invalid home timezone: {timezone}") from exc

    db_home = Home(
        **home_in.model_dump(exclude={"timezone"}),
        timezone=timezone,
        invite_code=generate_invite_code(),
    )
    db.add(db_home)
    db.commit()
    db.refresh(db_home)
    return db_home


def delete_home(db: Session, home_id: int) -> bool:
    """Delete home"""
    db_home = get_home(db, home_id)
    if not db_home:
        return False

    db.delete(db_home)
    db.commit()
    return True
