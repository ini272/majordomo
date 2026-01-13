"""Add email field to user table

Revision ID: add_email_001
Revises: add_tags_001
Create Date: 2026-01-13

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "add_email_001"
down_revision = "add_tags_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add email column - nullable for backward compatibility, unique for global uniqueness
    op.add_column("user", sa.Column("email", sa.String(), nullable=True))
    # Create unique index on email (ignoring NULL values)
    op.create_index(op.f("ix_user_email"), "user", ["email"], unique=True)


def downgrade() -> None:
    # Remove email index and column
    op.drop_index(op.f("ix_user_email"), table_name="user")
    op.drop_column("user", "email")
