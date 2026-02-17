from datetime import date as date_type
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel, UniqueConstraint


class DailyBounty(SQLModel, table=True):
    """DailyBounty model tracking one user-specific bounty decision per home/day."""

    __tablename__ = "daily_bounty"
    __table_args__ = (
        UniqueConstraint("home_id", "user_id", "bounty_date", name="unique_home_user_bounty_date"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    home_id: int = Field(foreign_key="home.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    quest_id: Optional[int] = Field(default=None, foreign_key="quest.id", index=True)
    bounty_date: date_type = Field(index=True)  # The date this bounty is for
    status: str = Field(default="none_eligible")  # assigned | none_eligible
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DailyBountyRead(SQLModel):
    """Schema for reading daily bounty decision data."""

    id: int
    home_id: int
    user_id: int
    quest_id: Optional[int]
    bounty_date: date_type
    status: str
    created_at: datetime
