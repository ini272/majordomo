"""Add achievement template system with is_system flag

Revision ID: achievement_template_001
Revises: add_email_001, add_corruption_002
Create Date: 2026-01-14

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "achievement_template_001"
down_revision = ("add_email_001", "add_corruption_002")  # Merge both branches
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_system column (default False for existing achievements)
    op.add_column("achievement", sa.Column("is_system", sa.Boolean(), nullable=False, server_default="0"))

    # Make home_id nullable to support system achievements
    with op.batch_alter_table("achievement") as batch_op:
        batch_op.alter_column("home_id", existing_type=sa.Integer(), nullable=True)

    # Create index on is_system for efficient queries
    op.create_index(op.f("ix_achievement_is_system"), "achievement", ["is_system"])


def downgrade() -> None:
    # Remove is_system index
    op.drop_index(op.f("ix_achievement_is_system"), table_name="achievement")

    # Remove is_system column
    op.drop_column("achievement", "is_system")

    # Make home_id non-nullable again (note: this will fail if NULL values exist)
    with op.batch_alter_table("achievement") as batch_op:
        batch_op.alter_column("home_id", existing_type=sa.Integer(), nullable=False)
