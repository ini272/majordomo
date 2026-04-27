from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from app.crud import home as crud_home
from app.crud import quest as crud_quest
from app.crud import quest_template as crud_quest_template
from app.crud import user as crud_user
from app.database import get_db
from app.main import app
from app.models.home import HomeCreate
from app.models.quest import Quest, QuestCreate, QuestParticipant, QuestTemplateCreate
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
        nfc_enabled=True,
        nfc_code="clean-kitchen",
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
    response = client.post("/api/triggers/nfc/clean-kitchen", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()

    # Verify response
    assert data["success"] is True
    assert data["duplicate"] is False
    assert data["source"] == "created_from_template"
    assert data["cooldown_seconds"] == 30
    assert data["quest"]["completed"] is True
    assert data["quest"]["template"]["id"] == template.id
    assert data["rewards"]["xp"] == 25
    assert data["rewards"]["gold"] == 15
    assert data["user_stats"]["xp"] == initial_xp + 25
    assert data["user_stats"]["gold"] == initial_gold + 15


def test_trigger_nfc_code_not_found(client: TestClient, session: Session):
    """Test trigger with non-existent NFC code"""
    home, alice, _ = setup_test_data(session)

    # Login
    response = client.post("/api/auth/login", json={"home_id": home.id, "username": "alice", "password": "alice123"})
    token = response.json()["access_token"]

    response = client.post("/api/triggers/nfc/not-a-real-code", headers={"Authorization": f"Bearer {token}"})
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
    response = client.post("/api/triggers/nfc/clean-kitchen")
    assert response.status_code == 401


def test_trigger_quest_wrong_home(client: TestClient, session: Session):
    """Test trigger NFC code from a different home"""
    home1, alice, template = setup_test_data(session)

    # Create second home and user
    home2_data = HomeCreate(name="Test Home 2")
    home2 = crud_home.create_home(session, home2_data)
    bob_data = UserCreate(username="bob", password="bob123")
    crud_user.create_user(session, home2.id, bob_data)

    # Login as bob
    response = client.post("/api/auth/login", json={"home_id": home2.id, "username": "bob", "password": "bob123"})
    token = response.json()["access_token"]

    # Try to trigger NFC code from different home
    response = client.post("/api/triggers/nfc/clean-kitchen", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 404
    error_detail = response.json()["detail"]
    assert "not found" in error_detail.lower()


def test_trigger_disabled_template_not_found(client: TestClient, session: Session):
    """Test templates must be explicitly NFC-enabled before a code can trigger them."""
    home, alice, _ = setup_test_data(session)
    disabled_template = crud_quest_template.create_quest_template(
        session,
        home.id,
        alice.id,
        QuestTemplateCreate(
            title="Disabled NFC",
            xp_reward=10,
            gold_reward=5,
            nfc_enabled=False,
            nfc_code="disabled-nfc",
        ),
    )

    response = client.post("/api/auth/login", json={"home_id": home.id, "username": "alice", "password": "alice123"})
    token = response.json()["access_token"]

    response = client.post("/api/triggers/nfc/disabled-nfc", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 404
    assert response.json()["detail"] == "NFC trigger not found"

    assert disabled_template.nfc_enabled is False


def test_legacy_template_id_trigger_route_removed(client: TestClient, session: Session):
    """Test the old implementation-detail route is no longer exposed."""
    home, _, template = setup_test_data(session)

    response = client.post("/api/auth/login", json={"home_id": home.id, "username": "alice", "password": "alice123"})
    token = response.json()["access_token"]

    response = client.post(f"/api/triggers/quest/{template.id}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 404


def test_trigger_completes_existing_active_template_quest(client: TestClient, session: Session):
    """Test NFC completes the oldest active matching quest instead of creating a duplicate."""
    home, alice, template = setup_test_data(session)
    quest = crud_quest.create_quest(
        session,
        home.id,
        alice.id,
        [alice.id],
        QuestCreate(quest_template_id=template.id),
        template,
    )

    response = client.post("/api/auth/login", json={"home_id": home.id, "username": "alice", "password": "alice123"})
    token = response.json()["access_token"]

    response = client.post("/api/triggers/nfc/clean-kitchen", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["duplicate"] is False
    assert data["source"] == "active_quest"
    assert data["quest"]["id"] == quest.id
    assert data["quest"]["completed"] is True
    assert data["rewards"]["xp"] == 25
    assert data["rewards"]["gold"] == 15

    quests = session.exec(select(Quest).where(Quest.quest_template_id == template.id)).all()
    assert len(quests) == 1


def test_trigger_rejects_shared_active_template_quest(client: TestClient, session: Session):
    """Test NFC does not complete shared active quests."""
    home, alice, template = setup_test_data(session)
    bob = crud_user.create_user(session, home.id, UserCreate(username="bob", password="bob123"))
    quest = crud_quest.create_quest(
        session,
        home.id,
        alice.id,
        [alice.id, bob.id],
        QuestCreate(quest_template_id=template.id),
        template,
    )

    response = client.post("/api/auth/login", json={"home_id": home.id, "username": "alice", "password": "alice123"})
    token = response.json()["access_token"]

    response = client.post("/api/triggers/nfc/clean-kitchen", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 409
    assert response.json()["detail"] == "This is a shared quest. Complete it from the board."

    persisted_quest = session.get(Quest, quest.id)
    assert persisted_quest is not None
    assert persisted_quest.completed is False

    response = client.get("/api/users/me", headers={"Authorization": f"Bearer {token}"})
    user = response.json()
    assert user["xp"] == 0
    assert user["gold_balance"] == 0


def test_trigger_prefers_personal_active_template_quest_over_shared_one(
    client: TestClient, session: Session
):
    """Test NFC completes a personal quest even if an older shared match also exists."""
    home, alice, template = setup_test_data(session)
    bob = crud_user.create_user(session, home.id, UserCreate(username="bob", password="bob123"))
    shared_quest = crud_quest.create_quest(
        session,
        home.id,
        alice.id,
        [alice.id, bob.id],
        QuestCreate(quest_template_id=template.id),
        template,
    )
    personal_quest = crud_quest.create_quest(
        session,
        home.id,
        alice.id,
        [alice.id],
        QuestCreate(quest_template_id=template.id),
        template,
    )

    response = client.post("/api/auth/login", json={"home_id": home.id, "username": "alice", "password": "alice123"})
    token = response.json()["access_token"]

    response = client.post("/api/triggers/nfc/clean-kitchen", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()

    assert data["source"] == "active_quest"
    assert data["quest"]["id"] == personal_quest.id

    persisted_shared_quest = session.get(Quest, shared_quest.id)
    persisted_personal_quest = session.get(Quest, personal_quest.id)
    assert persisted_shared_quest is not None
    assert persisted_personal_quest is not None
    assert persisted_shared_quest.completed is False
    assert persisted_personal_quest.completed is True


def test_trigger_duplicate_scan_within_cooldown_does_not_award_again(client: TestClient, session: Session):
    """Test repeated scans within 30 seconds return a duplicate response without rewards."""
    home, alice, template = setup_test_data(session)

    # Login
    response = client.post("/api/auth/login", json={"home_id": home.id, "username": "alice", "password": "alice123"})
    token = response.json()["access_token"]

    # Trigger twice
    response1 = client.post("/api/triggers/nfc/clean-kitchen", headers={"Authorization": f"Bearer {token}"})
    response2 = client.post("/api/triggers/nfc/clean-kitchen", headers={"Authorization": f"Bearer {token}"})

    assert response1.status_code == 200
    assert response2.status_code == 200

    data1 = response1.json()
    data2 = response2.json()

    assert data1["duplicate"] is False
    assert data2["duplicate"] is True
    assert data2["source"] == "cooldown"
    assert data2["cooldown_remaining_seconds"] > 0
    assert data2["quest"]["id"] == data1["quest"]["id"]
    assert data2["quest"]["completed"] is True
    assert data2["rewards"]["xp"] == 0
    assert data2["rewards"]["gold"] == 0
    assert data2["rewards"]["previous_xp"] == 25
    assert data2["rewards"]["previous_gold"] == 15

    # User should only receive rewards once
    response = client.get("/api/users/me", headers={"Authorization": f"Bearer {token}"})
    user = response.json()
    assert user["xp"] == 25
    assert user["gold_balance"] == 15


def test_trigger_after_cooldown_creates_new_instance(client: TestClient, session: Session):
    """Test scans after the cooldown window keep the old create-and-complete behavior."""
    home, alice, template = setup_test_data(session)

    response = client.post("/api/auth/login", json={"home_id": home.id, "username": "alice", "password": "alice123"})
    token = response.json()["access_token"]

    response1 = client.post("/api/triggers/nfc/clean-kitchen", headers={"Authorization": f"Bearer {token}"})
    assert response1.status_code == 200
    first_quest_id = response1.json()["quest"]["id"]

    completed_at = datetime.now(timezone.utc) - timedelta(seconds=31)
    quest = session.get(Quest, first_quest_id)
    assert quest is not None
    quest.completed_at = completed_at
    session.add(quest)

    participant = session.exec(
        select(QuestParticipant).where(
            (QuestParticipant.quest_id == first_quest_id) & (QuestParticipant.user_id == alice.id)
        )
    ).first()
    assert participant is not None
    participant.completed_at = completed_at
    session.add(participant)
    session.commit()

    response2 = client.post("/api/triggers/nfc/clean-kitchen", headers={"Authorization": f"Bearer {token}"})
    assert response2.status_code == 200
    data2 = response2.json()

    assert data2["duplicate"] is False
    assert data2["source"] == "created_from_template"
    assert data2["quest"]["id"] != first_quest_id
    assert data2["rewards"]["xp"] == 25
    assert data2["rewards"]["gold"] == 15

    response = client.get("/api/users/me", headers={"Authorization": f"Bearer {token}"})
    user = response.json()
    assert user["xp"] == 50
    assert user["gold_balance"] == 30
