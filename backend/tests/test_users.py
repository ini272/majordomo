import pytest
from fastapi.testclient import TestClient


def test_get_user(client: TestClient):
    """Test retrieving a user"""
    # Create home
    home_response = client.post("/api/homes", json={"name": "Test Home"})
    home_id = home_response.json()["id"]
    
    # Create user
    user_response = client.post(
        f"/api/homes/{home_id}/join",
        json={"username": "testuser"}
    )
    user_id = user_response.json()["id"]
    
    # Retrieve user
    response = client.get(f"/api/users/{user_id}")
    assert response.status_code == 200
    assert response.json()["username"] == "testuser"


def test_get_user_not_found(client: TestClient):
    """Test retrieving a non-existent user"""
    response = client.get("/api/users/999")
    assert response.status_code == 404


def test_update_user(client: TestClient):
    """Test updating a user"""
    # Create home and user
    home_response = client.post("/api/homes", json={"name": "Test Home"})
    home_id = home_response.json()["id"]
    
    user_response = client.post(
        f"/api/homes/{home_id}/join",
        json={"username": "testuser"}
    )
    user_id = user_response.json()["id"]
    
    # Update user
    response = client.put(f"/api/users/{user_id}", json={"xp": 100})
    assert response.status_code == 200
    assert response.json()["xp"] == 100


def test_add_xp_to_user(client: TestClient):
    """Test adding XP to a user"""
    # Create home and user
    home_response = client.post("/api/homes", json={"name": "Test Home"})
    home_id = home_response.json()["id"]
    
    user_response = client.post(
        f"/api/homes/{home_id}/join",
        json={"username": "testuser"}
    )
    user_id = user_response.json()["id"]
    
    # Add XP
    response = client.post(f"/api/users/{user_id}/xp?amount=100")
    assert response.status_code == 200
    assert response.json()["xp"] == 100


def test_level_progression(client: TestClient):
    """Test that level increases with XP"""
    # Create home and user
    home_response = client.post("/api/homes", json={"name": "Test Home"})
    home_id = home_response.json()["id"]
    
    user_response = client.post(
        f"/api/homes/{home_id}/join",
        json={"username": "testuser"}
    )
    user_id = user_response.json()["id"]
    
    # Add XP to reach level 2 (requires 100 XP)
    response = client.post(f"/api/users/{user_id}/xp?amount=100")
    assert response.status_code == 200
    assert response.json()["level"] == 2
    assert response.json()["xp"] == 100


def test_add_gold_to_user(client: TestClient):
    """Test adding gold to a user"""
    # Create home and user
    home_response = client.post("/api/homes", json={"name": "Test Home"})
    home_id = home_response.json()["id"]
    
    user_response = client.post(
        f"/api/homes/{home_id}/join",
        json={"username": "testuser"}
    )
    user_id = user_response.json()["id"]
    
    # Add gold
    response = client.post(f"/api/users/{user_id}/gold?amount=50")
    assert response.status_code == 200
    assert response.json()["gold_balance"] == 50


def test_delete_user(client: TestClient):
    """Test deleting a user"""
    # Create home and user
    home_response = client.post("/api/homes", json={"name": "Test Home"})
    home_id = home_response.json()["id"]
    
    user_response = client.post(
        f"/api/homes/{home_id}/join",
        json={"username": "testuser"}
    )
    user_id = user_response.json()["id"]
    
    # Delete user
    response = client.delete(f"/api/users/{user_id}")
    assert response.status_code == 200
    
    # Verify user is deleted
    response = client.get(f"/api/users/{user_id}")
    assert response.status_code == 404


def test_get_home_users(client: TestClient):
    """Test retrieving all users in a home"""
    # Create home
    home_response = client.post("/api/homes", json={"name": "Test Home"})
    home_id = home_response.json()["id"]
    
    # Create multiple users
    client.post(f"/api/homes/{home_id}/join", json={"username": "user1"})
    client.post(f"/api/homes/{home_id}/join", json={"username": "user2"})
    
    # Get users
    response = client.get(f"/api/homes/{home_id}/users")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_duplicate_username_in_home(client: TestClient):
    """Test that duplicate usernames are rejected within a home"""
    # Create home
    home_response = client.post("/api/homes", json={"name": "Test Home"})
    home_id = home_response.json()["id"]
    
    # Create first user
    client.post(f"/api/homes/{home_id}/join", json={"username": "testuser"})
    
    # Try to create duplicate
    response = client.post(f"/api/homes/{home_id}/join", json={"username": "testuser"})
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


def test_same_username_different_homes(client: TestClient):
    """Test that same username can exist in different homes"""
    # Create two homes
    home1_response = client.post("/api/homes", json={"name": "Home 1"})
    home1_id = home1_response.json()["id"]
    
    home2_response = client.post("/api/homes", json={"name": "Home 2"})
    home2_id = home2_response.json()["id"]
    
    # Create same username in each home
    response1 = client.post(f"/api/homes/{home1_id}/join", json={"username": "testuser"})
    response2 = client.post(f"/api/homes/{home2_id}/join", json={"username": "testuser"})
    
    assert response1.status_code == 200
    assert response2.status_code == 200
    assert response1.json()["id"] != response2.json()["id"]
