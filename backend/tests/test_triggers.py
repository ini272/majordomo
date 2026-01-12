import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.crud import home as crud_home
from app.crud import quest_template as crud_quest_template
from app.crud import user as crud_user
from app.database import get_db
from app.main import app
from app.models.home import HomeCreate
from app.models.quest import QuestTemplateCreate
from app.models.user import UserCreate


@pytest.fixture(name="session")
def session_fixture():
    """Create an in-memory SQLite database for testing"""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session):
    """Create a test client with the session dependency overridden"""

    def get_session_override():
        return session

    app.dependency_overrides[get_db] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def setup_test_data(session: Session):
    """Create test home, users, and quest template"""
    # Create home
    home_data = HomeCreate(name="Test Home")
    home = crud_home.create_home(session, home_data)

    # Create users
    alice_data = UserCreate(username="alice", password="alice123")
    alice = crud_user.create_user(session, home.id, alice_data)

    # Create quest template
    template_data = QuestTemplateCreate(
        title="Clean Kitchen",
        display_name="Slay the Grease Dragon",
        description="Wash dishes and wipe counters",
        xp_reward=25,
        gold_reward=15,
        quest_type="standard",
    )
    template = crud_quest_template.create_quest_template(session, home.id, alice.id, template_data)

    return home, alice, template


def test_trigger_quest_success(client: TestClient, session: Session):
    """Test successful quest trigger via NFC"""
    home, alice, template = setup_test_data(session)

    # Login
    response = client.post("/api/auth/login", json={"home_id": home.id, "username": "alice", "password": "alice123"})
    assert response.status_code == 200
    token = response.json()["access_token"]

    # Get initial stats
    response = client.get("/api/users/me", headers={"Authorization": f"Bearer {token}"})
    initial_xp = response.json()["xp"]
    initial_gold = response.json()["gold_balance"]

    # Trigger quest
    response = client.post(f"/api/triggers/quest/{template.id}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()

    # Verify response
    assert data["success"] is True
    assert data["quest"]["completed"] is True
    assert data["quest"]["template"]["id"] == template.id
    assert data["rewards"]["xp"] == 25
    assert data["rewards"]["gold"] == 15
    assert data["user_stats"]["xp"] == initial_xp + 25
    assert data["user_stats"]["gold"] == initial_gold + 15


def test_trigger_quest_not_found(client: TestClient, session: Session):
    """Test trigger with non-existent template"""
    home, alice, _ = setup_test_data(session)

    # Login
    response = client.post("/api/auth/login", json={"home_id": home.id, "username": "alice", "password": "alice123"})
    token = response.json()["access_token"]

    # Try to trigger non-existent quest
    response = client.post("/api/triggers/quest/9999", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 404
    error_detail = response.json()["detail"]
    # Support both old (string) and new (dict) error formats
    if isinstance(error_detail, dict):
        assert "not found" in error_detail["message"].lower()
    else:
        assert "not found" in error_detail.lower()


def test_trigger_quest_unauthorized(client: TestClient, session: Session):
    """Test trigger without authentication"""
    home, alice, template = setup_test_data(session)

    # Try to trigger without token
    response = client.post(f"/api/triggers/quest/{template.id}")
    assert response.status_code == 401


def test_trigger_quest_wrong_home(client: TestClient, session: Session):
    """Test trigger quest from different home"""
    home1, alice, template = setup_test_data(session)

    # Create second home and user
    home2_data = HomeCreate(name="Test Home 2")
    home2 = crud_home.create_home(session, home2_data)
    bob_data = UserCreate(username="bob", password="bob123")
    bob = crud_user.create_user(session, home2.id, bob_data)

    # Login as bob
    response = client.post("/api/auth/login", json={"home_id": home2.id, "username": "bob", "password": "bob123"})
    token = response.json()["access_token"]

    # Try to trigger quest from different home
    response = client.post(f"/api/triggers/quest/{template.id}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403
    error_detail = response.json()["detail"]
    # Support both old (string) and new (dict) error formats
    if isinstance(error_detail, dict):
        assert "not authorized" in error_detail["message"].lower() or error_detail["code"] == "UNAUTHORIZED_ACCESS"
    else:
        assert "not authorized" in error_detail.lower()


def test_trigger_multiple_times(client: TestClient, session: Session):
    """Test triggering same quest multiple times creates separate instances"""
    home, alice, template = setup_test_data(session)

    # Login
    response = client.post("/api/auth/login", json={"home_id": home.id, "username": "alice", "password": "alice123"})
    token = response.json()["access_token"]

    # Trigger twice
    response1 = client.post(f"/api/triggers/quest/{template.id}", headers={"Authorization": f"Bearer {token}"})
    response2 = client.post(f"/api/triggers/quest/{template.id}", headers={"Authorization": f"Bearer {token}"})

    assert response1.status_code == 200
    assert response2.status_code == 200

    # Both should be completed
    quest1 = response1.json()["quest"]
    quest2 = response2.json()["quest"]

    assert quest1["id"] != quest2["id"]
    assert quest1["completed"] is True
    assert quest2["completed"] is True

    # User should have double rewards
    response = client.get("/api/users/me", headers={"Authorization": f"Bearer {token}"})
    user = response.json()
    assert user["xp"] == 50  # 25 * 2
    assert user["gold_balance"] == 30  # 15 * 2
