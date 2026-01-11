from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.home import Home
    from app.models.user import User


class QuestTemplate(SQLModel, table=True):
    """QuestTemplate model representing a reusable quest blueprint"""

    __tablename__ = "quest_template"

    id: Optional[int] = Field(default=None, primary_key=True)
    home_id: int = Field(foreign_key="home.id", index=True)
    title: str = Field(min_length=1, max_length=200)
    display_name: Optional[str] = Field(default=None, max_length=200)  # fantasy/gamified variant of title
    description: Optional[str] = Field(default=None, max_length=1000)
    tags: Optional[str] = Field(default=None, max_length=500)  # comma-separated: "chores,exercise,health"
    xp_reward: int = Field(default=10, ge=0, le=10000)
    gold_reward: int = Field(default=5, ge=0, le=10000)
    quest_type: str = Field(default="standard")  # standard, corrupted
    recurrence: str = Field(default="one-off")  # one-off, daily, weekly
    system: bool = Field(default=False)  # true = system default, false = user created
    created_by: int = Field(foreign_key="user.id")  # user who created it
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationships
    home: "Home" = Relationship(back_populates="quest_templates")
    quests: List["Quest"] = Relationship(back_populates="template")


class QuestTemplateRead(SQLModel):
    """Schema for reading quest template data"""

    id: int
    home_id: int
    title: str
    display_name: Optional[str]
    description: Optional[str]
    tags: Optional[str]
    xp_reward: int
    gold_reward: int
    quest_type: str
    recurrence: str
    system: bool
    created_by: int
    created_at: datetime


class QuestTemplateCreate(SQLModel):
    """Schema for creating a quest template"""

    title: str = Field(min_length=1, max_length=200)
    display_name: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    tags: Optional[str] = Field(default=None, max_length=500)
    xp_reward: int = Field(default=10, ge=0, le=10000)
    gold_reward: int = Field(default=5, ge=0, le=10000)
    quest_type: str = Field(default="standard")
    recurrence: str = Field(default="one-off")


class QuestTemplateUpdate(SQLModel):
    """Schema for updating a quest template"""

    display_name: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    tags: Optional[str] = Field(default=None, max_length=500)
    xp_reward: Optional[int] = Field(default=None, ge=0, le=10000)
    gold_reward: Optional[int] = Field(default=None, ge=0, le=10000)
    quest_type: Optional[str] = Field(default=None)
    recurrence: Optional[str] = Field(default=None)


class Quest(SQLModel, table=True):
    """Quest model representing a task instance for a user"""

    id: Optional[int] = Field(default=None, primary_key=True)
    home_id: int = Field(foreign_key="home.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    quest_template_id: int = Field(foreign_key="quest_template.id", index=True)
    completed: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

    # Relationships
    home: "Home" = Relationship(back_populates="quests")
    user: "User" = Relationship(back_populates="quests")
    template: QuestTemplate = Relationship(back_populates="quests")


class QuestRead(SQLModel):
    """Schema for reading quest data"""

    id: int
    home_id: int
    user_id: int
    quest_template_id: int
    completed: bool
    created_at: datetime
    completed_at: Optional[datetime]
    # Include template data for convenience
    template: QuestTemplateRead


class QuestCreate(SQLModel):
    """Schema for creating a quest from a template"""

    quest_template_id: int


class QuestUpdate(SQLModel):
    """Schema for updating a quest"""

    completed: Optional[bool] = None
