from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.home import Home


class Reward(SQLModel, table=True):
    """Reward model representing an unlockable reward in a home"""

    id: Optional[int] = Field(default=None, primary_key=True)
    home_id: int = Field(foreign_key="home.id", index=True)
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    cost: int = Field(ge=0)  # gold cost to claim this reward
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationships
    home: "Home" = Relationship(back_populates="rewards")
    user_claims: List["UserRewardClaim"] = Relationship(back_populates="reward")


class RewardRead(SQLModel):
    """Schema for reading reward data"""

    id: int
    home_id: int
    name: str
    description: Optional[str]
    cost: int
    created_at: datetime


class RewardCreate(SQLModel):
    """Schema for creating a reward"""

    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    cost: int = Field(ge=0)


class UserRewardClaim(SQLModel, table=True):
    """Junction table tracking when users claim rewards"""

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    reward_id: int = Field(foreign_key="reward.id", index=True)
    claimed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationships
    user: "User" = Relationship(back_populates="reward_claims")
    reward: "Reward" = Relationship(back_populates="user_claims")


class UserRewardClaimRead(SQLModel):
    """Schema for reading reward claim data"""

    id: int
    user_id: int
    reward_id: int
    claimed_at: datetime


class UserRewardClaimCreate(SQLModel):
    """Schema for creating a reward claim"""

    reward_id: int
