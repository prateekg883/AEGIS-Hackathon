from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

def timestamp_column():
    return mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


def nullable_timestamp_column():
    return mapped_column(DateTime(timezone=True), nullable=True)


class CSEEntity(Base):
    __tablename__ = 'cse_entities'

    id: Mapped[int] = mapped_column(primary_key=True)
    cse_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    sector: Mapped[str] = mapped_column(String(100), nullable=False)
    criticality: Mapped[str] = mapped_column(String(50), nullable=False)
    assessment_status: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = timestamp_column()
    updated_at: Mapped[datetime] = timestamp_column()

    assets: Mapped[list['Asset']] = relationship(back_populates='cse', cascade='all, delete-orphan')
    ingestion_batches: Mapped[list['IngestionBatch']] = relationship(back_populates='cse')
    alerts: Mapped[list['Alert']] = relationship(back_populates='cse')
    cases: Mapped[list['Case']] = relationship(back_populates='cse')
    investigations: Mapped[list['Investigation']] = relationship(back_populates='cse')
    escalations: Mapped[list['Escalation']] = relationship(back_populates='cse')
    analytics_runs: Mapped[list['AnalyticsRun']] = relationship(back_populates='cse')
    findings: Mapped[list['Finding']] = relationship(back_populates='cse')
    attention_scores: Mapped[list['AttentionScore']] = relationship(back_populates='cse')
    peer_metrics: Mapped[list['PeerMetric']] = relationship(back_populates='cse')
    prioritised_samples: Mapped[list['PrioritisedSample']] = relationship(back_populates='cse')
    assessment_reports: Mapped[list['AssessmentReport']] = relationship(back_populates='cse')


class Asset(Base):
    __tablename__ = 'assets'
    __table_args__ = (Index('ix_assets_cse_id', 'cse_id'),)

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    cse_id: Mapped[int] = mapped_column(ForeignKey('cse_entities.id'), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(100), nullable=False)
    criticality: Mapped[str] = mapped_column(String(50), nullable=False)
    expected_monitoring: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = timestamp_column()
    updated_at: Mapped[datetime] = timestamp_column()

    cse: Mapped['CSEEntity'] = relationship(back_populates='assets')


class IngestionBatch(Base):
    __tablename__ = 'ingestion_batches'
    __table_args__ = (Index('ix_ingestion_batches_cse_id', 'cse_id'),)

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    cse_id: Mapped[int | None] = mapped_column(ForeignKey('cse_entities.id'), nullable=True)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    source_name: Mapped[str] = mapped_column(String(200), nullable=False)
    assessment_period: Mapped[str] = mapped_column(String(50), nullable=False)
    record_count: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    ingested_at: Mapped[datetime] = nullable_timestamp_column()
    created_at: Mapped[datetime] = timestamp_column()

    cse: Mapped['CSEEntity'] = relationship(back_populates='ingestion_batches')
    alerts: Mapped[list['Alert']] = relationship(back_populates='ingestion_batch')
    cases: Mapped[list['Case']] = relationship(back_populates='ingestion_batch')
    analytics_runs: Mapped[list['AnalyticsRun']] = relationship(back_populates='ingestion_batch')


class Alert(Base):
    __tablename__ = 'alerts'
    __table_args__ = (Index('ix_alerts_cse_id', 'cse_id'),)

    id: Mapped[int] = mapped_column(primary_key=True)
    alert_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    cse_id: Mapped[int] = mapped_column(ForeignKey('cse_entities.id'), nullable=False)
    asset_id: Mapped[int | None] = mapped_column(ForeignKey('assets.id'), nullable=True)
    ingestion_batch_id: Mapped[int | None] = mapped_column(ForeignKey('ingestion_batches.id'), nullable=True)
    severity: Mapped[str] = mapped_column(String(30), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    created_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    acknowledged_time: Mapped[datetime | None] = nullable_timestamp_column()
    closed_time: Mapped[datetime | None] = nullable_timestamp_column()
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    disposition: Mapped[str | None] = mapped_column(String(250), nullable=True)
    analyst: Mapped[str | None] = mapped_column(String(150), nullable=True)
    created_at: Mapped[datetime] = timestamp_column()
    updated_at: Mapped[datetime] = timestamp_column()

    cse: Mapped['CSEEntity'] = relationship(back_populates='alerts')
    asset: Mapped['Asset | None'] = relationship()
    ingestion_batch: Mapped['IngestionBatch | None'] = relationship(back_populates='alerts')
    case_links: Mapped[list['CaseAlertLink']] = relationship(back_populates='alert')
    escalations: Mapped[list['Escalation']] = relationship(back_populates='alert')


class Case(Base):
    __tablename__ = 'cases'
    __table_args__ = (Index('ix_cases_cse_id', 'cse_id'),)

    id: Mapped[int] = mapped_column(primary_key=True)
    case_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    cse_id: Mapped[int] = mapped_column(ForeignKey('cse_entities.id'), nullable=False)
    ingestion_batch_id: Mapped[int | None] = mapped_column(ForeignKey('ingestion_batches.id'), nullable=True)
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    opened_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    closed_time: Mapped[datetime | None] = nullable_timestamp_column()
    assigned_analyst: Mapped[str | None] = mapped_column(String(150), nullable=True)
    created_at: Mapped[datetime] = timestamp_column()
    updated_at: Mapped[datetime] = timestamp_column()

    cse: Mapped['CSEEntity'] = relationship(back_populates='cases')
    ingestion_batch: Mapped['IngestionBatch | None'] = relationship(back_populates='cases')
    alert_links: Mapped[list['CaseAlertLink']] = relationship(back_populates='case', cascade='all, delete-orphan')
    investigations: Mapped[list['Investigation']] = relationship(back_populates='case')
    escalations: Mapped[list['Escalation']] = relationship(back_populates='case')


class CaseAlertLink(Base):
    __tablename__ = 'case_alert_links'
    __table_args__ = (UniqueConstraint('case_id', 'alert_id', name='uq_case_alert_link'),)

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey('cases.id'), nullable=False, index=True)
    alert_id: Mapped[int] = mapped_column(ForeignKey('alerts.id'), nullable=False, index=True)
    linked_at: Mapped[datetime] = timestamp_column()

    case: Mapped['Case'] = relationship(back_populates='alert_links')
    alert: Mapped['Alert'] = relationship(back_populates='case_links')


class Investigation(Base):
    __tablename__ = 'investigations'
    __table_args__ = (Index('ix_investigations_cse_id', 'cse_id'),)

    id: Mapped[int] = mapped_column(primary_key=True)
    investigation_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    case_id: Mapped[int] = mapped_column(ForeignKey('cases.id'), nullable=False, index=True)
    cse_id: Mapped[int] = mapped_column(ForeignKey('cse_entities.id'), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    analyst: Mapped[str | None] = mapped_column(String(150), nullable=True)
    started_time: Mapped[datetime | None] = nullable_timestamp_column()
    completed_time: Mapped[datetime | None] = nullable_timestamp_column()
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = timestamp_column()
    updated_at: Mapped[datetime] = timestamp_column()

    case: Mapped['Case'] = relationship(back_populates='investigations')
    cse: Mapped['CSEEntity'] = relationship(back_populates='investigations')


class Escalation(Base):
    __tablename__ = 'escalations'
    __table_args__ = (Index('ix_escalations_cse_id', 'cse_id'),)

    id: Mapped[int] = mapped_column(primary_key=True)
    escalation_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    case_id: Mapped[int] = mapped_column(ForeignKey('cases.id'), nullable=False, index=True)
    alert_id: Mapped[int | None] = mapped_column(ForeignKey('alerts.id'), nullable=True, index=True)
    cse_id: Mapped[int] = mapped_column(ForeignKey('cse_entities.id'), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    escalation_level: Mapped[str | None] = mapped_column(String(30), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    escalated_time: Mapped[datetime | None] = nullable_timestamp_column()
    resolved_time: Mapped[datetime | None] = nullable_timestamp_column()
    created_at: Mapped[datetime] = timestamp_column()
    updated_at: Mapped[datetime] = timestamp_column()

    case: Mapped['Case'] = relationship(back_populates='escalations')
    alert: Mapped['Alert | None'] = relationship(back_populates='escalations')
    cse: Mapped['CSEEntity'] = relationship(back_populates='escalations')


class SupervisoryRule(Base):
    __tablename__ = 'supervisory_rules'

    id: Mapped[int] = mapped_column(primary_key=True)
    rule_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(30), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    parameters_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = timestamp_column()
    updated_at: Mapped[datetime] = timestamp_column()

    findings: Mapped[list['Finding']] = relationship(back_populates='rule')


class AnalyticsRun(Base):
    __tablename__ = 'analytics_runs'
    __table_args__ = (Index('ix_analytics_runs_cse_id', 'cse_id'),)

    id: Mapped[int] = mapped_column(primary_key=True)
    run_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    cse_id: Mapped[int | None] = mapped_column(ForeignKey('cse_entities.id'), nullable=True)
    ingestion_batch_id: Mapped[int | None] = mapped_column(ForeignKey('ingestion_batches.id'), nullable=True)
    run_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = nullable_timestamp_column()
    created_at: Mapped[datetime] = timestamp_column()

    cse: Mapped['CSEEntity | None'] = relationship(back_populates='analytics_runs')
    ingestion_batch: Mapped['IngestionBatch | None'] = relationship(back_populates='analytics_runs')
    findings: Mapped[list['Finding']] = relationship(back_populates='analytics_run')
    attention_scores: Mapped[list['AttentionScore']] = relationship(back_populates='analytics_run')
    peer_metrics: Mapped[list['PeerMetric']] = relationship(back_populates='analytics_run')
    prioritised_samples: Mapped[list['PrioritisedSample']] = relationship(back_populates='analytics_run')
    assessment_reports: Mapped[list['AssessmentReport']] = relationship(back_populates='analytics_run')


class Finding(Base):
    __tablename__ = 'findings'
    __table_args__ = (Index('ix_findings_cse_id', 'cse_id'),)

    id: Mapped[int] = mapped_column(primary_key=True)
    finding_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    cse_id: Mapped[int] = mapped_column(ForeignKey('cse_entities.id'), nullable=False)
    analytics_run_id: Mapped[int | None] = mapped_column(ForeignKey('analytics_runs.id'), nullable=True)
    rule_id: Mapped[int | None] = mapped_column(ForeignKey('supervisory_rules.id'), nullable=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    score_contribution: Mapped[float | None] = mapped_column(Float, nullable=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    resolved_at: Mapped[datetime | None] = nullable_timestamp_column()
    created_at: Mapped[datetime] = timestamp_column()
    updated_at: Mapped[datetime] = timestamp_column()

    cse: Mapped['CSEEntity'] = relationship(back_populates='findings')
    analytics_run: Mapped['AnalyticsRun | None'] = relationship(back_populates='findings')
    rule: Mapped['SupervisoryRule | None'] = relationship(back_populates='findings')
    evidence: Mapped[list['FindingEvidence']] = relationship(back_populates='finding', cascade='all, delete-orphan')
    escalation_items: Mapped[list['CriticalEscalationQueue']] = relationship(back_populates='finding', cascade='all, delete-orphan')


class FindingEvidence(Base):
    __tablename__ = 'finding_evidence'
    __table_args__ = (Index('ix_finding_evidence_finding_id', 'finding_id'),)

    id: Mapped[int] = mapped_column(primary_key=True)
    evidence_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    finding_id: Mapped[int] = mapped_column(ForeignKey('findings.id'), nullable=False)
    record_type: Mapped[str] = mapped_column(String(30), nullable=False)
    record_id: Mapped[str] = mapped_column(String(64), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_reference: Mapped[str | None] = mapped_column(String(250), nullable=True)
    created_at: Mapped[datetime] = timestamp_column()

    finding: Mapped['Finding'] = relationship(back_populates='evidence')


class AttentionScore(Base):
    __tablename__ = 'attention_scores'
    __table_args__ = (Index('ix_attention_scores_cse_id', 'cse_id'),)

    id: Mapped[int] = mapped_column(primary_key=True)
    cse_id: Mapped[int] = mapped_column(ForeignKey('cse_entities.id'), nullable=False)
    analytics_run_id: Mapped[int | None] = mapped_column(ForeignKey('analytics_runs.id'), nullable=True)
    total_score: Mapped[float] = mapped_column(Float, nullable=False)
    attention_level: Mapped[str] = mapped_column(String(100), nullable=False)
    execution_gap_score: Mapped[float] = mapped_column(Float, nullable=False)
    negative_space_score: Mapped[float] = mapped_column(Float, nullable=False)
    anomaly_score: Mapped[float] = mapped_column(Float, nullable=False)
    peer_deviation_score: Mapped[float] = mapped_column(Float, nullable=False)
    calculated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = timestamp_column()

    cse: Mapped['CSEEntity'] = relationship(back_populates='attention_scores')
    analytics_run: Mapped['AnalyticsRun | None'] = relationship(back_populates='attention_scores')


class CriticalEscalationQueue(Base):
    __tablename__ = 'critical_escalation_queue'
    __table_args__ = (
        Index('ix_escalation_status', 'delivery_status'),
        Index('ix_escalation_idempotency', 'idempotency_key', unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    alert_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    finding_id: Mapped[int | None] = mapped_column(ForeignKey('findings.id'), nullable=True)
    cse_code: Mapped[str] = mapped_column(String(64), nullable=False)
    attention_score: Mapped[float] = mapped_column(Float, nullable=False)
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    destination_type: Mapped[str] = mapped_column(String(64), nullable=False)
    destination_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    minimised_payload_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    delivery_status: Mapped[str] = mapped_column(String(32), default='AWAITING_AUTH_ENDPOINT', index=True, nullable=False)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    signature: Mapped[str | None] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = timestamp_column()
    delivered_at: Mapped[datetime | None] = nullable_timestamp_column()

    finding: Mapped['Finding | None'] = relationship(back_populates='escalation_items')


class PeerMetric(Base):
    __tablename__ = 'peer_metrics'
    __table_args__ = (Index('ix_peer_metrics_cse_id', 'cse_id'),)

    id: Mapped[int] = mapped_column(primary_key=True)
    cse_id: Mapped[int] = mapped_column(ForeignKey('cse_entities.id'), nullable=False)
    analytics_run_id: Mapped[int | None] = mapped_column(ForeignKey('analytics_runs.id'), nullable=True)
    metric_name: Mapped[str] = mapped_column(String(150), nullable=False)
    entity_value: Mapped[float] = mapped_column(Float, nullable=False)
    peer_average: Mapped[float | None] = mapped_column(Float, nullable=True)
    peer_median: Mapped[float | None] = mapped_column(Float, nullable=True)
    percentile: Mapped[float | None] = mapped_column(Float, nullable=True)
    deviation: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str | None] = mapped_column(String(30), nullable=True)
    assessment_period: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = timestamp_column()

    cse: Mapped['CSEEntity'] = relationship(back_populates='peer_metrics')
    analytics_run: Mapped['AnalyticsRun | None'] = relationship(back_populates='peer_metrics')


class PrioritisedSample(Base):
    __tablename__ = 'prioritised_samples'
    __table_args__ = (Index('ix_prioritised_samples_cse_id', 'cse_id'),)

    id: Mapped[int] = mapped_column(primary_key=True)
    cse_id: Mapped[int] = mapped_column(ForeignKey('cse_entities.id'), nullable=False)
    analytics_run_id: Mapped[int | None] = mapped_column(ForeignKey('analytics_runs.id'), nullable=True)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    record_type: Mapped[str] = mapped_column(String(30), nullable=False)
    record_id: Mapped[str] = mapped_column(String(64), nullable=False)
    priority_score: Mapped[float] = mapped_column(Float, nullable=False)
    severity: Mapped[str] = mapped_column(String(30), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    review_status: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = timestamp_column()
    updated_at: Mapped[datetime] = timestamp_column()

    cse: Mapped['CSEEntity'] = relationship(back_populates='prioritised_samples')
    analytics_run: Mapped['AnalyticsRun | None'] = relationship(back_populates='prioritised_samples')


class AssessmentReport(Base):
    __tablename__ = 'assessment_reports'
    __table_args__ = (Index('ix_assessment_reports_cse_id', 'cse_id'),)

    id: Mapped[int] = mapped_column(primary_key=True)
    report_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    cse_id: Mapped[int] = mapped_column(ForeignKey('cse_entities.id'), nullable=False)
    analytics_run_id: Mapped[int | None] = mapped_column(ForeignKey('analytics_runs.id'), nullable=True)
    assessment_period: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_at: Mapped[datetime | None] = nullable_timestamp_column()
    created_at: Mapped[datetime] = timestamp_column()
    updated_at: Mapped[datetime] = timestamp_column()

    cse: Mapped['CSEEntity'] = relationship(back_populates='assessment_reports')
    analytics_run: Mapped['AnalyticsRun | None'] = relationship(back_populates='assessment_reports')


class AuditLog(Base):
    __tablename__ = 'audit_logs'

    id: Mapped[int] = mapped_column(primary_key=True)
    user_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    details_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    prev_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    record_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = timestamp_column()

class User(Base):
    __tablename__ = 'users'

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str | None] = mapped_column(String(100), unique=True, index=True, nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    registered_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    organization: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_color: Mapped[str] = mapped_column(String(20), nullable=True)
    # Google OAuth: stores the Gmail address authorized for Google login for this account
    google_linked_email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    created_at: Mapped[datetime] = timestamp_column()
    updated_at: Mapped[datetime] = timestamp_column()



class SecurityEvent(Base):
    __tablename__ = 'security_events'

    id: Mapped[int] = mapped_column(primary_key=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    component: Mapped[str] = mapped_column(String(100), nullable=False)
    source_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    destination: Mapped[str | None] = mapped_column(String(255), nullable=True)
    port_protocol: Mapped[str | None] = mapped_column(String(50), nullable=True)
    severity: Mapped[str] = mapped_column(String(30), nullable=False, default="LOW")
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="ALLOWED")
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    user_role: Mapped[str | None] = mapped_column(String(50), nullable=True)
    requested_resource: Mapped[str | None] = mapped_column(String(255), nullable=True)
    action: Mapped[str | None] = mapped_column(String(100), nullable=True)
    details_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = timestamp_column()


class SecurityAlert(Base):
    __tablename__ = 'security_alerts'

    id: Mapped[int] = mapped_column(primary_key=True)
    alert_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    severity: Mapped[str] = mapped_column(String(30), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="ACTIVE")
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = timestamp_column()
    resolved_at: Mapped[datetime | None] = nullable_timestamp_column()


class SecurityConfig(Base):
    __tablename__ = 'security_configs'

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    value_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_at: Mapped[datetime] = timestamp_column()


class UserOTP(Base):
    __tablename__ = 'user_otps'

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True, nullable=False)
    otp_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    salt: Mapped[str] = mapped_column(String(32), nullable=False)
    attempts_left: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_sent_at: Mapped[datetime] = timestamp_column()
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = timestamp_column()

    user: Mapped['User'] = relationship()



