import pytest
from fastapi.testclient import TestClient


def test_create_reward(client: TestClient):
    """Test creating a reward"""
    # Create home
    home_response = client.post("/api/homes", json={"name": "Test Home"})
    home_id = home_response.json()["id"]

    # Create reward
    reward_data = {"name": "Gaming hour", "description": "1 hour guilt-free gaming", "cost": 100}
    response = client.post(f"/api/rewards?home_id={home_id}", json=reward_data)
    assert response.status_code == 200
    assert response.json()["name"] == "Gaming hour"
    assert response.json()["description"] == "1 hour guilt-free gaming"
    assert response.json()["cost"] == 100


def test_get_reward(client: TestClient):
    """Test retrieving a reward"""
    # Create home
    home_response = client.post("/api/homes", json={"name": "Test Home"})
    home_id = home_response.json()["id"]

    # Create reward
    create_response = client.post(
        f"/api/rewards?home_id={home_id}", json={"name": "Reward", "description": "Test reward", "cost": 50}
    )
    reward_id = create_response.json()["id"]

    # Retrieve reward
    response = client.get(f"/api/rewards/{reward_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Reward"


def test_get_home_rewards(client: TestClient):
    """Test retrieving all rewards in a home"""
    # Create home
    home_response = client.post("/api/homes", json={"name": "Test Home"})
    home_id = home_response.json()["id"]

    # Create rewards
    client.post(f"/api/rewards?home_id={home_id}", json={"name": "Reward 1", "cost": 100})
    client.post(f"/api/rewards?home_id={home_id}", json={"name": "Reward 2", "cost": 50})

    # Get rewards
    response = client.get(f"/api/rewards?home_id={home_id}")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_get_home_rewards_multiple(client: TestClient):
    """Test that we can create and retrieve multiple rewards in a home"""
    # Create rewards
    client.post("/api/rewards", json={"name": "Reward 1", "cost": 100})
    client.post("/api/rewards", json={"name": "Reward 2", "cost": 50})
    client.post("/api/rewards", json={"name": "Reward 3", "cost": 75})

    # Verify we can get all rewards in our home
    response = client.get("/api/rewards")
    assert response.status_code == 200
    assert len(response.json()) == 3

    # Home isolation is enforced via JWT auth (different homes = different tokens)
    # Multi-home isolation testing requires separate auth contexts, done in integration tests


def test_claim_reward(client: TestClient, home_with_user):
    """Test claiming a reward"""
    home_id, user_id, invite_code = home_with_user

    # Give user enough gold
    client.put(f"/api/users/{user_id}", json={"gold_balance": 100})

    # Create reward
    reward_response = client.post(f"/api/rewards?home_id={home_id}", json={"name": "Gaming hour", "cost": 100})
    reward_id = reward_response.json()["id"]

    # Claim reward
    response = client.post(f"/api/rewards/{reward_id}/claim?user_id={user_id}")
    assert response.status_code == 200
    assert response.json()["user_id"] == user_id
    assert response.json()["reward_id"] == reward_id


def test_claim_reward_not_found(client: TestClient, home_with_user):
    """Test claiming a non-existent reward"""
    home_id, user_id, invite_code = home_with_user

    # Try to claim non-existent reward
    response = client.post(f"/api/rewards/999/claim?user_id={user_id}")
    assert response.status_code == 404


def test_get_user_reward_claims(client: TestClient, home_with_user):
    """Test retrieving a user's reward claims"""
    home_id, user_id, invite_code = home_with_user

    # Give user enough gold for both rewards (100 + 200 = 300)
    client.put(f"/api/users/{user_id}", json={"gold_balance": 300})

    # Create and claim multiple rewards
    for i in range(2):
        reward = client.post(
            f"/api/rewards?home_id={home_id}", json={"name": f"Reward {i}", "cost": 100 * (i + 1)}
        ).json()
        client.post(f"/api/rewards/{reward['id']}/claim?user_id={user_id}")

    # Retrieve claims
    response = client.get(f"/api/rewards/user/{user_id}/claims")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_delete_reward(client: TestClient):
    """Test deleting a reward"""
    # Create home
    home_response = client.post("/api/homes", json={"name": "Test Home"})
    home_id = home_response.json()["id"]

    # Create reward
    reward_response = client.post(f"/api/rewards?home_id={home_id}", json={"name": "Test reward", "cost": 50})
    reward_id = reward_response.json()["id"]

    # Delete reward
    response = client.delete(f"/api/rewards/{reward_id}")
    assert response.status_code == 200

    # Verify reward is deleted
    response = client.get(f"/api/rewards/{reward_id}")
    assert response.status_code == 404


def test_reward_with_zero_cost(client: TestClient):
    """Test creating a reward with zero cost"""
    # Create home
    home_response = client.post("/api/homes", json={"name": "Test Home"})
    home_id = home_response.json()["id"]

    # Create free reward
    response = client.post(f"/api/rewards?home_id={home_id}", json={"name": "Free reward", "cost": 0})
    assert response.status_code == 200
    assert response.json()["cost"] == 0


def test_claim_reward_insufficient_gold(client: TestClient, home_with_user):
    """Test claiming a reward with insufficient gold balance"""
    home_id, user_id, invite_code = home_with_user

    # Create expensive reward (200 gold)
    reward_response = client.post(
        f"/api/rewards?home_id={home_id}",
        json={"name": "Expensive Item", "cost": 200}
    )
    reward_id = reward_response.json()["id"]

    # Verify user has 0 gold by default
    user_response = client.get(f"/api/users/{user_id}")
    assert user_response.json()["gold_balance"] == 0

    # Try to claim reward (should fail)
    response = client.post(f"/api/rewards/{reward_id}/claim?user_id={user_id}")
    assert response.status_code == 400
    assert "INSUFFICIENT_GOLD" in response.json()["detail"]["code"]
    assert response.json()["detail"]["details"]["required"] == 200
    assert response.json()["detail"]["details"]["current"] == 0


def test_claim_reward_deducts_gold(client: TestClient, home_with_user):
    """Test that claiming a reward deducts gold from user balance"""
    home_id, user_id, invite_code = home_with_user

    # Give user 500 gold
    client.put(f"/api/users/{user_id}", json={"gold_balance": 500})

    # Create reward costing 150 gold
    reward_response = client.post(
        f"/api/rewards?home_id={home_id}",
        json={"name": "Heroic Elixir", "cost": 150}
    )
    reward_id = reward_response.json()["id"]

    # Claim reward
    response = client.post(f"/api/rewards/{reward_id}/claim?user_id={user_id}")
    assert response.status_code == 200

    # Verify gold was deducted
    user_response = client.get(f"/api/users/{user_id}")
    assert user_response.json()["gold_balance"] == 350  # 500 - 150


def test_claim_free_reward(client: TestClient, home_with_user):
    """Test claiming a free reward (cost = 0) works without gold"""
    home_id, user_id, invite_code = home_with_user

    # Create free reward
    reward_response = client.post(
        f"/api/rewards?home_id={home_id}",
        json={"name": "Free Gift", "cost": 0}
    )
    reward_id = reward_response.json()["id"]

    # Verify user has 0 gold
    user_response = client.get(f"/api/users/{user_id}")
    assert user_response.json()["gold_balance"] == 0

    # Claim free reward (should succeed)
    response = client.post(f"/api/rewards/{reward_id}/claim?user_id={user_id}")
    assert response.status_code == 200

    # Verify gold unchanged (still 0)
    user_response = client.get(f"/api/users/{user_id}")
    assert user_response.json()["gold_balance"] == 0
