"""Add corruption system fields to quest table

Revision ID: add_corruption_002
Revises: add_quest_type_001
Create Date: 2026-01-13

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "add_corruption_002"
down_revision = "add_tags_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add corruption system fields to quest table
    op.add_column("quest", sa.Column("quest_type", sa.String(), nullable=False, server_default="standard"))
    op.add_column("quest", sa.Column("due_date", sa.DateTime(), nullable=True))
    op.add_column("quest", sa.Column("corrupted_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    # Remove corruption system fields
    op.drop_column("quest", "corrupted_at")
    op.drop_column("quest", "due_date")
    op.drop_column("quest", "quest_type")
