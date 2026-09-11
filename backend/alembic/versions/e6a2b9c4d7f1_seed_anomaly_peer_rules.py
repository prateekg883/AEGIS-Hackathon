"""seed anomaly and peer rules

Revision ID: e6a2b9c4d7f1
Revises: d4f7a1c9e2b6
"""
from alembic import op
import sqlalchemy as sa

revision = 'e6a2b9c4d7f1'
down_revision = 'd4f7a1c9e2b6'
branch_labels = None
depends_on = None

RULES = [
 ('AN-001', 'Operational volume deviates from entity baseline', 'ANOMALY', 'Flags alert or case volume that materially differs from the same CSE historical baseline.', 'MEDIUM', {'z_score_threshold': 2.0, 'minimum_history_periods': 2}),
 ('AN-002', 'Alert-to-case ratio deviates from entity baseline', 'ANOMALY', 'Flags an alert-to-case conversion ratio that materially differs from historical behavior.', 'MEDIUM', {'z_score_threshold': 2.0, 'minimum_history_periods': 2}),
 ('AN-003', 'Closure behavior deviates from entity baseline', 'ANOMALY', 'Flags median closed-alert duration that materially differs from historical behavior.', 'MEDIUM', {'z_score_threshold': 2.0, 'minimum_history_periods': 2}),
 ('PB-001', 'Material peer deviation', 'PEER_DEVIATION', 'Flags a metric materially different from comparable CSEs in the same assessment period.', 'MEDIUM', {'deviation_ratio': 0.5, 'minimum_peers': 2}),
]

def upgrade():
    table = sa.table('supervisory_rules', sa.column('rule_code', sa.String), sa.column('name', sa.String), sa.column('category', sa.String), sa.column('description', sa.Text), sa.column('severity', sa.String), sa.column('weight', sa.Float), sa.column('enabled', sa.Boolean), sa.column('parameters_json', sa.JSON))
    op.bulk_insert(table, [{'rule_code': c, 'name': n, 'category': cat, 'description': d, 'severity': s, 'weight': 1.0, 'enabled': True, 'parameters_json': p} for c, n, cat, d, s, p in RULES])

def downgrade():
    op.execute(sa.text("DELETE FROM supervisory_rules WHERE rule_code LIKE 'AN-%' OR rule_code LIKE 'PB-%'"))
