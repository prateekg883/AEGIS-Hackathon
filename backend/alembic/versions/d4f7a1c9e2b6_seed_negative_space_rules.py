"""seed negative space rules

Revision ID: d4f7a1c9e2b6
Revises: c8e5f2a9b7d1
"""
from alembic import op
import sqlalchemy as sa

revision = 'd4f7a1c9e2b6'
down_revision = 'c8e5f2a9b7d1'
branch_labels = None
depends_on = None

RULES = [
    ('NS-001', 'Missing monitoring / telemetry evidence for critical assets', 'NEGATIVE_SPACE', 'Flags critical monitored assets with no submitted alert evidence in the assessment period.', 'HIGH', {'criticalities': ['CRITICAL']}),
    ('NS-002', 'Expected alert category absence', 'NEGATIVE_SPACE', 'Flags configured expected alert categories with zero submitted alerts in the assessment period.', 'MEDIUM', {'expected_categories': ['MALWARE', 'AUTHENTICATION', 'NETWORK', 'PRIVILEGED_ACCESS']}),
    ('NS-003', 'Missing investigation evidence', 'NEGATIVE_SPACE', 'Flags applicable high-severity alerts with no submitted case or investigation evidence.', 'HIGH', {'applicable_severities': ['HIGH', 'CRITICAL']}),
    ('NS-004', 'Missing escalation evidence', 'NEGATIVE_SPACE', 'Flags applicable alerts where expected escalation evidence is absent from submitted records.', 'HIGH', {'applicable_severities': ['CRITICAL']}),
    ('NS-005', 'Unexpectedly low operational activity', 'NEGATIVE_SPACE', 'Flags a CSE with less than the configured minimum submitted activity for the assessment period.', 'MEDIUM', {'minimum_alerts_per_period': 1, 'minimum_cases_per_period': 1, 'minimum_investigations_per_period': 1}),
]


def upgrade() -> None:
    table = sa.table(
        'supervisory_rules',
        sa.column('rule_code', sa.String), sa.column('name', sa.String), sa.column('category', sa.String),
        sa.column('description', sa.Text), sa.column('severity', sa.String), sa.column('weight', sa.Float),
        sa.column('enabled', sa.Boolean), sa.column('parameters_json', sa.JSON),
    )
    op.bulk_insert(table, [
        {'rule_code': code, 'name': name, 'category': category, 'description': description, 'severity': severity, 'weight': 1.0, 'enabled': True, 'parameters_json': parameters}
        for code, name, category, description, severity, parameters in RULES
    ])


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM supervisory_rules WHERE rule_code LIKE 'NS-%'"))
