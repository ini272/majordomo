"""Tests for user template subscriptions (Phase 3)"""

import json

from fastapi.testclient import TestClient


def test_create_subscription(client: TestClient, home_with_user):
    """Test creating a subscription to a template"""
    home_id, user_id, invite_code = home_with_user

    # Create template
    template_response = client.post(
        f"/api/quests/templates?created_by={user_id}",
        json={"title": "Clean Kitchen", "xp_reward": 25, "gold_reward": 10},
    )
    template_id = template_response.json()["id"]

    # Create subscription
    subscription_data = {
        "quest_template_id": template_id,
        "recurrence": "daily",
        "schedule": json.dumps({"type": "daily", "time": "08:00"}),
        "due_in_hours": 24,
    }
    response = client.post("/api/subscriptions", json=subscription_data)

    assert response.status_code == 201
    subscription = response.json()
    assert subscription["quest_template_id"] == template_id
    assert subscription["user_id"] == user_id
    assert subscription["recurrence"] == "daily"
    assert subscription["is_active"] is True


def test_get_my_subscriptions(client: TestClient, home_with_user):
    """Test retrieving user's subscriptions"""
    home_id, user_id, invite_code = home_with_user

    # Create template and subscription
    template_response = client.post(
        f"/api/quests/templates?created_by={user_id}",
        json={"title": "Clean Kitchen", "xp_reward": 25, "gold_reward": 10},
    )
    template_id = template_response.json()["id"]

    subscription_data = {
        "quest_template_id": template_id,
        "recurrence": "daily",
        "schedule": json.dumps({"type": "daily", "time": "08:00"}),
    }
    client.post("/api/subscriptions", json=subscription_data)

    # Get subscriptions
    response = client.get("/api/subscriptions")
    assert response.status_code == 200
    subscriptions = response.json()
    assert len(subscriptions) == 1
    assert subscriptions[0]["quest_template_id"] == template_id


def test_get_specific_subscription(client: TestClient, home_with_user):
    """Test retrieving a specific subscription"""
    home_id, user_id, invite_code = home_with_user

    # Create template and subscription
    template_response = client.post(
        f"/api/quests/templates?created_by={user_id}",
        json={"title": "Clean Kitchen", "xp_reward": 25, "gold_reward": 10},
    )
    template_id = template_response.json()["id"]

    sub_response = client.post(
        "/api/subscriptions",
        json={
            "quest_template_id": template_id,
            "recurrence": "daily",
            "schedule": json.dumps({"type": "daily", "time": "08:00"}),
        },
    )
    subscription_id = sub_response.json()["id"]

    # Get specific subscription
    response = client.get(f"/api/subscriptions/{subscription_id}")
    assert response.status_code == 200
    subscription = response.json()
    assert subscription["id"] == subscription_id
    assert subscription["quest_template_id"] == template_id


def test_update_subscription(client: TestClient, home_with_user):
    """Test updating a subscription's schedule"""
    home_id, user_id, invite_code = home_with_user

    # Create template and subscription
    template_response = client.post(
        f"/api/quests/templates?created_by={user_id}",
        json={"title": "Clean Kitchen", "xp_reward": 25, "gold_reward": 10},
    )
    template_id = template_response.json()["id"]

    sub_response = client.post(
        "/api/subscriptions",
        json={
            "quest_template_id": template_id,
            "recurrence": "daily",
            "schedule": json.dumps({"type": "daily", "time": "08:00"}),
        },
    )
    subscription_id = sub_response.json()["id"]

    # Update subscription to weekly
    update_response = client.patch(
        f"/api/subscriptions/{subscription_id}",
        json={
            "recurrence": "weekly",
            "schedule": json.dumps({"type": "weekly", "day": "monday", "time": "18:00"}),
        },
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["recurrence"] == "weekly"
    assert "monday" in updated["schedule"]


def test_pause_subscription(client: TestClient, home_with_user):
    """Test pausing a subscription"""
    home_id, user_id, invite_code = home_with_user

    # Create template and subscription
    template_response = client.post(
        f"/api/quests/templates?created_by={user_id}",
        json={"title": "Clean Kitchen", "xp_reward": 25, "gold_reward": 10},
    )
    template_id = template_response.json()["id"]

    sub_response = client.post(
        "/api/subscriptions",
        json={
            "quest_template_id": template_id,
            "recurrence": "daily",
            "schedule": json.dumps({"type": "daily", "time": "08:00"}),
        },
    )
    subscription_id = sub_response.json()["id"]

    # Pause subscription
    pause_response = client.patch(
        f"/api/subscriptions/{subscription_id}",
        json={"is_active": False},
    )
    assert pause_response.status_code == 200
    paused = pause_response.json()
    assert paused["is_active"] is False

    # Resume subscription
    resume_response = client.patch(
        f"/api/subscriptions/{subscription_id}",
        json={"is_active": True},
    )
    assert resume_response.status_code == 200
    resumed = resume_response.json()
    assert resumed["is_active"] is True


def test_delete_subscription(client: TestClient, home_with_user):
    """Test unsubscribing from a template"""
    home_id, user_id, invite_code = home_with_user

    # Create template and subscription
    template_response = client.post(
        f"/api/quests/templates?created_by={user_id}",
        json={"title": "Clean Kitchen", "xp_reward": 25, "gold_reward": 10},
    )
    template_id = template_response.json()["id"]

    sub_response = client.post(
        "/api/subscriptions",
        json={
            "quest_template_id": template_id,
            "recurrence": "daily",
            "schedule": json.dumps({"type": "daily", "time": "08:00"}),
        },
    )
    subscription_id = sub_response.json()["id"]

    # Delete subscription
    delete_response = client.delete(f"/api/subscriptions/{subscription_id}")
    assert delete_response.status_code == 204

    # Verify it's deleted
    get_response = client.get(f"/api/subscriptions/{subscription_id}")
    assert get_response.status_code == 404


def test_duplicate_subscription_fails(client: TestClient, home_with_user):
    """Test that subscribing twice to the same template fails"""
    home_id, user_id, invite_code = home_with_user

    # Create template
    template_response = client.post(
        f"/api/quests/templates?created_by={user_id}",
        json={"title": "Clean Kitchen", "xp_reward": 25, "gold_reward": 10},
    )
    template_id = template_response.json()["id"]

    # Create first subscription
    subscription_data = {
        "quest_template_id": template_id,
        "recurrence": "daily",
        "schedule": json.dumps({"type": "daily", "time": "08:00"}),
    }
    response1 = client.post("/api/subscriptions", json=subscription_data)
    assert response1.status_code == 201

    # Try to create duplicate
    response2 = client.post("/api/subscriptions", json=subscription_data)
    assert response2.status_code == 400
    assert "already subscribed" in response2.json()["detail"].lower()


def test_per_user_schedules(client: TestClient, home_with_user):
    """Test that different users can have different schedules for the same template (Phase 3)"""
    home_id, user1_id, invite_code = home_with_user

    # Create second user
    user2_response = client.post(
        "/api/auth/join",
        json={
            "invite_code": invite_code,
            "email": "user2@example.com",
            "username": "user2",
            "password": "user2pass",
        },
    )
    user2_id = user2_response.json()["user_id"]

    # Create shared template
    template_response = client.post(
        f"/api/quests/templates?created_by={user1_id}",
        json={"title": "Clean Kitchen", "xp_reward": 25, "gold_reward": 10},
    )
    template_id = template_response.json()["id"]

    # User1 subscribes daily
    user1_sub = client.post(
        "/api/subscriptions",
        json={
            "quest_template_id": template_id,
            "recurrence": "daily",
            "schedule": json.dumps({"type": "daily", "time": "08:00"}),
        },
    )
    assert user1_sub.status_code == 201
    user1_subscription = user1_sub.json()
    assert user1_subscription["recurrence"] == "daily"

    # User2 subscribes weekly (same template, different schedule)
    # First, login as user2 to get their auth context
    login_response = client.post(
        "/api/auth/login",
        json={"email": "user2@example.com", "password": "user2pass"},
    )
    assert login_response.status_code == 200

    user2_sub = client.post(
        "/api/subscriptions",
        json={
            "quest_template_id": template_id,
            "recurrence": "weekly",
            "schedule": json.dumps({"type": "weekly", "day": "monday", "time": "18:00"}),
        },
    )
    assert user2_sub.status_code == 201
    user2_subscription = user2_sub.json()
    assert user2_subscription["recurrence"] == "weekly"

    # Verify they have different schedules
    assert user1_subscription["recurrence"] != user2_subscription["recurrence"]
    assert user1_subscription["user_id"] != user2_subscription["user_id"]


def test_filter_active_subscriptions(client: TestClient, home_with_user):
    """Test filtering subscriptions by active status"""
    home_id, user_id, invite_code = home_with_user

    # Create two templates and subscriptions
    template1_response = client.post(
        f"/api/quests/templates?created_by={user_id}",
        json={"title": "Template 1", "xp_reward": 10, "gold_reward": 5},
    )
    template1_id = template1_response.json()["id"]

    template2_response = client.post(
        f"/api/quests/templates?created_by={user_id}",
        json={"title": "Template 2", "xp_reward": 10, "gold_reward": 5},
    )
    template2_id = template2_response.json()["id"]

    # Subscribe to both
    sub1_response = client.post(
        "/api/subscriptions",
        json={
            "quest_template_id": template1_id,
            "recurrence": "daily",
            "schedule": json.dumps({"type": "daily", "time": "08:00"}),
        },
    )
    sub1_id = sub1_response.json()["id"]

    client.post(
        "/api/subscriptions",
        json={
            "quest_template_id": template2_id,
            "recurrence": "daily",
            "schedule": json.dumps({"type": "daily", "time": "08:00"}),
        },
    )

    # Pause first subscription
    client.patch(f"/api/subscriptions/{sub1_id}", json={"is_active": False})

    # Get all subscriptions
    all_subs = client.get("/api/subscriptions").json()
    assert len(all_subs) == 2

    # Get only active subscriptions
    active_subs = client.get("/api/subscriptions?active_only=true").json()
    assert len(active_subs) == 1
    assert active_subs[0]["quest_template_id"] == template2_id
