"""add_google_linked_email_to_users

Revision ID: 649b8de20184
Revises: e6a2b9c4d7f1
Create Date: 2026-09-09 00:51:10.207561
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa



revision: str = '649b8de20184'
down_revision: Union[str, None] = 'e6a2b9c4d7f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add google_linked_email column to users table for Google OAuth linking
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('google_linked_email', sa.String(length=255), nullable=True))
        batch_op.create_index('ix_users_google_linked_email', ['google_linked_email'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_index('ix_users_google_linked_email')
        batch_op.drop_column('google_linked_email')
