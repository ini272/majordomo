"""Add tags field to quest_template table

Revision ID: add_tags_001
Revises: add_quest_type_001
Create Date: 2025-12-17

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_tags_001'
down_revision = 'add_quest_type_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add tags column - nullable, max 500 chars, comma-separated tags
    op.add_column('quest_template', sa.Column('tags', sa.String(500), nullable=True))


def downgrade() -> None:
    # Remove tags column
    op.drop_column('quest_template', 'tags')
