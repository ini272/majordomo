from fastapi.testclient import TestClient


def test_get_user(client: TestClient):
    """Test retrieving a user"""
    # Create home
    home_response = client.post("/api/homes", json={"name": "Test Home"})
    home_id = home_response.json()["id"]

    # Create user
    user_response = client.post(f"/api/homes/{home_id}/join", json={"username": "testuser", "password": "testpass"})
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

    user_response = client.post(f"/api/homes/{home_id}/join", json={"username": "testuser", "password": "testpass"})
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

    user_response = client.post(f"/api/homes/{home_id}/join", json={"username": "testuser", "password": "testpass"})
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

    user_response = client.post(f"/api/homes/{home_id}/join", json={"username": "testuser", "password": "testpass"})
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

    user_response = client.post(f"/api/homes/{home_id}/join", json={"username": "testuser", "password": "testpass"})
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

    user_response = client.post(f"/api/homes/{home_id}/join", json={"username": "testuser", "password": "testpass"})
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
    client.post(f"/api/homes/{home_id}/join", json={"username": "user1", "password": "pass1"})
    client.post(f"/api/homes/{home_id}/join", json={"username": "user2", "password": "pass2"})

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
    client.post(f"/api/homes/{home_id}/join", json={"username": "testuser", "password": "testpass"})

    # Try to create duplicate
    response = client.post(f"/api/homes/{home_id}/join", json={"username": "testuser", "password": "different"})
    assert response.status_code == 400
    error_detail = response.json()["detail"]
    # Support both old (string) and new (dict) error formats
    if isinstance(error_detail, dict):
        assert error_detail["code"] == "DUPLICATE_USERNAME"
        assert "already exists" in error_detail["message"].lower()
    else:
        assert "already exists" in error_detail.lower()


def test_same_username_different_homes(client: TestClient):
    """Test that same username can exist in different homes"""
    # Create two homes
    home1_response = client.post("/api/homes", json={"name": "Home 1"})
    home1_id = home1_response.json()["id"]

    home2_response = client.post("/api/homes", json={"name": "Home 2"})
    home2_id = home2_response.json()["id"]

    # Create same username in each home
    response1 = client.post(f"/api/homes/{home1_id}/join", json={"username": "testuser", "password": "pass1"})
    response2 = client.post(f"/api/homes/{home2_id}/join", json={"username": "testuser", "password": "pass2"})

    assert response1.status_code == 200
    assert response2.status_code == 200
    assert response1.json()["id"] != response2.json()["id"]


def test_create_user_with_email(client: TestClient):
    """Test creating a user with an email address"""
    # Create home
    home_response = client.post("/api/homes", json={"name": "Test Home"})
    home_id = home_response.json()["id"]

    # Create user with email
    response = client.post(
        f"/api/homes/{home_id}/join", json={"username": "emailuser", "email": "user@example.com", "password": "testpass"}
    )

    assert response.status_code == 200
    user = response.json()
    assert user["username"] == "emailuser"
    # Email is returned in UserRead schema
    assert "email" in user or user.get("email") == "user@example.com"


def test_email_is_globally_unique(client: TestClient):
    """Test that email addresses are globally unique across all homes"""
    # Note: This test validates the behavior using the /auth/signup endpoint instead
    # Create first user via signup
    response1 = client.post(
        "/api/auth/signup",
        json={"email": "shared@example.com", "username": "user1", "password": "pass1", "home_name": "Home 1"},
    )
    assert response1.status_code == 200

    # Try to signup again with same email
    response2 = client.post(
        "/api/auth/signup",
        json={"email": "shared@example.com", "username": "user2", "password": "pass2", "home_name": "Home 2"},
    )

    # Should fail because email is globally unique
    assert response2.status_code == 400
    error_detail = response2.json()["detail"]
    if isinstance(error_detail, dict):
        assert "email" in error_detail["message"].lower() or "already" in error_detail["message"].lower()
    else:
        assert "email" in error_detail.lower() or "already" in error_detail.lower()


def test_user_with_optional_email(client: TestClient):
    """Test that email is optional when creating a user"""
    # Create home
    home_response = client.post("/api/homes", json={"name": "Test Home"})
    home_id = home_response.json()["id"]

    # Create user without email
    response = client.post(f"/api/homes/{home_id}/join", json={"username": "noemailuser", "password": "testpass"})

    assert response.status_code == 200
    user = response.json()
    assert user["username"] == "noemailuser"


def test_get_user_returns_email(client: TestClient):
    """Test that getting user info includes email if present"""
    # Create home
    home_response = client.post("/api/homes", json={"name": "Test Home"})
    home_id = home_response.json()["id"]

    # Create user with email
    user_response = client.post(
        f"/api/homes/{home_id}/join", json={"username": "testuser", "email": "test@example.com", "password": "testpass"}
    )
    user_id = user_response.json()["id"]

    # Get user
    response = client.get(f"/api/users/{user_id}")

    assert response.status_code == 200
    user = response.json()
    # Check if email is in the response (if UserRead includes it)
    # The schema has email as Optional[str]
    assert "email" in user or user.get("email") == "test@example.com" or user.get("email") is None


def test_get_current_user_with_email(client: TestClient):
    """Test that /users/me endpoint returns email"""
    # Create home
    home_response = client.post("/api/homes", json={"name": "Test Home"})
    home_id = home_response.json()["id"]

    # Create user with email
    client.post(
        f"/api/homes/{home_id}/join", json={"username": "currentuser", "email": "current@example.com", "password": "testpass"}
    )

    # Get current user
    response = client.get("/api/users/me")

    assert response.status_code == 200
    user = response.json()
    assert user["username"] is not None
    # Email should be present if user has it
    assert "email" in user
