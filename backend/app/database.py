import os
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
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


def ensure_runtime_schema_compatibility() -> None:
    inspector = inspect(engine)
    if "quest" not in inspector.get_table_names():
        return

    column_names = {column["name"] for column in inspector.get_columns("quest")}

    with engine.begin() as connection:
        if "created_by" not in column_names:
            connection.execute(text("ALTER TABLE quest ADD COLUMN created_by INTEGER"))
            connection.execute(text("UPDATE quest SET created_by = user_id WHERE created_by IS NULL"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_quest_created_by ON quest (created_by)"))

        # Keep this idempotent backfill through the production rollout. It can be
        # removed in a later cleanup once every deployed database has the table
        # and historical quests have participant rows.
        connection.execute(
            text(
                """
                INSERT INTO quest_participant (
                    quest_id,
                    user_id,
                    xp_awarded,
                    gold_awarded,
                    completed_at,
                    created_at
                )
                SELECT
                    q.id,
                    q.user_id,
                    CASE WHEN q.completed THEN q.xp_reward ELSE NULL END,
                    CASE WHEN q.completed THEN q.gold_reward ELSE NULL END,
                    CASE WHEN q.completed THEN q.completed_at ELSE NULL END,
                    COALESCE(q.completed_at, q.created_at, CURRENT_TIMESTAMP)
                FROM quest q
                WHERE q.user_id IS NOT NULL
                  AND NOT EXISTS (
                    SELECT 1
                    FROM quest_participant qp
                    WHERE qp.quest_id = q.id
                      AND qp.user_id = q.user_id
                  )
                """
            )
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
