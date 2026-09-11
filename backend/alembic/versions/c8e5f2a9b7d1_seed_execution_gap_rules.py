"""seed execution gap rules

Revision ID: c8e5f2a9b7d1
Revises: b7a1d2c4e6f8
"""
from alembic import op
import sqlalchemy as sa

revision = 'c8e5f2a9b7d1'
down_revision = 'b7a1d2c4e6f8'
branch_labels = None
depends_on = None

RULES = [
    ('EG-001', 'High-severity alert closed too quickly', 'EXECUTION_GAP', 'Flags high or critical alerts closed below a configurable duration threshold.', 'HIGH', 1.0, {'high_minutes': 10, 'critical_minutes': 15}),
    ('EG-002', 'Acknowledged alert without meaningful investigation', 'EXECUTION_GAP', 'Flags applicable acknowledged alerts without a meaningful downstream case investigation.', 'HIGH', 1.0, {'applicable_severities': ['HIGH', 'CRITICAL']}),
    ('EG-003', 'Critical alert closed without escalation', 'EXECUTION_GAP', 'Flags closed critical alerts for which no escalation evidence is available.', 'CRITICAL', 1.0, {}),
    ('EG-004', 'Repeated alerts on same asset', 'EXECUTION_GAP', 'Flags repeated alert activity on one asset within a configurable window.', 'MEDIUM', 1.0, {'minimum_alerts': 5, 'window_hours': 24}),
    ('EG-005', 'Repetitive investigation pattern', 'EXECUTION_GAP', 'Flags identical normalized investigation narratives repeated across investigations.', 'MEDIUM', 1.0, {'minimum_repetitions': 3}),
    ('EG-006', 'Possible KPI / metric gaming signal', 'EXECUTION_GAP', 'Combines multiple simple operational indicators into a cautious manual-review signal.', 'HIGH', 1.0, {'quick_closure_ratio': 0.5, 'acknowledgement_rate': 0.9, 'investigation_coverage': 0.5, 'minimum_alerts': 5}),
]


def upgrade() -> None:
    supervisory_rules = sa.table(
        'supervisory_rules',
        sa.column('rule_code', sa.String), sa.column('name', sa.String), sa.column('category', sa.String),
        sa.column('description', sa.Text), sa.column('severity', sa.String), sa.column('weight', sa.Float),
        sa.column('enabled', sa.Boolean), sa.column('parameters_json', sa.JSON),
    )
    op.bulk_insert(supervisory_rules, [
        {'rule_code': code, 'name': name, 'category': category, 'description': description, 'severity': severity, 'weight': weight, 'enabled': True, 'parameters_json': parameters}
        for code, name, category, description, severity, weight, parameters in RULES
    ])


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM supervisory_rules WHERE rule_code LIKE 'EG-%'"))
