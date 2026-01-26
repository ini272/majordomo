"""Add consumable tracking fields to user table

Revision ID: consumable_tracking_001
Revises: achievement_template_001
Create Date: 2026-01-26

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "consumable_tracking_001"
down_revision = "achievement_template_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add consumable tracking fields to user table
    op.add_column(
        "user",
        sa.Column(
            "active_xp_boost_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column("user", sa.Column("active_shield_expiry", sa.DateTime(), nullable=True))


def downgrade() -> None:
    # Remove consumable tracking fields
    op.drop_column("user", "active_shield_expiry")
    op.drop_column("user", "active_xp_boost_count")
