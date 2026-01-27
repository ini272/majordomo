from fastapi.testclient import TestClient


def test_get_user(client: TestClient, home_with_user):
    """Test retrieving a user"""
    home_id, user_id, invite_code = home_with_user

    # Retrieve user
    response = client.get(f"/api/users/{user_id}")
    assert response.status_code == 200
    assert response.json()["username"] == "testuser"


def test_get_user_not_found(client: TestClient):
    """Test retrieving a non-existent user"""
    response = client.get("/api/users/999")
    assert response.status_code == 404


def test_update_user(client: TestClient, home_with_user):
    """Test updating a user"""
    home_id, user_id, invite_code = home_with_user

    # Update user
    response = client.put(f"/api/users/{user_id}", json={"xp": 100})
    assert response.status_code == 200
    assert response.json()["xp"] == 100


def test_add_xp_to_user(client: TestClient, home_with_user):
    """Test adding XP to a user"""
    home_id, user_id, invite_code = home_with_user

    # Add XP
    response = client.post(f"/api/users/{user_id}/xp?amount=100")
    assert response.status_code == 200
    assert response.json()["xp"] == 100


def test_level_progression(client: TestClient, home_with_user):
    """Test that level increases with XP"""
    home_id, user_id, invite_code = home_with_user

    # Add XP to reach level 2 (requires 100 XP)
    response = client.post(f"/api/users/{user_id}/xp?amount=100")
    assert response.status_code == 200
    assert response.json()["level"] == 2
    assert response.json()["xp"] == 100


def test_add_gold_to_user(client: TestClient, home_with_user):
    """Test adding gold to a user"""
    home_id, user_id, invite_code = home_with_user

    # Add gold
    response = client.post(f"/api/users/{user_id}/gold?amount=50")
    assert response.status_code == 200
    assert response.json()["gold_balance"] == 50


def test_delete_user(client: TestClient, home_with_user):
    """Test deleting a user"""
    home_id, user_id, invite_code = home_with_user

    # Delete user
    response = client.delete(f"/api/users/{user_id}")
    assert response.status_code == 200

    # Verify user is deleted
    response = client.get(f"/api/users/{user_id}")
    assert response.status_code == 404


def test_get_home_users(client: TestClient):
    """Test retrieving all users in a home"""
    # Create home with first user
    signup = client.post(
        "/api/auth/signup",
        json={"email": "user1@example.com", "username": "user1", "password": "pass1", "home_name": "Test Home"},
    )
    home_id = signup.json()["home_id"]
    invite_code = signup.json()["invite_code"]

    # Create more users
    client.post(
        "/api/auth/join",
        json={"invite_code": invite_code, "email": "user2@example.com", "username": "user2", "password": "pass2"},
    )

    # Get users
    response = client.get(f"/api/homes/{home_id}/users")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_duplicate_username_in_home(client: TestClient):
    """Test that duplicate usernames are rejected within a home"""
    # Create home with first user
    signup = client.post(
        "/api/auth/signup",
        json={
            "email": "testuser@example.com",
            "username": "testuser",
            "password": "testpass",
            "home_name": "Test Home",
        },
    )
    invite_code = signup.json()["invite_code"]

    # Try to create duplicate
    response = client.post(
        "/api/auth/join",
        json={
            "invite_code": invite_code,
            "email": "different@example.com",
            "username": "testuser",
            "password": "different",
        },
    )
    assert response.status_code == 400
    error_detail = response.json()["detail"]
    # Support both old (string) and new (dict) error formats
    if isinstance(error_detail, dict):
        assert error_detail["code"] == "DUPLICATE_USERNAME"
        assert "already exists" in error_detail["message"].lower() or "already" in error_detail["message"].lower()
    else:
        assert "already exists" in error_detail.lower() or "already" in error_detail.lower()


def test_same_username_different_homes(client: TestClient):
    """Test that same username can exist in different homes"""
    # Create two homes
    home1 = client.post(
        "/api/auth/signup",
        json={"email": "user1@example.com", "username": "testuser", "password": "pass1", "home_name": "Home 1"},
    )

    home2 = client.post(
        "/api/auth/signup",
        json={"email": "user2@example.com", "username": "testuser", "password": "pass2", "home_name": "Home 2"},
    )

    assert home1.status_code == 200
    assert home2.status_code == 200
    assert home1.json()["user_id"] != home2.json()["user_id"]


def test_create_user_with_email(client: TestClient):
    """Test creating a user with an email address"""
    # Signup already creates user with email
    response = client.post(
        "/api/auth/signup",
        json={
            "email": "emailuser@example.com",
            "username": "emailuser",
            "password": "testpass",
            "home_name": "Test Home",
        },
    )

    assert response.status_code == 200
    user_id = response.json()["user_id"]

    # Verify email is stored
    user = client.get(f"/api/users/{user_id}").json()
    assert user["username"] == "emailuser"
    assert "email" in user


def test_email_is_globally_unique(client: TestClient):
    """Test that email addresses are globally unique across all homes"""
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
    """Test that email is required for signup flow"""
    # Email is now required for signup
    response = client.post(
        "/api/auth/signup",
        json={
            "email": "required@example.com",
            "username": "noemailuser",
            "password": "testpass",
            "home_name": "Test Home",
        },
    )

    assert response.status_code == 200
    user_id = response.json()["user_id"]
    user = client.get(f"/api/users/{user_id}").json()
    assert user["username"] == "noemailuser"


def test_get_user_returns_email(client: TestClient):
    """Test that getting user info includes email if present"""
    # Create user with email
    signup = client.post(
        "/api/auth/signup",
        json={"email": "test@example.com", "username": "testuser", "password": "testpass", "home_name": "Test Home"},
    )
    user_id = signup.json()["user_id"]

    # Get user
    response = client.get(f"/api/users/{user_id}")

    assert response.status_code == 200
    user = response.json()
    assert "email" in user


def test_get_current_user_with_email(client: TestClient):
    """Test that /users/me endpoint returns email"""
    # Create user with email
    client.post(
        "/api/auth/signup",
        json={
            "email": "current@example.com",
            "username": "currentuser",
            "password": "testpass",
            "home_name": "Test Home",
        },
    )

    # Get current user
    response = client.get("/api/users/me")

    assert response.status_code == 200
    user = response.json()
    assert user["username"] is not None
    assert "email" in user
