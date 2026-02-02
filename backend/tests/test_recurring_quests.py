"""Tests for recurring quest functionality"""

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models.quest import Quest, QuestTemplate, UserTemplateSubscription
from app.services.recurring_quests import (
    calculate_next_generation_time,
    generate_due_quests,
    parse_time,
)


# ============================================================================
# Unit Tests: Time Parsing
# ============================================================================


def test_parse_time_valid():
    """Test parsing valid time strings"""
    assert parse_time("08:00") == (8, 0)
    assert parse_time("18:30") == (18, 30)
    assert parse_time("00:00") == (0, 0)
    assert parse_time("23:59") == (23, 59)


def test_parse_time_invalid():
    """Test parsing invalid time strings"""
    with pytest.raises(ValueError):
        parse_time("25:00")  # Invalid hour
    with pytest.raises(ValueError):
        parse_time("12:60")  # Invalid minute
    with pytest.raises(ValueError):
        parse_time("invalid")  # Invalid format
    with pytest.raises(ValueError):
        parse_time("12-30")  # Wrong separator


# ============================================================================
# Unit Tests: Daily Schedule Time Calculation
# ============================================================================


def test_daily_first_generation_before_scheduled_time():
    """Test daily schedule when created before scheduled time (should use today)"""
    # Mock "now" as 7:00 AM
    mock_now = datetime(2026, 1, 27, 7, 0, tzinfo=timezone.utc)

    with patch("app.services.recurring_quests.datetime") as mock_datetime:
        mock_datetime.now.return_value = mock_now

        schedule = {"type": "daily", "time": "08:00"}
        next_time = calculate_next_generation_time(None, schedule)

        # Should return today at 8:00 AM
        assert next_time.date() == mock_now.date()
        assert next_time.hour == 8
        assert next_time.minute == 0


def test_daily_first_generation_after_scheduled_time():
    """Test daily schedule when created after scheduled time (should use today)"""
    # Mock "now" as 9:00 AM
    mock_now = datetime(2026, 1, 27, 9, 0, tzinfo=timezone.utc)

    with patch("app.services.recurring_quests.datetime") as mock_datetime:
        mock_datetime.now.return_value = mock_now

        schedule = {"type": "daily", "time": "08:00"}
        next_time = calculate_next_generation_time(None, schedule)

        # Should return today at 8:00 AM (to trigger immediate generation)
        assert next_time.date() == mock_now.date()
        assert next_time.hour == 8
        assert next_time.minute == 0


def test_daily_already_generated_today():
    """Test daily schedule when already generated today (should use tomorrow)"""
    # Mock "now" as 9:00 AM on Jan 27
    mock_now = datetime(2026, 1, 27, 9, 0, tzinfo=timezone.utc)
    # Last generated at 8:00 AM today
    last_generated = datetime(2026, 1, 27, 8, 0, tzinfo=timezone.utc)

    with patch("app.services.recurring_quests.datetime") as mock_datetime:
        mock_datetime.now.return_value = mock_now

        schedule = {"type": "daily", "time": "08:00"}
        next_time = calculate_next_generation_time(last_generated, schedule)

        # Should return tomorrow at 8:00 AM
        expected_date = (mock_now + timedelta(days=1)).date()
        assert next_time.date() == expected_date
        assert next_time.hour == 8


def test_daily_generated_yesterday():
    """Test daily schedule when generated yesterday (should use today)"""
    # Mock "now" as 9:00 AM on Jan 27
    mock_now = datetime(2026, 1, 27, 9, 0, tzinfo=timezone.utc)
    # Last generated yesterday at 8:00 AM
    last_generated = datetime(2026, 1, 26, 8, 0, tzinfo=timezone.utc)

    with patch("app.services.recurring_quests.datetime") as mock_datetime:
        mock_datetime.now.return_value = mock_now

        schedule = {"type": "daily", "time": "08:00"}
        next_time = calculate_next_generation_time(last_generated, schedule)

        # Should return today at 8:00 AM (already passed, so current time is after)
        assert next_time.date() == mock_now.date()
        assert next_time.hour == 8


# ============================================================================
# Unit Tests: Weekly Schedule Time Calculation
# ============================================================================


def test_weekly_next_occurrence_same_week():
    """Test weekly schedule for a day later in the current week"""
    # Mock "now" as Monday 7:00 AM
    mock_now = datetime(2026, 1, 26, 7, 0, tzinfo=timezone.utc)  # Monday

    with patch("app.services.recurring_quests.datetime") as mock_datetime:
        mock_datetime.now.return_value = mock_now

        schedule = {"type": "weekly", "day": "friday", "time": "18:00"}
        next_time = calculate_next_generation_time(None, schedule)

        # Should return this Friday at 6:00 PM
        assert next_time.weekday() == 4  # Friday
        assert next_time.hour == 18
        assert next_time.minute == 0


def test_weekly_next_occurrence_next_week():
    """Test weekly schedule for a day earlier in the week (should be next week)"""
    # Mock "now" as Friday 7:00 AM
    mock_now = datetime(2026, 1, 30, 7, 0, tzinfo=timezone.utc)  # Friday

    with patch("app.services.recurring_quests.datetime") as mock_datetime:
        mock_datetime.now.return_value = mock_now

        schedule = {"type": "weekly", "day": "monday", "time": "18:00"}
        next_time = calculate_next_generation_time(None, schedule)

        # Should return next Monday at 6:00 PM
        assert next_time.weekday() == 0  # Monday
        assert next_time > mock_now
        assert (next_time - mock_now).days >= 3


def test_weekly_already_generated_this_week():
    """Test weekly schedule when already generated this week"""
    # Mock "now" as Wednesday 7:00 AM
    mock_now = datetime(2026, 1, 28, 7, 0, tzinfo=timezone.utc)  # Wednesday
    # Last generated Monday this week
    last_generated = datetime(2026, 1, 26, 18, 0, tzinfo=timezone.utc)

    with patch("app.services.recurring_quests.datetime") as mock_datetime:
        mock_datetime.now.return_value = mock_now

        schedule = {"type": "weekly", "day": "monday", "time": "18:00"}
        next_time = calculate_next_generation_time(last_generated, schedule)

        # Should return next Monday (week from last generation)
        assert next_time.weekday() == 0  # Monday
        assert (next_time - last_generated).days == 7


def test_weekly_same_day_after_time():
    """Test weekly schedule for today but after the scheduled time"""
    # Mock "now" as Monday 19:00 (7 PM)
    mock_now = datetime(2026, 1, 26, 19, 0, tzinfo=timezone.utc)  # Monday

    with patch("app.services.recurring_quests.datetime") as mock_datetime:
        mock_datetime.now.return_value = mock_now

        schedule = {"type": "weekly", "day": "monday", "time": "18:00"}
        next_time = calculate_next_generation_time(None, schedule)

        # Should return next Monday at 6:00 PM (7 days later)
        assert next_time.weekday() == 0  # Monday
        # Time difference is 6 days 23 hours, which equals 7 days
        assert (next_time - mock_now).total_seconds() == 7 * 24 * 3600 - 3600


# ============================================================================
# Unit Tests: Monthly Schedule Time Calculation
# ============================================================================


def test_monthly_generation_normal_day():
    """Test monthly schedule for a normal day (not edge case)"""
    # Mock "now" as Jan 10, 2026 at 7:00 AM
    mock_now = datetime(2026, 1, 10, 7, 0, tzinfo=timezone.utc)

    with patch("app.services.recurring_quests.datetime") as mock_datetime:
        mock_datetime.now.return_value = mock_now

        schedule = {"type": "monthly", "day": 15, "time": "08:00"}
        next_time = calculate_next_generation_time(None, schedule)

        # Should return Jan 15 at 8:00 AM
        assert next_time.year == 2026
        assert next_time.month == 1
        assert next_time.day == 15
        assert next_time.hour == 8


def test_monthly_generation_after_scheduled_day():
    """Test monthly schedule after the scheduled day has passed"""
    # Mock "now" as Jan 20, 2026 at 7:00 AM (after 15th)
    mock_now = datetime(2026, 1, 20, 7, 0, tzinfo=timezone.utc)

    with patch("app.services.recurring_quests.datetime") as mock_datetime:
        mock_datetime.now.return_value = mock_now

        schedule = {"type": "monthly", "day": 15, "time": "08:00"}
        next_time = calculate_next_generation_time(None, schedule)

        # Should return Feb 15 at 8:00 AM
        assert next_time.year == 2026
        assert next_time.month == 2
        assert next_time.day == 15


def test_monthly_generation_invalid_day_february():
    """Test monthly schedule for day 31 in February (should use last day)"""
    # Mock "now" as Feb 1, 2026 at 7:00 AM
    mock_now = datetime(2026, 2, 1, 7, 0, tzinfo=timezone.utc)

    with patch("app.services.recurring_quests.datetime") as mock_datetime:
        mock_datetime.now.return_value = mock_now

        schedule = {"type": "monthly", "day": 31, "time": "08:00"}
        next_time = calculate_next_generation_time(None, schedule)

        # Should return Feb 28 at 8:00 AM (2026 is not a leap year)
        assert next_time.year == 2026
        assert next_time.month == 2
        assert next_time.day == 28


def test_monthly_already_generated_this_month():
    """Test monthly schedule when already generated this month"""
    # Mock "now" as Jan 20, 2026 at 7:00 AM
    mock_now = datetime(2026, 1, 20, 7, 0, tzinfo=timezone.utc)
    # Last generated on Jan 15
    last_generated = datetime(2026, 1, 15, 8, 0, tzinfo=timezone.utc)

    with patch("app.services.recurring_quests.datetime") as mock_datetime:
        mock_datetime.now.return_value = mock_now

        schedule = {"type": "monthly", "day": 15, "time": "08:00"}
        next_time = calculate_next_generation_time(last_generated, schedule)

        # Should return Feb 15 at 8:00 AM
        assert next_time.year == 2026
        assert next_time.month == 2
        assert next_time.day == 15


def test_monthly_year_rollover():
    """Test monthly schedule rolling over to next year"""
    # Mock "now" as Dec 20, 2026 at 7:00 AM
    mock_now = datetime(2026, 12, 20, 7, 0, tzinfo=timezone.utc)
    # Last generated on Dec 15
    last_generated = datetime(2026, 12, 15, 8, 0, tzinfo=timezone.utc)

    with patch("app.services.recurring_quests.datetime") as mock_datetime:
        mock_datetime.now.return_value = mock_now

        schedule = {"type": "monthly", "day": 15, "time": "08:00"}
        next_time = calculate_next_generation_time(last_generated, schedule)

        # Should return Jan 15, 2027 at 8:00 AM
        assert next_time.year == 2027
        assert next_time.month == 1
        assert next_time.day == 15


# ============================================================================
# Unit Tests: Generation Logic
# ============================================================================


def test_generate_creates_instance_when_due(db: Session, db_home_with_users):
    """Test that generation creates quest instances when due (Phase 3: uses subscriptions)"""
    home, user1, user2 = db_home_with_users

    # Create template
    template = QuestTemplate(
        home_id=home.id,
        title="Morning routine",
        xp_reward=10,
        gold_reward=5,
        created_by=user1.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)

    # Create subscriptions for both users (Phase 3)
    subscription1 = UserTemplateSubscription(
        user_id=user1.id,
        quest_template_id=template.id,
        recurrence="daily",
        schedule=json.dumps({"type": "daily", "time": "08:00"}),
        is_active=True,
    )
    subscription2 = UserTemplateSubscription(
        user_id=user2.id,
        quest_template_id=template.id,
        recurrence="daily",
        schedule=json.dumps({"type": "daily", "time": "08:00"}),
        is_active=True,
    )
    db.add(subscription1)
    db.add(subscription2)
    db.commit()

    # Mock time as 9:00 AM (after scheduled time)
    mock_now = datetime(2026, 1, 27, 9, 0, tzinfo=timezone.utc)

    # Create a mock datetime class that properly handles both now() and constructor
    class MockDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return mock_now

    with patch("app.services.recurring_quests.datetime", MockDatetime):
        generate_due_quests(home.id, db)

    # Should create quest instances for both users
    quests = db.exec(select(Quest).where(Quest.quest_template_id == template.id)).all()
    assert len(quests) == 2

    # Verify subscriptions were updated
    db.refresh(subscription1)
    db.refresh(subscription2)
    assert subscription1.last_generated_at is not None
    assert subscription2.last_generated_at is not None


def test_generate_skips_when_incomplete_exists(db: Session, db_home_with_users):
    """Test that generation skips if incomplete quest exists (Phase 3: subscription-based)"""
    home, user, _user2 = db_home_with_users

    # Create template
    template = QuestTemplate(
        home_id=home.id,
        title="Morning routine",
        xp_reward=10,
        gold_reward=5,
        created_by=user.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)

    # Create subscription (Phase 3)
    subscription = UserTemplateSubscription(
        user_id=user.id,
        quest_template_id=template.id,
        recurrence="daily",
        schedule=json.dumps({"type": "daily", "time": "08:00"}),
        is_active=True,
    )
    db.add(subscription)
    db.commit()

    # Create existing incomplete quest (with snapshot fields)
    existing_quest = Quest(
        home_id=home.id,
        user_id=user.id,
        quest_template_id=template.id,
        title=template.title,
        xp_reward=template.xp_reward,
        gold_reward=template.gold_reward,
        recurrence="daily",
        schedule=json.dumps({"type": "daily", "time": "08:00"}),
        completed=False,
    )
    db.add(existing_quest)
    db.commit()

    # Mock time as 9:00 AM (after scheduled time)
    mock_now = datetime(2026, 1, 27, 9, 0, tzinfo=timezone.utc)
    with patch("app.services.recurring_quests.datetime") as mock_datetime:
        mock_datetime.now.return_value = mock_now
        mock_datetime.side_effect = lambda *args, **kwargs: datetime(*args, **kwargs)

        generate_due_quests(home.id, db)

    # Should NOT create new quest (already have incomplete one)
    quests = db.exec(select(Quest).where(Quest.quest_template_id == template.id)).all()
    assert len(quests) == 1  # Only the existing one


def test_generate_sets_due_date_from_template(db: Session, db_home_with_users):
    """Test that generation sets due_date based on subscription's due_in_hours (Phase 3)"""
    home, user, _user2 = db_home_with_users

    # Create template
    template = QuestTemplate(
        home_id=home.id,
        title="Morning routine",
        xp_reward=10,
        gold_reward=5,
        created_by=user.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)

    # Create subscription with due_in_hours set (Phase 3)
    subscription = UserTemplateSubscription(
        user_id=user.id,
        quest_template_id=template.id,
        recurrence="daily",
        schedule=json.dumps({"type": "daily", "time": "08:00"}),
        due_in_hours=48,  # 2 days
        is_active=True,
    )
    db.add(subscription)
    db.commit()

    # Mock time as 9:00 AM
    mock_now = datetime(2026, 1, 27, 9, 0, tzinfo=timezone.utc)

    class MockDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return mock_now

    with patch("app.services.recurring_quests.datetime", MockDatetime):
        generate_due_quests(home.id, db)

    # Verify quest has due_date set
    quest = db.exec(select(Quest).where(Quest.quest_template_id == template.id)).first()
    assert quest is not None
    assert quest.due_date is not None
    # Due date should be 48 hours from now
    expected_due = mock_now + timedelta(hours=48)
    # Handle timezone comparison (quest.due_date might be naive)
    quest_due_date = quest.due_date if quest.due_date.tzinfo else quest.due_date.replace(tzinfo=timezone.utc)
    assert abs((quest_due_date - expected_due).total_seconds()) < 1


# ============================================================================
# Integration Tests: API Endpoints
# ============================================================================


def test_create_template_with_daily_schedule(client: TestClient, home_with_user):
    """Test creating a quest template with daily schedule"""
    home_id, user_id, invite_code = home_with_user

    # Create template with daily schedule
    template_data = {
        "title": "Morning routine",
        "recurrence": "daily",
        "schedule": json.dumps({"type": "daily", "time": "08:00"}),
        "due_in_hours": 24,
    }
    response = client.post(
        f"/api/quests/templates?created_by={user_id}&skip_ai=true",
        json=template_data,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["recurrence"] == "daily"
    assert data["schedule"] == json.dumps({"type": "daily", "time": "08:00"})
    assert data["due_in_hours"] == 24


def test_create_template_with_weekly_schedule(client: TestClient, home_with_user):
    """Test creating a quest template with weekly schedule"""
    home_id, user_id, invite_code = home_with_user

    template_data = {
        "title": "Take out trash",
        "recurrence": "weekly",
        "schedule": json.dumps({"type": "weekly", "day": "monday", "time": "18:00"}),
    }
    response = client.post(
        f"/api/quests/templates?created_by={user_id}&skip_ai=true",
        json=template_data,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["recurrence"] == "weekly"


def test_create_template_with_monthly_schedule(client: TestClient, home_with_user):
    """Test creating a quest template with monthly schedule"""
    home_id, user_id, invite_code = home_with_user

    template_data = {
        "title": "Pay bills",
        "recurrence": "monthly",
        "schedule": json.dumps({"type": "monthly", "day": 15, "time": "08:00"}),
    }
    response = client.post(
        f"/api/quests/templates?created_by={user_id}&skip_ai=true",
        json=template_data,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["recurrence"] == "monthly"


def test_create_template_validation_rejects_mismatched_schedule(client: TestClient, home_with_user):
    """Test that validation rejects schedule type mismatch"""
    home_id, user_id, invite_code = home_with_user

    # Recurrence is "daily" but schedule type is "weekly"
    template_data = {
        "title": "Test",
        "recurrence": "daily",
        "schedule": json.dumps({"type": "weekly", "day": "monday", "time": "08:00"}),
    }
    response = client.post(
        f"/api/quests/templates?created_by={user_id}&skip_ai=true",
        json=template_data,
    )

    assert response.status_code == 400
    assert "must match recurrence" in response.json()["detail"]


def test_create_template_validation_rejects_invalid_time(client: TestClient, home_with_user):
    """Test that validation rejects invalid time format"""
    home_id, user_id, invite_code = home_with_user

    template_data = {
        "title": "Test",
        "recurrence": "daily",
        "schedule": json.dumps({"type": "daily", "time": "25:00"}),  # Invalid hour
    }
    response = client.post(
        f"/api/quests/templates?created_by={user_id}&skip_ai=true",
        json=template_data,
    )

    assert response.status_code == 400
    assert "Invalid time format" in response.json()["detail"]


def test_create_template_validation_rejects_invalid_day(client: TestClient, home_with_user):
    """Test that validation rejects invalid day for weekly schedule"""
    home_id, user_id, invite_code = home_with_user

    template_data = {
        "title": "Test",
        "recurrence": "weekly",
        "schedule": json.dumps({"type": "weekly", "day": "funday", "time": "08:00"}),
    }
    response = client.post(
        f"/api/quests/templates?created_by={user_id}&skip_ai=true",
        json=template_data,
    )

    assert response.status_code == 400
    assert "Invalid day" in response.json()["detail"]


def test_manual_generation_endpoint(client: TestClient, home_with_user):
    """Test the manual quest instance generation endpoint"""
    home_id, user_id, invite_code = home_with_user

    # Create template
    template_data = {
        "title": "Test quest",
        "recurrence": "daily",
        "schedule": json.dumps({"type": "daily", "time": "08:00"}),
        "due_in_hours": 48,
    }
    template_response = client.post(
        f"/api/quests/templates?created_by={user_id}&skip_ai=true",
        json=template_data,
    )
    template_id = template_response.json()["id"]

    # Manually generate instance
    response = client.post(f"/api/quests/templates/{template_id}/generate-instance")

    assert response.status_code == 200
    data = response.json()
    assert data["quest_template_id"] == template_id
    assert data["user_id"] == user_id
    assert data["completed"] is False
    assert data["due_in_hours"] == 48  # Should have due_in_hours from template


def test_quest_board_triggers_generation(client: TestClient, home_with_user):
    """Test that fetching quest board triggers automatic generation (Phase 3: needs subscription)"""
    home_id, user_id, invite_code = home_with_user

    # Create template
    template_data = {
        "title": "Daily quest",
        "xp_reward": 10,
        "gold_reward": 5,
    }
    template_response = client.post(
        f"/api/quests/templates?created_by={user_id}&skip_ai=true",
        json=template_data,
    )
    template_id = template_response.json()["id"]

    # Create subscription (Phase 3)
    subscription_data = {
        "quest_template_id": template_id,
        "recurrence": "daily",
        "schedule": json.dumps({"type": "daily", "time": "08:00"}),
    }
    client.post("/api/subscriptions", json=subscription_data)

    # Mock time as after scheduled time
    mock_now = datetime(2026, 1, 27, 9, 0, tzinfo=timezone.utc)

    class MockDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return mock_now

    with patch("app.services.recurring_quests.datetime", MockDatetime):
        # Fetch quest board (should trigger generation)
        response = client.get("/api/quests")

    assert response.status_code == 200
    quests = response.json()
    # Should have at least one quest generated
    assert len(quests) >= 1
