"""add quest snapshot fields

Revision ID: add_quest_snapshot_fields
Revises:
Create Date: 2026-01-29

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_quest_snapshot_fields'
down_revision = None  # Set this to the previous migration revision
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add snapshot fields to quest table
    op.add_column('quest', sa.Column('title', sa.String(length=200), nullable=False, server_default=''))
    op.add_column('quest', sa.Column('display_name', sa.String(length=200), nullable=True))
    op.add_column('quest', sa.Column('description', sa.String(length=1000), nullable=True))
    op.add_column('quest', sa.Column('tags', sa.String(length=500), nullable=True))
    op.add_column('quest', sa.Column('xp_reward', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('quest', sa.Column('gold_reward', sa.Integer(), nullable=False, server_default='0'))

    # Make quest_template_id nullable (for standalone quests)
    op.alter_column('quest', 'quest_template_id',
                    existing_type=sa.INTEGER(),
                    nullable=True)

    # Backfill snapshot fields from templates for existing quests
    op.execute("""
        UPDATE quest q
        SET
            title = qt.title,
            display_name = qt.display_name,
            description = qt.description,
            tags = qt.tags,
            xp_reward = COALESCE(q.xp_awarded, qt.xp_reward),
            gold_reward = COALESCE(q.gold_awarded, qt.gold_reward)
        FROM quest_template qt
        WHERE q.quest_template_id = qt.id
    """)

    # Drop old xp_awarded and gold_awarded columns
    op.drop_column('quest', 'xp_awarded')
    op.drop_column('quest', 'gold_awarded')

    # Remove server defaults after backfill
    op.alter_column('quest', 'title', server_default=None)
    op.alter_column('quest', 'xp_reward', server_default=None)
    op.alter_column('quest', 'gold_reward', server_default=None)


def downgrade() -> None:
    # Add back xp_awarded and gold_awarded
    op.add_column('quest', sa.Column('xp_awarded', sa.INTEGER(), nullable=True))
    op.add_column('quest', sa.Column('gold_awarded', sa.INTEGER(), nullable=True))

    # Copy data back from reward fields (only for completed quests)
    op.execute("""
        UPDATE quest
        SET
            xp_awarded = xp_reward,
            gold_awarded = gold_reward
        WHERE completed = true
    """)

    # Make quest_template_id non-nullable again
    op.alter_column('quest', 'quest_template_id',
                    existing_type=sa.INTEGER(),
                    nullable=False)

    # Drop snapshot fields
    op.drop_column('quest', 'gold_reward')
    op.drop_column('quest', 'xp_reward')
    op.drop_column('quest', 'tags')
    op.drop_column('quest', 'description')
    op.drop_column('quest', 'display_name')
    op.drop_column('quest', 'title')
