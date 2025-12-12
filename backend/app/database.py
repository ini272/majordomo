import os
from sqlalchemy import create_engine
from sqlmodel import SQLModel, Session

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./grindstone.db")

# Create engine with SQLite-specific settings
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=os.getenv("SQL_ECHO", "false").lower() == "true"
)


def get_session():
    """Create a new SQLModel session"""
    with Session(engine) as session:
        yield session


def create_db_and_tables():
    """Create all database tables"""
    SQLModel.metadata.create_all(engine)


def get_db():
    """Dependency for getting DB session (alias for compatibility)"""
    yield from get_session()
