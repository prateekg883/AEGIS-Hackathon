"""allow CSE bootstrap batches

Revision ID: b7a1d2c4e6f8
Revises: 9f3c4a3807c5
"""
from alembic import op
import sqlalchemy as sa

revision = 'b7a1d2c4e6f8'
down_revision = '9f3c4a3807c5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('ingestion_batches') as batch_op:
        batch_op.alter_column('cse_id', existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table('ingestion_batches') as batch_op:
        batch_op.alter_column('cse_id', existing_type=sa.Integer(), nullable=False)
