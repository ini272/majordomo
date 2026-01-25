from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.achievement import Achievement
    from app.models.quest import Quest, QuestTemplate
    from app.models.reward import Reward
    from app.models.user import User


class Home(SQLModel, table=True):
    """Home model representing a family/group unit"""

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    invite_code: str = Field(unique=True, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationships
    users: list["User"] = Relationship(back_populates="home")
    quest_templates: list["QuestTemplate"] = Relationship(back_populates="home")
    quests: list["Quest"] = Relationship(back_populates="home")
    rewards: list["Reward"] = Relationship(back_populates="home")
    achievements: list["Achievement"] = Relationship(back_populates="home")


class HomeRead(SQLModel):
    """Schema for reading home data"""

    id: int
    name: str
    invite_code: str
    created_at: datetime


class HomeCreate(SQLModel):
    """Schema for creating a home"""

    name: str = Field(min_length=1, max_length=100)


class HomeJoin(SQLModel):
    """Schema for joining a home"""

    invite_code: str = Field(min_length=1)
