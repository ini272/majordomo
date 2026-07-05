from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Optional

from pydantic import field_validator
from sqlmodel import Field, Relationship, SQLModel, UniqueConstraint

if TYPE_CHECKING:
    from app.models.home import Home
    from app.models.user import User


def _as_utc_datetime(value: Any) -> Any:
    if value is None or not isinstance(value, datetime):
        return value

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


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
    recurrence: str = Field(default="one-off")  # one-off, daily, weekly, monthly
    schedule: Optional[str] = Field(default=None)  # JSON string with schedule details
    last_generated_at: Optional[datetime] = None  # when last instance was created
    due_in_hours: Optional[int] = Field(default=None, ge=1, le=8760)  # relative deadline (1h-1yr)
    system: bool = Field(default=False)  # true = system default, false = user created
    nfc_enabled: bool = Field(default=False, index=True)
    nfc_code: Optional[str] = Field(default=None, max_length=128, index=True, unique=True)
    created_by: int = Field(foreign_key="user.id")  # user who created it
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationships
    home: "Home" = Relationship(back_populates="quest_templates")
    quests: list["Quest"] = Relationship(back_populates="template")
    subscriptions: list["UserTemplateSubscription"] = Relationship(back_populates="template")


class UserTemplateSubscription(SQLModel, table=True):
    """
    Links a user to a quest template with personalized schedule settings.

    This enables:
    - User A: "Clean Kitchen" daily at 8am
    - User B: "Clean Kitchen" weekly on Monday at 6pm
    - Same template, different schedules per user
    """
    __tablename__ = "user_template_subscription"
    __table_args__ = (
        UniqueConstraint("user_id", "quest_template_id", name="unique_user_template_subscription"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    quest_template_id: int = Field(foreign_key="quest_template.id", index=True)

    # Per-user schedule settings
    recurrence: str = Field(default="one-off")  # one-off, daily, weekly, monthly
    schedule: Optional[str] = Field(default=None)  # JSON: {"type": "daily", "time": "08:00"}
    due_in_hours: Optional[int] = Field(default=None, ge=1, le=8760)

    # Generation tracking (PER USER, not per template)
    last_generated_at: Optional[datetime] = None
    is_active: bool = Field(default=True)  # Pause/resume functionality

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationships
    user: "User" = Relationship(back_populates="template_subscriptions")
    template: QuestTemplate = Relationship(back_populates="subscriptions")


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
    schedule: Optional[str]
    last_generated_at: Optional[datetime]
    due_in_hours: Optional[int]
    system: bool
    nfc_enabled: bool
    nfc_code: Optional[str]
    created_by: int
    created_at: datetime

    @field_validator("last_generated_at", "created_at", mode="before")
    @classmethod
    def normalize_utc_datetimes(cls, value: Any) -> Any:
        return _as_utc_datetime(value)


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
    schedule: Optional[str] = None
    due_in_hours: Optional[int] = Field(default=None, ge=1, le=8760)
    nfc_enabled: bool = Field(default=False)
    nfc_code: Optional[str] = Field(default=None, max_length=128)


class QuestTemplateUpdate(SQLModel):
    """Schema for updating a quest template"""

    display_name: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    tags: Optional[str] = Field(default=None, max_length=500)
    xp_reward: Optional[int] = Field(default=None, ge=0, le=10000)
    gold_reward: Optional[int] = Field(default=None, ge=0, le=10000)
    quest_type: Optional[str] = Field(default=None)
    recurrence: Optional[str] = Field(default=None)
    schedule: Optional[str] = None
    due_in_hours: Optional[int] = Field(default=None, ge=1, le=8760)
    nfc_enabled: Optional[bool] = Field(default=None)
    nfc_code: Optional[str] = Field(default=None, max_length=128)


class Quest(SQLModel, table=True):
    """Quest model representing a task instance for one or more users"""

    id: Optional[int] = Field(default=None, primary_key=True)
    home_id: int = Field(foreign_key="home.id", index=True)
    created_by: int = Field(foreign_key="user.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    quest_template_id: Optional[int] = Field(default=None, foreign_key="quest_template.id", index=True)
    completed: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

    # Snapshot fields (copied from template at creation, or set directly for standalone quests)
    title: str = Field(default="", max_length=200)
    display_name: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    tags: Optional[str] = Field(default=None, max_length=500)

    # Rewards: base value awarded to each participant. Actual earned values live on QuestParticipant.
    xp_reward: int = Field(default=0, ge=0)
    gold_reward: int = Field(default=0, ge=0)

    # Recurrence snapshot (for display context - shows what schedule this quest was created from)
    recurrence: str = Field(default="one-off")  # one-off, daily, weekly, monthly
    schedule: Optional[str] = Field(default=None)  # JSON string with schedule details

    # Corruption system fields
    quest_type: str = Field(default="standard")  # standard, bounty, corrupted
    due_in_hours: Optional[int] = Field(default=None, ge=1, le=8760)  # timer configured for corruption
    due_date: Optional[datetime] = None  # absolute quest deadline when an active quest timer is edited
    corrupted_at: Optional[datetime] = None  # when quest became corrupted

    # Relationships
    home: "Home" = Relationship(back_populates="quests")
    user: "User" = Relationship(
        back_populates="quests",
        sa_relationship_kwargs={"foreign_keys": "Quest.user_id"},
    )
    template: Optional[QuestTemplate] = Relationship(back_populates="quests")
    participants: list["QuestParticipant"] = Relationship(back_populates="quest")


class QuestParticipant(SQLModel, table=True):
    """Links a quest instance to each user participating in it."""

    __tablename__ = "quest_participant"
    __table_args__ = (
        UniqueConstraint("quest_id", "user_id", name="unique_quest_participant"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    quest_id: int = Field(foreign_key="quest.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    xp_awarded: Optional[int] = Field(default=None, ge=0)
    gold_awarded: Optional[int] = Field(default=None, ge=0)
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    quest: Quest = Relationship(back_populates="participants")
    user: "User" = Relationship(back_populates="quest_participations")


class QuestParticipantRead(SQLModel):
    """Schema for reading quest participant data."""

    id: int
    quest_id: int
    user_id: int
    xp_awarded: Optional[int]
    gold_awarded: Optional[int]
    completed_at: Optional[datetime]
    created_at: datetime

    @field_validator("completed_at", "created_at", mode="before")
    @classmethod
    def normalize_utc_datetimes(cls, value: Any) -> Any:
        return _as_utc_datetime(value)


class QuestRead(SQLModel):
    """Schema for reading quest data"""

    id: int
    home_id: int
    created_by: int
    user_id: int
    quest_template_id: Optional[int]
    completed: bool
    created_at: datetime
    completed_at: Optional[datetime]

    # Snapshot fields
    title: str
    display_name: Optional[str]
    description: Optional[str]
    tags: Optional[str]
    xp_reward: int
    gold_reward: int
    recurrence: str
    schedule: Optional[str]

    quest_type: str
    due_in_hours: Optional[int]
    due_date: Optional[datetime]
    corrupted_at: Optional[datetime]
    # Reward preview for incomplete quests, after the authenticated user's active
    # household corruption debuff and before bounty or XP boost modifiers.
    effective_xp_reward: Optional[int] = None
    effective_gold_reward: Optional[int] = None
    corruption_debuff: Optional[float] = None
    corrupted_quest_count: int = 0
    corruption_debuff_active: bool = False
    # Include template data for convenience (may be null for standalone quests)
    template: Optional[QuestTemplateRead]
    participants: list[QuestParticipantRead] = Field(default_factory=list)

    @field_validator("created_at", "completed_at", "due_date", "corrupted_at", mode="before")
    @classmethod
    def normalize_utc_datetimes(cls, value: Any) -> Any:
        return _as_utc_datetime(value)


class QuestScribePreviewRead(SQLModel):
    """Schema for previewing regenerated Scribe copy without persisting it."""

    display_name: str
    description: str
    tags: str


class QuestCreate(SQLModel):
    """Schema for creating a quest from a template"""

    quest_template_id: int
    due_date: Optional[datetime] = None  # optional user-set deadline
    participant_user_ids: Optional[list[int]] = None


class QuestCreateStandalone(SQLModel):
    """Schema for creating a standalone quest without a template"""

    title: str = Field(min_length=1, max_length=200)
    display_name: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    tags: Optional[str] = Field(default=None, max_length=500)
    xp_reward: int = Field(default=10, ge=0, le=10000)
    gold_reward: int = Field(default=5, ge=0, le=10000)
    due_in_hours: Optional[int] = Field(default=None, ge=1, le=8760)
    participant_user_ids: Optional[list[int]] = None


class QuestUpdate(SQLModel):
    """Schema for updating a quest"""

    display_name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[str] = None
    xp_reward: Optional[int] = None
    gold_reward: Optional[int] = None
    user_id: Optional[int] = None
    participant_user_ids: Optional[list[int]] = None
    completed: Optional[bool] = None
    quest_type: Optional[str] = None
    due_in_hours: Optional[int] = Field(default=None, ge=1, le=8760)


class UserTemplateSubscriptionRead(SQLModel):
    """Schema for reading subscription data"""

    id: int
    user_id: int
    quest_template_id: int
    recurrence: str
    schedule: Optional[str]
    due_in_hours: Optional[int]
    last_generated_at: Optional[datetime]
    is_active: bool
    created_at: datetime
    # Include template data for convenience
    template: Optional[QuestTemplateRead] = None

    @field_validator("last_generated_at", "created_at", mode="before")
    @classmethod
    def normalize_utc_datetimes(cls, value: Any) -> Any:
        return _as_utc_datetime(value)


class UserTemplateSubscriptionCreate(SQLModel):
    """Schema for creating a subscription"""

    quest_template_id: int
    recurrence: str = Field(default="one-off")
    schedule: Optional[str] = None
    due_in_hours: Optional[int] = Field(default=None, ge=1, le=8760)


class UserTemplateSubscriptionUpdate(SQLModel):
    """Schema for updating a subscription"""

    recurrence: Optional[str] = None
    schedule: Optional[str] = None
    due_in_hours: Optional[int] = Field(default=None, ge=1, le=8760)
    is_active: Optional[bool] = None


class ConvertToTemplateRequest(SQLModel):
    """Schema for converting standalone quest to template"""

    recurrence: str = Field(default="one-off")  # "one-off", "daily", "weekly", "monthly"
    schedule: Optional[str] = None  # JSON string with schedule details
    due_in_hours: Optional[int] = Field(default=None, ge=1, le=8760)
