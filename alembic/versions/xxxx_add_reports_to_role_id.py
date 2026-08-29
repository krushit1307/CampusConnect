"""add reports_to_role_id to club_roles

Revision ID: a1b2c3d4e5f6
Revises: previous_revision
Create Date: 2026-08-23 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = 'previous_revision'

def upgrade() -> None:
    op.add_column(
        'club_roles',
        sa.Column('reports_to_role_id', sa.Integer(), sa.ForeignKey('club_roles.id', ondelete='SET NULL'), nullable=True)
    )

def downgrade() -> None:
    op.drop_column('club_roles', 'reports_to_role_id')
