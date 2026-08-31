"""add mentorship outcomes and career maker badge

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-23 12:30:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'

def upgrade() -> None:
    op.create_table(
        'mentorship_outcomes',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('mentorship_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('student_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('alumni_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('survey_sent_at', sa.DateTime(), nullable=False),
        sa.Column('responded_at', sa.DateTime(), nullable=True),
        sa.Column('outcome_type', sa.String(50), nullable=True), # 'job_offer', 'internship', 'interview', 'none'
        sa.Column('company_name', sa.String(100), nullable=True),
        sa.Column('is_verified', sa.Boolean(), default=False),
    )
    
    op.add_column('users', sa.Column('has_career_maker_badge', sa.Boolean(), default=False))

def downgrade() -> None:
    op.drop_column('users', 'has_career_maker_badge')
    op.drop_table('mentorship_outcomes')
