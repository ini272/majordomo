"""Tests for quest corruption system"""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models.quest import Quest
from app.models.user import User


@pytest.fixture
def home_with_user_and_template(client: TestClient):
    """Create a home with user and quest template for corruption testing"""
    # Create home and user via signup
    signup = client.post(
        "/api/auth/signup",
        json={
            "email": "testuser@example.com",
            "username": "testuser",
            "password": "testpass",
            "home_name": "Test Home",
        },
    )
    home_id = signup.json()["home_id"]
    user_id = signup.json()["user_id"]

    # Create quest template with due_in_hours
    template_response = client.post(
        f"/api/quests/templates?created_by={user_id}",
        json={"title": "Test Quest", "xp_reward": 50, "gold_reward": 25, "due_in_hours": 24},
    )
    template_id = template_response.json()["id"]

    return home_id, user_id, template_id


def _parse_api_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None

    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def test_create_quest_with_due_in_hours(client: TestClient, home_with_user_and_template):
    """Test creating a quest with due_in_hours from template"""
    home_id, user_id, template_id = home_with_user_and_template

    response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["due_in_hours"] == 24  # Inherited from template
    assert data["quest_type"] == "standard"
    assert data["corrupted_at"] is None


def test_create_quest_without_due_in_hours(client: TestClient):
    """Test creating a quest without due_in_hours (optional)"""
    # Create home and user
    signup = client.post(
        "/api/auth/signup",
        json={
            "email": "testuser2@example.com",
            "username": "testuser2",
            "password": "testpass",
            "home_name": "Test Home 2",
        },
    )
    user_id = signup.json()["user_id"]

    # Create template without due_in_hours
    template_response = client.post(
        f"/api/quests/templates?created_by={user_id}",
        json={"title": "Test Quest", "xp_reward": 50, "gold_reward": 25},
    )
    template_id = template_response.json()["id"]

    response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["due_in_hours"] is None
    assert data["quest_type"] == "standard"


def test_overdue_quest_gets_corrupted(client: TestClient, home_with_user_and_template, db: Session):
    """Test that overdue quests are automatically marked as corrupted"""
    home_id, user_id, template_id = home_with_user_and_template

    # Create quest
    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id},
    )
    quest_id = quest_response.json()["id"]

    # Manually set created_at to 25 hours ago (past the 24-hour deadline)
    quest = db.exec(select(Quest).where(Quest.id == quest_id)).first()
    quest.created_at = datetime.now(timezone.utc) - timedelta(hours=25)
    db.add(quest)
    db.commit()

    # Trigger corruption check by getting all quests
    client.get("/api/quests")

    # Get the quest to verify it's corrupted
    response = client.get(f"/api/quests/{quest_id}?user_id={user_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["quest_type"] == "corrupted"
    assert data["corrupted_at"] is not None


def test_manual_corruption_check(client: TestClient, home_with_user_and_template, db: Session):
    """Test manual corruption check endpoint"""
    home_id, user_id, template_id = home_with_user_and_template

    # Create multiple quests
    quest_ids = []
    for _i in range(3):
        quest_response = client.post(
            f"/api/quests?user_id={user_id}",
            json={"quest_template_id": template_id},
        )
        quest_ids.append(quest_response.json()["id"])

    # Set all quests to be overdue
    for quest_id in quest_ids:
        quest = db.exec(select(Quest).where(Quest.id == quest_id)).first()
        quest.created_at = datetime.now(timezone.utc) - timedelta(hours=26)
        db.add(quest)
    db.commit()

    # Manually trigger corruption check
    response = client.post("/api/quests/check-corruption")

    assert response.status_code == 200
    data = response.json()
    assert data["corrupted_count"] == 3
    assert len(data["corrupted_quest_ids"]) == 3
    assert all(qid in data["corrupted_quest_ids"] for qid in quest_ids)


def test_completed_quest_not_corrupted(client: TestClient, home_with_user_and_template, db: Session):
    """Test that completed quests don't get corrupted even if overdue"""
    home_id, user_id, template_id = home_with_user_and_template

    # Create quest
    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id},
    )
    quest_id = quest_response.json()["id"]

    # Complete the quest
    client.post(f"/api/quests/{quest_id}/complete?user_id={user_id}")

    # Set quest to be overdue
    quest = db.exec(select(Quest).where(Quest.id == quest_id)).first()
    quest.created_at = datetime.now(timezone.utc) - timedelta(hours=26)
    db.add(quest)
    db.commit()

    # Trigger corruption check
    client.post("/api/quests/check-corruption")

    # Verify quest is not corrupted
    response = client.get(f"/api/quests/{quest_id}?user_id={user_id}")
    data = response.json()

    assert data["completed"] is True
    assert data["quest_type"] == "standard"  # Should remain standard, not corrupted


def test_corrupted_quest_gives_bonus_rewards(client: TestClient, home_with_user_and_template, db: Session):
    """Test that corrupted quests trigger house-wide debuff (reduced rewards)"""
    home_id, user_id, template_id = home_with_user_and_template

    # Create quest
    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id},
    )
    quest_id = quest_response.json()["id"]

    # Set quest to be overdue
    quest = db.exec(select(Quest).where(Quest.id == quest_id)).first()
    quest.created_at = datetime.now(timezone.utc) - timedelta(hours=26)
    db.add(quest)
    db.commit()

    # Trigger corruption
    client.post("/api/quests/check-corruption")

    # Get user stats before completion
    user_before = client.get(f"/api/users/{user_id}").json()
    user_before["xp"]
    user_before["gold_balance"]

    # Complete the corrupted quest
    complete_response = client.post(f"/api/quests/{quest_id}/complete?user_id={user_id}")

    assert complete_response.status_code == 200
    result = complete_response.json()

    # Verify corruption triggers debuff (not bonus)
    assert result["rewards"]["is_corrupted"] is True
    assert result["rewards"]["corruption_debuff"] == 0.8  # -20% flat debuff while corruption is active
    assert result["rewards"]["base_xp"] == 50
    assert result["rewards"]["base_gold"] == 25
    assert result["rewards"]["xp"] == 40
    assert result["rewards"]["gold"] == 20


def test_future_due_date_not_corrupted(client: TestClient, home_with_user_and_template):
    """Test that quests with future deadlines are not corrupted"""
    home_id, user_id, template_id = home_with_user_and_template

    # Create quest (has 24 hours from template)
    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id},
    )
    quest_id = quest_response.json()["id"]

    # Trigger corruption check
    client.post("/api/quests/check-corruption")

    # Verify quest is still standard (not overdue yet)
    response = client.get(f"/api/quests/{quest_id}?user_id={user_id}")
    data = response.json()

    assert data["quest_type"] == "standard"
    assert data["corrupted_at"] is None


def test_quest_without_due_in_hours_not_corrupted(client: TestClient):
    """Test that quests without due_in_hours are never corrupted"""
    # Create home and user
    signup = client.post(
        "/api/auth/signup",
        json={
            "email": "testuser3@example.com",
            "username": "testuser3",
            "password": "testpass",
            "home_name": "Test Home 3",
        },
    )
    user_id = signup.json()["user_id"]

    # Create template without due_in_hours
    template_response = client.post(
        f"/api/quests/templates?created_by={user_id}",
        json={"title": "Test Quest", "xp_reward": 50, "gold_reward": 25},
    )
    template_id = template_response.json()["id"]

    # Create quest without due_in_hours
    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id},
    )
    quest_id = quest_response.json()["id"]

    # Trigger corruption check multiple times
    for _i in range(3):
        client.post("/api/quests/check-corruption")

    # Verify quest is still standard
    response = client.get(f"/api/quests/{quest_id}?user_id={user_id}")
    data = response.json()

    assert data["quest_type"] == "standard"
    assert data["corrupted_at"] is None


def test_corrupted_quest_type_in_response(client: TestClient, home_with_user_and_template, db: Session):
    """Test that quest type is correctly reflected in all responses"""
    home_id, user_id, template_id = home_with_user_and_template

    # Create quest
    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id},
    )
    quest_id = quest_response.json()["id"]

    # Set quest to be overdue
    quest = db.exec(select(Quest).where(Quest.id == quest_id)).first()
    quest.created_at = datetime.now(timezone.utc) - timedelta(hours=26)
    db.add(quest)
    db.commit()

    # Trigger corruption
    client.post("/api/quests/check-corruption")

    # Check in different endpoints
    # 1. Get all quests
    all_quests = client.get("/api/quests").json()
    corrupted_quest = next(q for q in all_quests if q["id"] == quest_id)
    assert corrupted_quest["quest_type"] == "corrupted"

    # 2. Get user quests
    user_quests = client.get(f"/api/quests/user/{user_id}?home_id={home_id}").json()
    corrupted_quest = next(q for q in user_quests if q["id"] == quest_id)
    assert corrupted_quest["quest_type"] == "corrupted"

    # 3. Get single quest
    single_quest = client.get(f"/api/quests/{quest_id}?user_id={user_id}").json()
    assert single_quest["quest_type"] == "corrupted"


def test_corruption_reward_preview_updates_available_quests(
    client: TestClient, home_with_user_and_template, db: Session
):
    """Quest reads show reduced reward previews while household corruption is active."""
    _home_id, user_id, template_id = home_with_user_and_template

    corrupted_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id},
    )
    standard_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id},
    )
    corrupted_quest_id = corrupted_response.json()["id"]
    standard_quest_id = standard_response.json()["id"]

    quest = db.exec(select(Quest).where(Quest.id == corrupted_quest_id)).first()
    quest.created_at = datetime.now(timezone.utc) - timedelta(hours=26)
    db.add(quest)
    db.commit()

    client.post("/api/quests/check-corruption")

    all_quests = client.get("/api/quests").json()
    quest_by_id = {quest_data["id"]: quest_data for quest_data in all_quests}
    corrupted_quest = quest_by_id[corrupted_quest_id]
    standard_quest = quest_by_id[standard_quest_id]

    assert corrupted_quest["quest_type"] == "corrupted"
    assert standard_quest["quest_type"] == "standard"
    for quest_data in (corrupted_quest, standard_quest):
        assert quest_data["corrupted_quest_count"] == 1
        assert quest_data["corruption_debuff"] == 0.8
        assert quest_data["corruption_debuff_active"] is True
        assert quest_data["effective_xp_reward"] == 40
        assert quest_data["effective_gold_reward"] == 20

    single_quest = client.get(f"/api/quests/{standard_quest_id}").json()
    assert single_quest["effective_xp_reward"] == 40
    assert single_quest["effective_gold_reward"] == 20

    user_quests = client.get(f"/api/quests/user/{user_id}").json()
    user_standard_quest = next(
        quest_data for quest_data in user_quests if quest_data["id"] == standard_quest_id
    )
    assert user_standard_quest["effective_xp_reward"] == 40
    assert user_standard_quest["effective_gold_reward"] == 20


def test_corruption_reward_preview_stays_flat_with_multiple_corrupted_quests(
    client: TestClient, home_with_user_and_template, db: Session
):
    """Multiple corrupted quests still apply the same flat household debuff."""
    _home_id, user_id, template_id = home_with_user_and_template

    quest_ids = []
    for _i in range(3):
        quest_response = client.post(
            f"/api/quests?user_id={user_id}",
            json={"quest_template_id": template_id},
        )
        quest_ids.append(quest_response.json()["id"])

    for quest_id in quest_ids:
        quest = db.exec(select(Quest).where(Quest.id == quest_id)).first()
        quest.created_at = datetime.now(timezone.utc) - timedelta(hours=26)
        db.add(quest)
    db.commit()

    client.post("/api/quests/check-corruption")

    all_quests = client.get("/api/quests").json()
    for quest_data in all_quests:
        assert quest_data["corrupted_quest_count"] == 3
        assert quest_data["corruption_debuff"] == 0.8
        assert quest_data["effective_xp_reward"] == 40
        assert quest_data["effective_gold_reward"] == 20


def test_corruption_reward_preview_respects_active_shield(
    client: TestClient, home_with_user_and_template, db: Session
):
    """A user's active shield suppresses the previewed corruption debuff."""
    _home_id, user_id, template_id = home_with_user_and_template

    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id},
    )
    quest_id = quest_response.json()["id"]

    quest = db.exec(select(Quest).where(Quest.id == quest_id)).first()
    quest.created_at = datetime.now(timezone.utc) - timedelta(hours=26)
    db.add(quest)

    user = db.exec(select(User).where(User.id == user_id)).first()
    user.active_shield_expiry = datetime.now(timezone.utc) + timedelta(hours=1)
    db.add(user)
    db.commit()

    client.post("/api/quests/check-corruption")

    quest_data = client.get(f"/api/quests/{quest_id}").json()
    assert quest_data["corrupted_quest_count"] == 1
    assert quest_data["corruption_debuff"] == 1.0
    assert quest_data["corruption_debuff_active"] is False
    assert quest_data["effective_xp_reward"] == 50
    assert quest_data["effective_gold_reward"] == 25


def test_corruption_timestamp_set_correctly(client: TestClient, home_with_user_and_template, db: Session):
    """Test that corrupted_at timestamp is set when quest becomes corrupted"""
    home_id, user_id, template_id = home_with_user_and_template

    # Create quest
    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id},
    )
    quest_id = quest_response.json()["id"]

    # Set quest to be overdue
    quest = db.exec(select(Quest).where(Quest.id == quest_id)).first()
    quest.created_at = datetime.now(timezone.utc) - timedelta(hours=26)
    db.add(quest)
    db.commit()

    # Get current time before corruption
    before_corruption = datetime.now(timezone.utc)

    # Trigger corruption
    client.post("/api/quests/check-corruption")

    # Get quest
    quest = client.get(f"/api/quests/{quest_id}?user_id={user_id}").json()

    assert quest["corrupted_at"] is not None

    # Verify timestamp is recent - parse ISO format and ensure timezone awareness
    corrupted_at_str = quest["corrupted_at"]
    if corrupted_at_str.endswith("Z"):
        corrupted_at_str = corrupted_at_str[:-1] + "+00:00"

    corrupted_at = datetime.fromisoformat(corrupted_at_str)

    # If datetime is naive, make it timezone-aware
    if corrupted_at.tzinfo is None:
        corrupted_at = corrupted_at.replace(tzinfo=timezone.utc)

    # Ensure both datetimes are timezone-aware for comparison
    assert corrupted_at.tzinfo is not None
    assert before_corruption.tzinfo is not None
    assert corrupted_at >= before_corruption
    assert corrupted_at <= datetime.now(timezone.utc) + timedelta(seconds=5)


def test_daily_bounty_and_corruption_combined(client: TestClient, home_with_user_and_template, db: Session):
    """Test that a quest can be both a daily bounty and corrupted (debuff + bounty gold bonus apply)."""
    home_id, user_id, template_id = home_with_user_and_template

    # Update template to have due_in_hours
    client.put(
        f"/api/quests/templates/{template_id}",
        json={"due_in_hours": 24},
    )

    # Create quest from template
    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id},
    )
    quest_id = quest_response.json()["id"]

    # Set quest old enough for bounty (48h+) and overdue (due_in_hours=24)
    quest = db.exec(select(Quest).where(Quest.id == quest_id)).first()
    quest.created_at = datetime.now(timezone.utc) - timedelta(hours=50)
    db.add(quest)
    db.commit()

    # Trigger corruption
    client.post("/api/quests/check-corruption")

    # Complete the quest
    complete_response = client.post(f"/api/quests/{quest_id}/complete?user_id={user_id}")

    result = complete_response.json()

    # Both bounty and corruption should be true
    assert result["rewards"]["is_daily_bounty"] is True
    assert result["rewards"]["is_corrupted"] is True

    # Check that both debuff and bounty multipliers are applied
    # Debuff: -20% while corruption is active, Bounty: XP x1 and Gold x3
    assert result["rewards"]["corruption_debuff"] == 0.8
    assert result["rewards"]["bounty_multiplier"] == 3
    assert result["rewards"]["bounty_xp_multiplier"] == 1
    assert result["rewards"]["bounty_gold_multiplier"] == 3


def test_update_quest_due_in_hours(client: TestClient):
    """Test updating a quest's due_in_hours"""
    # Create home and user
    signup = client.post(
        "/api/auth/signup",
        json={
            "email": "testuser4@example.com",
            "username": "testuser4",
            "password": "testpass",
            "home_name": "Test Home 4",
        },
    )
    user_id = signup.json()["user_id"]

    # Create template without due_in_hours
    template_response = client.post(
        f"/api/quests/templates?created_by={user_id}",
        json={"title": "Test Quest", "xp_reward": 50, "gold_reward": 25},
    )
    template_id = template_response.json()["id"]

    # Create quest without due_in_hours
    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id},
    )
    quest_id = quest_response.json()["id"]

    # Update with due_in_hours
    before_update = datetime.now(timezone.utc)
    update_response = client.put(
        f"/api/quests/{quest_id}?user_id={user_id}",
        json={"due_in_hours": 48},
    )
    after_update = datetime.now(timezone.utc)

    assert update_response.status_code == 200
    data = update_response.json()
    assert data["due_in_hours"] == 48
    due_date = _parse_api_datetime(data["due_date"])
    assert due_date is not None
    assert before_update + timedelta(hours=48) <= due_date <= after_update + timedelta(hours=48)


def test_extending_corrupted_quest_clears_corruption_and_restarts_deadline(
    client: TestClient, home_with_user_and_template, db: Session
):
    """Updating a corrupted quest timer should heal it and start the new deadline from now."""
    home_id, user_id, template_id = home_with_user_and_template

    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id},
    )
    quest_id = quest_response.json()["id"]

    quest = db.exec(select(Quest).where(Quest.id == quest_id)).first()
    quest.created_at = datetime.now(timezone.utc) - timedelta(hours=26)
    db.add(quest)
    db.commit()

    client.post("/api/quests/check-corruption")

    before_update = datetime.now(timezone.utc)
    update_response = client.put(
        f"/api/quests/{quest_id}?user_id={user_id}",
        json={"due_in_hours": 24 * 14},
    )
    after_update = datetime.now(timezone.utc)

    assert update_response.status_code == 200
    data = update_response.json()
    assert data["quest_type"] == "standard"
    assert data["corrupted_at"] is None
    assert data["due_in_hours"] == 24 * 14

    due_date = _parse_api_datetime(data["due_date"])
    assert due_date is not None
    assert before_update + timedelta(days=14) <= due_date <= after_update + timedelta(days=14)

    client.post("/api/quests/check-corruption")
    refreshed = client.get(f"/api/quests/{quest_id}?user_id={user_id}").json()
    assert refreshed["quest_type"] == "standard"
    assert refreshed["corrupted_at"] is None


def test_clearing_corrupted_quest_timer_removes_corruption(
    client: TestClient, home_with_user_and_template, db: Session
):
    """Removing the timer from a corrupted quest should clear its corrupted state."""
    home_id, user_id, template_id = home_with_user_and_template

    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id},
    )
    quest_id = quest_response.json()["id"]

    quest = db.exec(select(Quest).where(Quest.id == quest_id)).first()
    quest.created_at = datetime.now(timezone.utc) - timedelta(hours=26)
    db.add(quest)
    db.commit()

    client.post("/api/quests/check-corruption")

    update_response = client.put(
        f"/api/quests/{quest_id}?user_id={user_id}",
        json={"due_in_hours": None},
    )

    assert update_response.status_code == 200
    data = update_response.json()
    assert data["due_in_hours"] is None
    assert data["due_date"] is None
    assert data["quest_type"] == "standard"
    assert data["corrupted_at"] is None

    client.post("/api/quests/check-corruption")
    refreshed = client.get(f"/api/quests/{quest_id}?user_id={user_id}").json()
    assert refreshed["quest_type"] == "standard"
    assert refreshed["corrupted_at"] is None


def test_clearing_one_corrupted_quest_keeps_household_debuff_if_others_remain(
    client: TestClient, home_with_user_and_template, db: Session
):
    """Healing one quest should not clear the household debuff while another corruption remains."""
    home_id, user_id, template_id = home_with_user_and_template

    quest_ids = []
    for _i in range(2):
        quest_response = client.post(
            f"/api/quests?user_id={user_id}",
            json={"quest_template_id": template_id},
        )
        quest_ids.append(quest_response.json()["id"])

    for quest_id in quest_ids:
        quest = db.exec(select(Quest).where(Quest.id == quest_id)).first()
        quest.created_at = datetime.now(timezone.utc) - timedelta(hours=26)
        db.add(quest)
    db.commit()

    client.post("/api/quests/check-corruption")

    update_response = client.put(
        f"/api/quests/{quest_ids[0]}?user_id={user_id}",
        json={"due_in_hours": None},
    )
    assert update_response.status_code == 200

    quests = client.get("/api/quests").json()
    quest_by_id = {quest["id"]: quest for quest in quests}
    healed_quest = quest_by_id[quest_ids[0]]
    still_corrupted_quest = quest_by_id[quest_ids[1]]

    assert healed_quest["quest_type"] == "standard"
    assert healed_quest["corrupted_quest_count"] == 1
    assert healed_quest["corruption_debuff"] == 0.8
    assert healed_quest["corruption_debuff_active"] is True

    assert still_corrupted_quest["quest_type"] == "corrupted"
    assert still_corrupted_quest["corrupted_quest_count"] == 1
