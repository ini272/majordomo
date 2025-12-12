import pytest
from fastapi.testclient import TestClient


def test_create_user(client: TestClient):
    """Test creating a new user"""
    response = client.post("/api/users", json={"username": "testuser"})
    assert response.status_code == 200
    assert response.json()["username"] == "testuser"
    assert response.json()["level"] == 1
    assert response.json()["xp"] == 0
    assert response.json()["gold_balance"] == 0


def test_create_user_duplicate_username(client: TestClient):
    """Test that duplicate usernames are rejected"""
    client.post("/api/users", json={"username": "testuser"})
    response = client.post("/api/users", json={"username": "testuser"})
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


def test_get_user(client: TestClient):
    """Test retrieving a user"""
    # Create user
    create_response = client.post("/api/users", json={"username": "testuser"})
    user_id = create_response.json()["id"]
    
    # Retrieve user
    response = client.get(f"/api/users/{user_id}")
    assert response.status_code == 200
    assert response.json()["username"] == "testuser"


def test_get_user_not_found(client: TestClient):
    """Test retrieving a non-existent user"""
    response = client.get("/api/users/999")
    assert response.status_code == 404


def test_get_all_users(client: TestClient):
    """Test retrieving all users"""
    client.post("/api/users", json={"username": "user1"})
    client.post("/api/users", json={"username": "user2"})
    
    response = client.get("/api/users")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_update_user(client: TestClient):
    """Test updating a user"""
    # Create user
    create_response = client.post("/api/users", json={"username": "testuser"})
    user_id = create_response.json()["id"]
    
    # Update user
    response = client.put(f"/api/users/{user_id}", json={"xp": 100})
    assert response.status_code == 200
    assert response.json()["xp"] == 100


def test_add_xp_to_user(client: TestClient):
    """Test adding XP to a user"""
    # Create user
    create_response = client.post("/api/users", json={"username": "testuser"})
    user_id = create_response.json()["id"]
    
    # Add XP
    response = client.post(f"/api/users/{user_id}/xp?amount=100")
    assert response.status_code == 200
    assert response.json()["xp"] == 100


def test_level_progression(client: TestClient):
    """Test that level increases with XP"""
    # Create user
    create_response = client.post("/api/users", json={"username": "testuser"})
    user_id = create_response.json()["id"]
    
    # Add XP to reach level 2 (requires 100 XP)
    response = client.post(f"/api/users/{user_id}/xp?amount=100")
    assert response.status_code == 200
    assert response.json()["level"] == 2
    assert response.json()["xp"] == 100


def test_add_gold_to_user(client: TestClient):
    """Test adding gold to a user"""
    # Create user
    create_response = client.post("/api/users", json={"username": "testuser"})
    user_id = create_response.json()["id"]
    
    # Add gold
    response = client.post(f"/api/users/{user_id}/gold?amount=50")
    assert response.status_code == 200
    assert response.json()["gold_balance"] == 50


def test_delete_user(client: TestClient):
    """Test deleting a user"""
    # Create user
    create_response = client.post("/api/users", json={"username": "testuser"})
    user_id = create_response.json()["id"]
    
    # Delete user
    response = client.delete(f"/api/users/{user_id}")
    assert response.status_code == 200
    
    # Verify user is deleted
    response = client.get(f"/api/users/{user_id}")
    assert response.status_code == 404
