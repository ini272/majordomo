import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlmodel import Session, SQLModel

DEFAULT_DATABASE_PATH = Path(__file__).resolve().parents[2] / "data" / "majordomo.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DATABASE_PATH}")


def _ensure_sqlite_parent_dir(database_url: str) -> None:
    url = make_url(database_url)
    if url.get_backend_name() != "sqlite" or not url.database or url.database == ":memory:":
        return

    Path(url.database).expanduser().parent.mkdir(parents=True, exist_ok=True)


_ensure_sqlite_parent_dir(DATABASE_URL)

# Create engine with SQLite-specific settings
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}, echo=os.getenv("SQL_ECHO", "false").lower() == "true"
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
