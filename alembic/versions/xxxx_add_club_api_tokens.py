"""add club api tokens table

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-08-23 13:30:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'

def upgrade() -> None:
    op.create_table(
        'club_api_tokens',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('club_id', sa.Integer(), sa.ForeignKey('clubs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('token_hash', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
    )

def downgrade() -> None:
    op.drop_table('club_api_tokens')
