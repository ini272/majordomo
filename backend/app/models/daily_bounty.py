from datetime import datetime, timezone
from datetime import date as date_type
from typing import Optional
from sqlmodel import SQLModel, Field


class DailyBounty(SQLModel, table=True):
    """DailyBounty model tracking daily bounty selection per home"""
    __tablename__ = "daily_bounty"

    id: Optional[int] = Field(default=None, primary_key=True)
    home_id: int = Field(foreign_key="home.id", index=True)
    quest_template_id: int = Field(foreign_key="quest_template.id", index=True)
    bounty_date: date_type = Field(index=True)  # The date this bounty is for
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DailyBountyRead(SQLModel):
    """Schema for reading daily bounty data"""
    id: int
    home_id: int
    quest_template_id: int
    bounty_date: date_type
    created_at: datetime
