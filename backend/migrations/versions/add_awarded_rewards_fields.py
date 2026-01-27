"""Add xp_awarded and gold_awarded fields to quest table

Revision ID: add_awarded_rewards_001
Revises: consumable_tracking_001
Create Date: 2026-01-27

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "add_awarded_rewards_001"
down_revision = "consumable_tracking_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add actual earned rewards fields to quest table
    op.add_column("quest", sa.Column("xp_awarded", sa.Integer(), nullable=True))
    op.add_column("quest", sa.Column("gold_awarded", sa.Integer(), nullable=True))


def downgrade() -> None:
    # Remove awarded rewards fields
    op.drop_column("quest", "gold_awarded")
    op.drop_column("quest", "xp_awarded")
