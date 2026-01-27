"""Add recurring quest fields to quest_template table

Revision ID: recurring_quest_001
Revises: consumable_tracking_001
Create Date: 2026-01-27

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "recurring_quest_001"
down_revision = "consumable_tracking_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add recurring quest fields to quest_template table
    op.add_column(
        "quest_template",
        sa.Column("schedule", sa.String(), nullable=True),
    )
    op.add_column(
        "quest_template",
        sa.Column("last_generated_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "quest_template",
        sa.Column("due_in_hours", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    # Remove recurring quest fields
    op.drop_column("quest_template", "due_in_hours")
    op.drop_column("quest_template", "last_generated_at")
    op.drop_column("quest_template", "schedule")
