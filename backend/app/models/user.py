from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.achievement import UserAchievement
    from app.models.home import Home
    from app.models.quest import Quest
    from app.models.reward import UserRewardClaim


class User(SQLModel, table=True):
    """User model representing a home member"""

    id: Optional[int] = Field(default=None, primary_key=True)
    home_id: int = Field(foreign_key="home.id", index=True)
    username: str = Field(index=True, min_length=1, max_length=50)
    email: Optional[str] = Field(default=None, unique=True, index=True)
    password_hash: str
    level: int = Field(default=1, ge=1, le=1000)
    xp: int = Field(default=0, ge=0)
    gold_balance: int = Field(default=0, ge=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationships
    home: "Home" = Relationship(back_populates="users")
    quests: List["Quest"] = Relationship(back_populates="user")
    reward_claims: List["UserRewardClaim"] = Relationship(back_populates="user")
    user_achievements: List["UserAchievement"] = Relationship(back_populates="user")


class UserRead(SQLModel):
    """Schema for reading user data"""

    id: int
    home_id: int
    username: str
    email: Optional[str] = None
    level: int
    xp: int
    gold_balance: int
    created_at: datetime


class UserCreate(SQLModel):
    """Schema for creating a user"""

    username: str = Field(min_length=1, max_length=50)
    email: Optional[str] = None
    password: str = Field(min_length=1)


class UserUpdate(SQLModel):
    """Schema for updating user data"""

    level: Optional[int] = Field(default=None, ge=1)
    xp: Optional[int] = Field(default=None, ge=0)
    gold_balance: Optional[int] = Field(default=None, ge=0)
