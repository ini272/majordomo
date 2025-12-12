import pytest
from fastapi.testclient import TestClient


def test_create_quest(client: TestClient):
    """Test creating a quest for a user"""
    # Create user first
    user_response = client.post("/api/users", json={"username": "testuser"})
    user_id = user_response.json()["id"]
    
    # Create quest
    quest_data = {
        "title": "Clean the kitchen",
        "description": "Scrub the counters and sink",
        "xp_reward": 25,
        "gold_reward": 10,
        "recurrence": "one-off"
    }
    response = client.post(f"/api/quests?user_id={user_id}", json=quest_data)
    assert response.status_code == 200
    assert response.json()["title"] == "Clean the kitchen"
    assert response.json()["completed"] is False


def test_get_all_quests(client: TestClient):
    """Test retrieving all quests"""
    # Create user and multiple quests
    user_response = client.post("/api/users", json={"username": "testuser"})
    user_id = user_response.json()["id"]
    
    for i in range(3):
        client.post(
            f"/api/quests?user_id={user_id}",
            json={"title": f"Quest {i}", "xp_reward": 10, "gold_reward": 5}
        )
    
    # Retrieve all quests
    response = client.get("/api/quests")
    assert response.status_code == 200
    assert len(response.json()) == 3


def test_get_quest(client: TestClient):
    """Test retrieving a quest"""
    # Create user and quest
    user_response = client.post("/api/users", json={"username": "testuser"})
    user_id = user_response.json()["id"]
    
    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"title": "Test quest", "xp_reward": 10, "gold_reward": 5}
    )
    quest_id = quest_response.json()["id"]
    
    # Retrieve quest
    response = client.get(f"/api/quests/{quest_id}?user_id={user_id}")
    assert response.status_code == 200
    assert response.json()["title"] == "Test quest"


def test_get_user_quests(client: TestClient):
    """Test retrieving all quests for a user"""
    # Create user
    user_response = client.post("/api/users", json={"username": "testuser"})
    user_id = user_response.json()["id"]
    
    # Create multiple quests
    for i in range(3):
        client.post(
            f"/api/quests?user_id={user_id}",
            json={"title": f"Quest {i}", "xp_reward": 10, "gold_reward": 5}
        )
    
    # Retrieve all quests
    response = client.get(f"/api/quests/user/{user_id}")
    assert response.status_code == 200
    assert len(response.json()) == 3


def test_get_user_quests_filtered(client: TestClient):
    """Test retrieving quests filtered by completion status"""
    # Create user
    user_response = client.post("/api/users", json={"username": "testuser"})
    user_id = user_response.json()["id"]
    
    # Create and complete one quest
    quest1 = client.post(
        f"/api/quests?user_id={user_id}",
        json={"title": "Quest 1", "xp_reward": 10, "gold_reward": 5}
    ).json()
    client.post(f"/api/quests/{quest1['id']}/complete?user_id={user_id}")
    
    # Create another incomplete quest
    client.post(
        f"/api/quests?user_id={user_id}",
        json={"title": "Quest 2", "xp_reward": 10, "gold_reward": 5}
    )
    
    # Filter for incomplete quests
    response = client.get(f"/api/quests/user/{user_id}?completed=false")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["title"] == "Quest 2"


def test_complete_quest(client: TestClient):
    """Test completing a quest and awarding XP/gold"""
    # Create user
    user_response = client.post("/api/users", json={"username": "testuser"})
    user_id = user_response.json()["id"]
    
    # Create quest
    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"title": "Test quest", "xp_reward": 50, "gold_reward": 25}
    )
    quest_id = quest_response.json()["id"]
    
    # Complete quest
    response = client.post(f"/api/quests/{quest_id}/complete?user_id={user_id}")
    assert response.status_code == 200
    assert response.json()["completed"] is True
    
    # Verify user received XP and gold
    user = client.get(f"/api/users/{user_id}").json()
    assert user["xp"] == 50
    assert user["gold_balance"] == 25


def test_complete_quest_updates_level(client: TestClient):
    """Test that completing a quest updates user level"""
    # Create user
    user_response = client.post("/api/users", json={"username": "testuser"})
    user_id = user_response.json()["id"]
    
    # Create quest with enough XP to level up
    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"title": "Mega quest", "xp_reward": 100, "gold_reward": 10}
    )
    quest_id = quest_response.json()["id"]
    
    # Complete quest
    client.post(f"/api/quests/{quest_id}/complete?user_id={user_id}")
    
    # Verify user leveled up
    user = client.get(f"/api/users/{user_id}").json()
    assert user["level"] == 2
    assert user["xp"] == 100


def test_update_quest(client: TestClient):
    """Test updating a quest"""
    # Create user and quest
    user_response = client.post("/api/users", json={"username": "testuser"})
    user_id = user_response.json()["id"]
    
    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"title": "Old title", "xp_reward": 10, "gold_reward": 5}
    )
    quest_id = quest_response.json()["id"]
    
    # Update quest
    response = client.put(
        f"/api/quests/{quest_id}?user_id={user_id}",
        json={"title": "New title", "xp_reward": 50}
    )
    assert response.status_code == 200
    assert response.json()["title"] == "New title"
    assert response.json()["xp_reward"] == 50


def test_complete_quest_twice_fails(client: TestClient):
    """Test that completing a quest twice is prevented"""
    # Create user and quest
    user_response = client.post("/api/users", json={"username": "testuser"})
    user_id = user_response.json()["id"]
    
    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"title": "Test quest", "xp_reward": 50, "gold_reward": 25}
    )
    quest_id = quest_response.json()["id"]
    
    # Complete quest first time
    response = client.post(f"/api/quests/{quest_id}/complete?user_id={user_id}")
    assert response.status_code == 200
    
    # Try to complete again
    response = client.post(f"/api/quests/{quest_id}/complete?user_id={user_id}")
    assert response.status_code == 400
    assert "already completed" in response.json()["detail"]


def test_quest_ownership_validation(client: TestClient):
    """Test that users can't access other users' quests"""
    # Create two users
    user1_response = client.post("/api/users", json={"username": "user1"})
    user1_id = user1_response.json()["id"]
    
    user2_response = client.post("/api/users", json={"username": "user2"})
    user2_id = user2_response.json()["id"]
    
    # User1 creates a quest
    quest_response = client.post(
        f"/api/quests?user_id={user1_id}",
        json={"title": "User1's quest", "xp_reward": 10, "gold_reward": 5}
    )
    quest_id = quest_response.json()["id"]
    
    # User2 tries to access user1's quest
    response = client.get(f"/api/quests/{quest_id}?user_id={user2_id}")
    assert response.status_code == 403
    assert "Not authorized" in response.json()["detail"]
    
    # User2 tries to complete user1's quest
    response = client.post(f"/api/quests/{quest_id}/complete?user_id={user2_id}")
    assert response.status_code == 403
    assert "Not authorized" in response.json()["detail"]


def test_delete_quest(client: TestClient):
    """Test deleting a quest"""
    # Create user and quest
    user_response = client.post("/api/users", json={"username": "testuser"})
    user_id = user_response.json()["id"]
    
    quest_response = client.post(
        f"/api/quests?user_id={user_id}",
        json={"title": "Test quest", "xp_reward": 10, "gold_reward": 5}
    )
    quest_id = quest_response.json()["id"]
    
    # Delete quest
    response = client.delete(f"/api/quests/{quest_id}?user_id={user_id}")
    assert response.status_code == 200
    
    # Verify quest is deleted
    response = client.get(f"/api/quests/{quest_id}?user_id={user_id}")
    assert response.status_code == 404
