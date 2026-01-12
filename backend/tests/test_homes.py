from fastapi.testclient import TestClient


def test_create_home(client: TestClient):
    """Test creating a new home"""
    response = client.post("/api/homes", json={"name": "Family Home"})
    assert response.status_code == 200
    assert response.json()["name"] == "Family Home"
    assert "invite_code" in response.json()


def test_get_home(client: TestClient):
    """Test retrieving a home"""
    # Create home
    create_response = client.post("/api/homes", json={"name": "Test Home"})
    home_id = create_response.json()["id"]

    # Retrieve home
    response = client.get(f"/api/homes/{home_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Test Home"


def test_get_home_not_found(client: TestClient):
    """Test retrieving a non-existent/unauthorized home"""
    response = client.get("/api/homes/999")
    assert response.status_code == 403  # Not authorized to access home 999


def test_invite_code_is_unique(client: TestClient):
    """Test that invite codes are unique"""
    # Create two homes
    response1 = client.post("/api/homes", json={"name": "Home 1"})
    response2 = client.post("/api/homes", json={"name": "Home 2"})

    code1 = response1.json()["invite_code"]
    code2 = response2.json()["invite_code"]

    assert code1 != code2


def test_join_home(client: TestClient):
    """Test joining a home"""
    # Create home
    home_response = client.post("/api/homes", json={"name": "Test Home"})
    home_id = home_response.json()["id"]

    # Join home
    response = client.post(f"/api/homes/{home_id}/join", json={"username": "newuser", "password": "testpass"})
    assert response.status_code == 200
    assert response.json()["username"] == "newuser"
    assert response.json()["home_id"] == home_id


def test_join_home_not_found(client: TestClient):
    """Test joining a non-existent home"""
    response = client.post("/api/homes/999/join", json={"username": "newuser", "password": "testpass"})
    assert response.status_code == 404


def test_get_home_users(client: TestClient):
    """Test getting all users in a home"""
    # Create home
    home_response = client.post("/api/homes", json={"name": "Test Home"})
    home_id = home_response.json()["id"]

    # Add users
    client.post(f"/api/homes/{home_id}/join", json={"username": "user1", "password": "pass1"})
    client.post(f"/api/homes/{home_id}/join", json={"username": "user2", "password": "pass2"})
    client.post(f"/api/homes/{home_id}/join", json={"username": "user3", "password": "pass3"})

    # Get users
    response = client.get(f"/api/homes/{home_id}/users")
    assert response.status_code == 200
    users = response.json()
    assert len(users) == 3
    assert users[0]["username"] == "user1"
    assert users[1]["username"] == "user2"
    assert users[2]["username"] == "user3"


def test_get_home_users_empty(client: TestClient):
    """Test getting users from a home with no users"""
    # Create home
    home_response = client.post("/api/homes", json={"name": "Empty Home"})
    home_id = home_response.json()["id"]

    # Get users
    response = client.get(f"/api/homes/{home_id}/users")
    assert response.status_code == 200
    assert len(response.json()) == 0


def test_delete_home(client: TestClient):
    """Test deleting a home"""
    # Create home
    home_response = client.post("/api/homes", json={"name": "Test Home"})
    home_id = home_response.json()["id"]

    # Delete home
    response = client.delete(f"/api/homes/{home_id}")
    assert response.status_code == 200

    # Verify home is deleted
    response = client.get(f"/api/homes/{home_id}")
    assert response.status_code == 404


def test_duplicate_username_in_same_home_rejected(client: TestClient):
    """Test that duplicate usernames in same home are rejected"""
    # Create home
    home_response = client.post("/api/homes", json={"name": "Test Home"})
    home_id = home_response.json()["id"]

    # Create first user
    response1 = client.post(f"/api/homes/{home_id}/join", json={"username": "alice", "password": "pass1"})
    assert response1.status_code == 200

    # Try to create duplicate
    response2 = client.post(f"/api/homes/{home_id}/join", json={"username": "alice", "password": "pass2"})
    assert response2.status_code == 400
    error_detail = response2.json()["detail"]
    # Support both old (string) and new (dict) error formats
    if isinstance(error_detail, dict):
        assert error_detail["code"] == "DUPLICATE_USERNAME"
        assert "already exists" in error_detail["message"].lower()
    else:
        assert "already exists" in error_detail.lower()


def test_same_username_different_homes_allowed(client: TestClient):
    """Test that same username can exist in different homes"""
    # Create first home and user
    home1_response = client.post("/api/homes", json={"name": "Home 1"})
    home1_id = home1_response.json()["id"]

    response1 = client.post(f"/api/homes/{home1_id}/join", json={"username": "alice", "password": "pass1"})
    assert response1.status_code == 200

    # Create second home and user with same name
    home2_response = client.post("/api/homes", json={"name": "Home 2"})
    home2_id = home2_response.json()["id"]

    response2 = client.post(f"/api/homes/{home2_id}/join", json={"username": "alice", "password": "pass2"})
    assert response2.status_code == 200

    # Verify they are different users
    assert response1.json()["id"] != response2.json()["id"]
    assert response1.json()["home_id"] == home1_id
    assert response2.json()["home_id"] == home2_id
