from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field, Relationship


class Quest(SQLModel, table=True):
    """Quest model representing a task or chore"""
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    title: str
    description: Optional[str] = None
    xp_reward: int = Field(default=10)
    gold_reward: int = Field(default=5)
    recurrence: str = Field(default="one-off")  # one-off, daily, weekly
    completed: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    
    # Relationships
    user: "User" = Relationship(back_populates="quests")


class QuestRead(SQLModel):
    """Schema for reading quest data"""
    id: int
    user_id: int
    title: str
    description: Optional[str]
    xp_reward: int
    gold_reward: int
    recurrence: str
    completed: bool
    created_at: datetime
    completed_at: Optional[datetime]


class QuestCreate(SQLModel):
    """Schema for creating a quest"""
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    xp_reward: int = Field(default=10, ge=0, le=10000)
    gold_reward: int = Field(default=5, ge=0, le=10000)
    recurrence: str = Field(default="one-off")


class QuestUpdate(SQLModel):
    """Schema for updating a quest"""
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    xp_reward: Optional[int] = Field(default=None, ge=0, le=10000)
    gold_reward: Optional[int] = Field(default=None, ge=0, le=10000)
    recurrence: Optional[str] = None
    completed: Optional[bool] = None
