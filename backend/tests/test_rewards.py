import pytest
from fastapi.testclient import TestClient


def test_create_reward(client: TestClient):
    """Test creating a reward"""
    reward_data = {
        "name": "Gaming hour",
        "description": "1 hour guilt-free gaming"
    }
    response = client.post("/api/rewards", json=reward_data)
    assert response.status_code == 200
    assert response.json()["name"] == "Gaming hour"
    assert response.json()["description"] == "1 hour guilt-free gaming"


def test_get_reward(client: TestClient):
    """Test retrieving a reward"""
    # Create reward
    create_response = client.post(
        "/api/rewards",
        json={"name": "Reward", "description": "Test reward"}
    )
    reward_id = create_response.json()["id"]
    
    # Retrieve reward
    response = client.get(f"/api/rewards/{reward_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Reward"


def test_get_all_rewards(client: TestClient):
    """Test retrieving all rewards"""
    client.post("/api/rewards", json={"name": "Reward 1"})
    client.post("/api/rewards", json={"name": "Reward 2"})
    
    response = client.get("/api/rewards")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_claim_reward(client: TestClient):
    """Test claiming a reward"""
    # Create user
    user_response = client.post("/api/users", json={"username": "testuser"})
    user_id = user_response.json()["id"]
    
    # Create reward
    reward_response = client.post(
        "/api/rewards",
        json={"name": "Gaming hour"}
    )
    reward_id = reward_response.json()["id"]
    
    # Claim reward
    response = client.post(
        f"/api/rewards/{reward_id}/claim?user_id={user_id}"
    )
    assert response.status_code == 200
    assert response.json()["user_id"] == user_id
    assert response.json()["reward_id"] == reward_id


def test_claim_reward_not_found(client: TestClient):
    """Test claiming a non-existent reward"""
    # Create user
    user_response = client.post("/api/users", json={"username": "testuser"})
    user_id = user_response.json()["id"]
    
    # Try to claim non-existent reward
    response = client.post(f"/api/rewards/999/claim?user_id={user_id}")
    assert response.status_code == 404


def test_get_user_reward_claims(client: TestClient):
    """Test retrieving a user's reward claims"""
    # Create user
    user_response = client.post("/api/users", json={"username": "testuser"})
    user_id = user_response.json()["id"]
    
    # Create and claim multiple rewards
    for i in range(2):
        reward = client.post(
            "/api/rewards",
            json={"name": f"Reward {i}"}
        ).json()
        client.post(f"/api/rewards/{reward['id']}/claim?user_id={user_id}")
    
    # Retrieve claims
    response = client.get(f"/api/rewards/user/{user_id}/claims")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_delete_reward(client: TestClient):
    """Test deleting a reward"""
    # Create reward
    reward_response = client.post(
        "/api/rewards",
        json={"name": "Test reward"}
    )
    reward_id = reward_response.json()["id"]
    
    # Delete reward
    response = client.delete(f"/api/rewards/{reward_id}")
    assert response.status_code == 200
    
    # Verify reward is deleted
    response = client.get(f"/api/rewards/{reward_id}")
    assert response.status_code == 404
