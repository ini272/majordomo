"""Tests for quest corruption system"""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient


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

    # Create quest template
    template_response = client.post(
        f"/api/quests/templates?created_by={user_id}",
        json={"title": "Test Quest", "xp_reward": 50, "gold_reward": 25},
    )
    template_id = template_response.json()["id"]

    return home_id, user_id, template_id


def test_create_quest_with_due_date(client: TestClient, home_with_user_and_template):
    """Test creating a quest with a due date"""
    home_id, user_id, template_id = home_with_user_and_template

    # Set due date to tomorrow
    due_date = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()

    response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id, "due_date": due_date},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["due_date"] is not None
    assert data["quest_type"] == "standard"
    assert data["corrupted_at"] is None


def test_create_quest_without_due_date(client: TestClient, home_with_user_and_template):
    """Test creating a quest without a due date (optional)"""
    home_id, user_id, template_id = home_with_user_and_template

    response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["due_date"] is None
    assert data["quest_type"] == "standard"


def test_overdue_quest_gets_corrupted(client: TestClient, home_with_user_and_template):
    """Test that overdue quests are automatically marked as corrupted"""
    home_id, user_id, template_id = home_with_user_and_template

    # Create quest with due date in the past
    past_due_date = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id, "due_date": past_due_date},
    )
    quest_id = quest_response.json()["id"]

    # Trigger corruption check by getting all quests
    client.get("/api/quests")

    # Get the quest to verify it's corrupted
    response = client.get(f"/api/quests/{quest_id}?user_id={user_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["quest_type"] == "corrupted"
    assert data["corrupted_at"] is not None


def test_manual_corruption_check(client: TestClient, home_with_user_and_template):
    """Test manual corruption check endpoint"""
    home_id, user_id, template_id = home_with_user_and_template

    # Create multiple quests with past due dates
    past_due_date = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()

    quest_ids = []
    for _i in range(3):
        quest_response = client.post(
            f"/api/quests?user_id={user_id}",
            json={"quest_template_id": template_id, "due_date": past_due_date},
        )
        quest_ids.append(quest_response.json()["id"])

    # Manually trigger corruption check
    response = client.post("/api/quests/check-corruption")

    assert response.status_code == 200
    data = response.json()
    assert data["corrupted_count"] == 3
    assert len(data["corrupted_quest_ids"]) == 3
    assert all(qid in data["corrupted_quest_ids"] for qid in quest_ids)


def test_completed_quest_not_corrupted(client: TestClient, home_with_user_and_template):
    """Test that completed quests don't get corrupted even if overdue"""
    home_id, user_id, template_id = home_with_user_and_template

    # Create quest with due date in the past
    past_due_date = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id, "due_date": past_due_date},
    )
    quest_id = quest_response.json()["id"]

    # Complete the quest
    client.post(f"/api/quests/{quest_id}/complete?user_id={user_id}")

    # Trigger corruption check
    client.post("/api/quests/check-corruption")

    # Verify quest is not corrupted
    response = client.get(f"/api/quests/{quest_id}?user_id={user_id}")
    data = response.json()

    assert data["completed"] is True
    assert data["quest_type"] == "standard"  # Should remain standard, not corrupted


def test_corrupted_quest_gives_bonus_rewards(client: TestClient, home_with_user_and_template):
    """Test that corrupted quests trigger house-wide debuff (reduced rewards)"""
    home_id, user_id, template_id = home_with_user_and_template

    # Create quest with past due date
    past_due_date = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id, "due_date": past_due_date},
    )
    quest_id = quest_response.json()["id"]

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
    assert result["rewards"]["corruption_debuff"] == 0.95  # -5% debuff (1 corrupted quest)
    assert result["rewards"]["base_xp"] == 50
    assert result["rewards"]["base_gold"] == 25
    # After debuff: 50 * 0.95 = 47 XP, 25 * 0.95 = 23 gold (floored to int)
    assert result["rewards"]["xp"] == 47
    assert result["rewards"]["gold"] == 23


def test_future_due_date_not_corrupted(client: TestClient, home_with_user_and_template):
    """Test that quests with future due dates are not corrupted"""
    home_id, user_id, template_id = home_with_user_and_template

    # Create quest with due date in the future
    future_due_date = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()

    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id, "due_date": future_due_date},
    )
    quest_id = quest_response.json()["id"]

    # Trigger corruption check
    client.post("/api/quests/check-corruption")

    # Verify quest is still standard
    response = client.get(f"/api/quests/{quest_id}?user_id={user_id}")
    data = response.json()

    assert data["quest_type"] == "standard"
    assert data["corrupted_at"] is None


def test_quest_without_due_date_not_corrupted(client: TestClient, home_with_user_and_template):
    """Test that quests without due dates are never corrupted"""
    home_id, user_id, template_id = home_with_user_and_template

    # Create quest without due date
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


def test_corrupted_quest_type_in_response(client: TestClient, home_with_user_and_template):
    """Test that quest type is correctly reflected in all responses"""
    home_id, user_id, template_id = home_with_user_and_template

    # Create quest with past due date
    past_due_date = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id, "due_date": past_due_date},
    )
    quest_id = quest_response.json()["id"]

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


def test_corruption_timestamp_set_correctly(client: TestClient, home_with_user_and_template):
    """Test that corrupted_at timestamp is set when quest becomes corrupted"""
    home_id, user_id, template_id = home_with_user_and_template

    # Create quest with past due date
    past_due_date = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id, "due_date": past_due_date},
    )
    quest_id = quest_response.json()["id"]

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


def test_daily_bounty_and_corruption_combined(client: TestClient, home_with_user_and_template):
    """Test that a quest can be both a daily bounty and corrupted (debuff + bounty multiplier apply)"""
    home_id, user_id, template_id = home_with_user_and_template

    # Get today's bounty
    bounty_response = client.get("/api/bounty/today")
    bounty_template_id = bounty_response.json()["bounty"]["quest_template_id"]

    # Create quest from bounty template with past due date
    past_due_date = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": bounty_template_id, "due_date": past_due_date},
    )
    quest_id = quest_response.json()["id"]

    # Trigger corruption
    client.post("/api/quests/check-corruption")

    # Complete the quest
    complete_response = client.post(f"/api/quests/{quest_id}/complete?user_id={user_id}")

    result = complete_response.json()

    # Both bounty and corruption should be true
    assert result["rewards"]["is_daily_bounty"] is True
    assert result["rewards"]["is_corrupted"] is True

    # Check that both debuff and bounty multiplier are applied
    # Debuff: -5% (0.95) for 1 corrupted quest, Bounty: 2x
    assert result["rewards"]["corruption_debuff"] == 0.95
    assert result["rewards"]["bounty_multiplier"] == 2
    # Calculation: base * 0.95 * 2 = base * 1.9 (net positive due to bounty)


def test_update_quest_due_date(client: TestClient, home_with_user_and_template):
    """Test updating a quest's due date"""
    home_id, user_id, template_id = home_with_user_and_template

    # Create quest without due date
    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"quest_template_id": template_id},
    )
    quest_id = quest_response.json()["id"]

    # Update with due date
    new_due_date = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    update_response = client.put(
        f"/api/quests/{quest_id}?user_id={user_id}",
        json={"due_date": new_due_date},
    )

    assert update_response.status_code == 200
    data = update_response.json()
    assert data["due_date"] is not None
