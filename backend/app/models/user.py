from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from app.models.quest import Quest
    from app.models.reward import UserRewardClaim


class User(SQLModel, table=True):
    """User model representing a household member"""
    
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    level: int = Field(default=1)
    xp: int = Field(default=0)
    gold_balance: int = Field(default=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Relationships
    quests: List["Quest"] = Relationship(back_populates="user")
    reward_claims: List["UserRewardClaim"] = Relationship(back_populates="user")


class UserRead(SQLModel):
    """Schema for reading user data"""
    id: int
    username: str
    level: int
    xp: int
    gold_balance: int
    created_at: datetime


class UserCreate(SQLModel):
    """Schema for creating a user"""
    username: str = Field(min_length=1, max_length=50)


class UserUpdate(SQLModel):
    """Schema for updating user data"""
    level: Optional[int] = Field(default=None, ge=1)
    xp: Optional[int] = Field(default=None, ge=0)
    gold_balance: Optional[int] = Field(default=None, ge=0)
