"""Add quest_type field to quest_template table

Revision ID: add_quest_type_001
Revises: c8a4089cff17
Create Date: 2025-12-17

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_quest_type_001'
down_revision = 'c8a4089cff17'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add quest_type column with default value 'standard'
    op.add_column('quest_template', sa.Column('quest_type', sa.String(), nullable=False, server_default='standard'))


def downgrade() -> None:
    # Remove quest_type column
    op.drop_column('quest_template', 'quest_type')
