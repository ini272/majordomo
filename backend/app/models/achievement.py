from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.home import Home
    from app.models.user import User


class Achievement(SQLModel, table=True):
    """Achievement model representing an unlockable badge/milestone

    Can be either:
    - System achievement (is_system=True, home_id=None): Shared across all homes
    - Custom achievement (is_system=False, home_id=X): Specific to one home
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    home_id: Optional[int] = Field(default=None, foreign_key="home.id", index=True)
    is_system: bool = Field(default=False, index=True)  # True for system-wide achievements

    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)

    # Criteria for unlocking this achievement
    # criteria_type: "quests_completed", "level_reached", "gold_earned", "xp_earned", "bounties_completed"
    criteria_type: str = Field(max_length=50)
    criteria_value: int = Field(ge=0)  # Target value (e.g., 10 for "complete 10 quests")

    # Optional icon/image identifier
    icon: Optional[str] = Field(default=None, max_length=100)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationships
    home: Optional["Home"] = Relationship(back_populates="achievements")
    user_achievements: list["UserAchievement"] = Relationship(back_populates="achievement")


class AchievementRead(SQLModel):
    """Schema for reading achievement data"""

    id: int
    home_id: Optional[int]  # None for system achievements
    is_system: bool
    name: str
    description: Optional[str]
    criteria_type: str
    criteria_value: int
    icon: Optional[str]
    created_at: datetime


class AchievementCreate(SQLModel):
    """Schema for creating an achievement"""

    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    criteria_type: str = Field(max_length=50)
    criteria_value: int = Field(ge=0)
    icon: Optional[str] = Field(default=None, max_length=100)


class UserAchievement(SQLModel, table=True):
    """Junction table tracking when users unlock achievements"""

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    achievement_id: int = Field(foreign_key="achievement.id", index=True)
    unlocked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationships
    user: "User" = Relationship(back_populates="user_achievements")
    achievement: "Achievement" = Relationship(back_populates="user_achievements")


class UserAchievementRead(SQLModel):
    """Schema for reading user achievement unlock data"""

    id: int
    user_id: int
    achievement_id: int
    unlocked_at: datetime
    # Include achievement details for convenience
    achievement: Optional[AchievementRead] = None


class UserAchievementWithDetails(SQLModel):
    """Extended schema that includes full achievement details"""

    id: int
    user_id: int
    achievement_id: int
    unlocked_at: datetime
    achievement: AchievementRead
