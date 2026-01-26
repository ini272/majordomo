from datetime import date

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def home_with_templates(client: TestClient):
    """Create a home with user and quest templates for bounty testing"""
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

    # Create quest templates
    templates = []
    template_data = [
        {"title": "Clean Kitchen", "xp_reward": 25, "gold_reward": 10},
        {"title": "Do Laundry", "xp_reward": 30, "gold_reward": 15},
        {"title": "Vacuum", "xp_reward": 20, "gold_reward": 10},
    ]

    for data in template_data:
        response = client.post(f"/api/quests/templates?created_by={user_id}&skip_ai=true", json=data)
        templates.append(response.json())

    return home_id, user_id, templates


def test_get_today_bounty_creates_new(client: TestClient, home_with_templates):
    """Test getting today's bounty creates one if it doesn't exist"""
    home_id, user_id, templates = home_with_templates

    # Get today's bounty (should create one)
    response = client.get("/api/bounty/today")

    assert response.status_code == 200
    data = response.json()
    assert data["bounty"] is not None
    assert data["template"] is not None
    assert data["bonus_multiplier"] == 2
    assert data["bounty"]["bounty_date"] == date.today().isoformat()

    # Template should be one of our created templates
    template_ids = [t["id"] for t in templates]
    assert data["template"]["id"] in template_ids


def test_get_today_bounty_returns_existing(client: TestClient, home_with_templates):
    """Test getting today's bounty returns the same one on multiple calls"""
    home_id, user_id, templates = home_with_templates

    # Get bounty first time
    response1 = client.get("/api/bounty/today")
    bounty1 = response1.json()["bounty"]

    # Get bounty second time
    response2 = client.get("/api/bounty/today")
    bounty2 = response2.json()["bounty"]

    # Should be the same bounty
    assert bounty1["id"] == bounty2["id"]
    assert bounty1["quest_template_id"] == bounty2["quest_template_id"]


def test_refresh_bounty(client: TestClient, home_with_templates):
    """Test refreshing today's bounty selects a new template"""
    home_id, user_id, templates = home_with_templates

    # Get initial bounty
    response1 = client.get("/api/bounty/today")
    response1.json()["bounty"]["quest_template_id"]

    # Refresh bounty
    response2 = client.post("/api/bounty/refresh")

    assert response2.status_code == 200
    new_bounty = response2.json()["bounty"]

    # Should have new bounty for today
    assert new_bounty["bounty_date"] == date.today().isoformat()

    # Template might be different (not guaranteed with random selection)
    # But it should be one of our templates
    template_ids = [t["id"] for t in templates]
    assert new_bounty["quest_template_id"] in template_ids


def test_check_template_is_bounty(client: TestClient, home_with_templates):
    """Test checking if a template is today's bounty"""
    home_id, user_id, templates = home_with_templates

    # Get today's bounty
    bounty_response = client.get("/api/bounty/today")
    bounty_template_id = bounty_response.json()["bounty"]["quest_template_id"]

    # Check the bounty template
    response = client.get(f"/api/bounty/check/{bounty_template_id}")

    assert response.status_code == 200
    assert response.json()["is_daily_bounty"] is True
    assert response.json()["bonus_multiplier"] == 2

    # Check a different template
    other_template_id = [t["id"] for t in templates if t["id"] != bounty_template_id][0]
    response2 = client.get(f"/api/bounty/check/{other_template_id}")

    assert response2.status_code == 200
    assert response2.json()["is_daily_bounty"] is False
    assert response2.json()["bonus_multiplier"] == 1


def test_complete_bounty_quest_gives_double_rewards(client: TestClient, home_with_templates):
    """Test completing a quest from today's bounty gives 2x rewards"""
    home_id, user_id, templates = home_with_templates

    # Get today's bounty
    bounty_response = client.get("/api/bounty/today")
    bounty_template = bounty_response.json()["template"]
    bounty_template_id = bounty_template["id"]

    # Create a quest from the bounty template
    quest_response = client.post(f"/api/quests?user_id={user_id}", json={"quest_template_id": bounty_template_id})
    quest_id = quest_response.json()["id"]

    # Get user stats before completion
    user_before = client.get("/api/users/me").json()
    xp_before = user_before["xp"]
    gold_before = user_before["gold_balance"]

    # Complete the quest
    complete_response = client.post(f"/api/quests/{quest_id}/complete")

    assert complete_response.status_code == 200
    result = complete_response.json()

    # Check rewards are doubled
    assert result["rewards"]["is_daily_bounty"] is True
    assert result["rewards"]["bounty_multiplier"] == 2
    assert result["rewards"]["xp"] == bounty_template["xp_reward"] * 2
    assert result["rewards"]["gold"] == bounty_template["gold_reward"] * 2

    # Verify user stats updated correctly
    user_after = client.get("/api/users/me").json()
    assert user_after["xp"] == xp_before + (bounty_template["xp_reward"] * 2)
    assert user_after["gold_balance"] == gold_before + (bounty_template["gold_reward"] * 2)


def test_complete_non_bounty_quest_gives_normal_rewards(client: TestClient, home_with_templates):
    """Test completing a non-bounty quest gives normal (1x) rewards"""
    home_id, user_id, templates = home_with_templates

    # Get today's bounty
    bounty_response = client.get("/api/bounty/today")
    bounty_template_id = bounty_response.json()["bounty"]["quest_template_id"]

    # Find a different template (not the bounty)
    other_template = [t for t in templates if t["id"] != bounty_template_id][0]

    # Create quest from non-bounty template
    quest_response = client.post(f"/api/quests?user_id={user_id}", json={"quest_template_id": other_template["id"]})
    quest_id = quest_response.json()["id"]

    # Get user stats before completion
    user_before = client.get("/api/users/me").json()
    xp_before = user_before["xp"]
    gold_before = user_before["gold_balance"]

    # Complete the quest
    complete_response = client.post(f"/api/quests/{quest_id}/complete")

    assert complete_response.status_code == 200
    result = complete_response.json()

    # Check rewards are NOT doubled
    assert result["rewards"]["is_daily_bounty"] is False
    assert result["rewards"]["bounty_multiplier"] == 1
    assert result["rewards"]["xp"] == other_template["xp_reward"]
    assert result["rewards"]["gold"] == other_template["gold_reward"]

    # Verify user stats updated correctly
    user_after = client.get("/api/users/me").json()
    assert user_after["xp"] == xp_before + other_template["xp_reward"]
    assert user_after["gold_balance"] == gold_before + other_template["gold_reward"]


def test_bounty_with_no_templates(client: TestClient):
    """Test getting bounty when home has no templates returns None"""
    # Create home and user via signup (but no templates)
    signup = client.post(
        "/api/auth/signup",
        json={
            "email": "testuser@example.com",
            "username": "testuser",
            "password": "testpass",
            "home_name": "Empty Home",
        },
    )
    assert signup.status_code == 200

    # Try to get bounty
    response = client.get("/api/bounty/today")

    assert response.status_code == 200
    data = response.json()
    assert data["bounty"] is None
    assert data["message"] == "No quest templates available to create bounty"
