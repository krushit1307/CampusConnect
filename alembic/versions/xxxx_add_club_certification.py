"""add club certification and renewal fields

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-08-23 13:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'

def upgrade() -> None:
    op.add_column('clubs', sa.Column('certification_year', sa.Integer(), nullable=False, server_default='2025'))
    op.add_column('clubs', sa.Column('is_locked_for_renewal', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('clubs', sa.Column('constitution_url', sa.String(255), nullable=True))

def downgrade() -> None:
    op.drop_column('clubs', 'constitution_url')
    op.drop_column('clubs', 'is_locked_for_renewal')
    op.drop_column('clubs', 'certification_year')
