import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel

from app.auth import get_current_user
from app.database import get_db
from app.main import app

# Import models to register them

# Create in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@pytest.fixture(scope="function")
def db():
    """Create a fresh database for each test."""
    SQLModel.metadata.create_all(bind=engine)
    session = Session(engine)
    try:
        yield session
    finally:
        session.close()
        SQLModel.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    """Create a test client with database override."""

    def override_get_db():
        try:
            yield db
        finally:
            pass

    async def override_get_current_user():
        """Override auth to allow tests without tokens"""
        return {"user_id": 1, "home_id": 1}

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def home_with_user(client: TestClient):
    """
    Create a home with a user for test setup.

    Returns:
        tuple: (home_id, user_id, invite_code)
    """
    signup = client.post(
        "/api/auth/signup",
        json={
            "email": "testuser@example.com",
            "username": "testuser",
            "password": "testpass",
            "home_name": "Test Home",
        },
    )
    home_id = signup.json()["home_id"]
    user_id = signup.json()["user_id"]
    invite_code = signup.json()["invite_code"]

    return home_id, user_id, invite_code


@pytest.fixture
def db_home_with_users(db: Session):
    """
    Create a home with users directly in the database for unit tests.

    This fixture is useful for testing service layer functions that
    work directly with the database, bypassing the API.

    Returns:
        tuple: (home, user1, user2) - home and two users
    """
    from app.models.home import Home
    from app.models.user import User

    # Create home
    home = Home(name="Test Home", invite_code="TEST123")
    db.add(home)
    db.commit()
    db.refresh(home)

    # Create first user
    user1 = User(
        username="user1",
        email="user1@test.com",
        password_hash="$2b$12$test_hash_1",
        home_id=home.id,
    )
    db.add(user1)

    # Create second user
    user2 = User(
        username="user2",
        email="user2@test.com",
        password_hash="$2b$12$test_hash_2",
        home_id=home.id,
    )
    db.add(user2)

    db.commit()
    db.refresh(user1)
    db.refresh(user2)

    return home, user1, user2
