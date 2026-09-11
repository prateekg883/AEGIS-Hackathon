from typing import Any
from pydantic import BaseModel, Field


class EntityReviewItem(BaseModel):
    cse_code: str
    cse_name: str
    company: str
    sector: str
    dataset_name: str
    file_type: str
    assessment_period: str
    record_count: int
    asset_count: int
    event_count: int
    alert_count: int
    threat_count: int
    critical_event_count: int
    protocols: list[str] = Field(default_factory=list)
    severity_distribution: dict[str, int] = Field(default_factory=dict)
    findings_count: int
    evidence_count: int
    cases_count: int
    investigations_count: int
    escalations_count: int
    available_supervisory_metrics: list[str] = Field(default_factory=list)
    is_demo: bool = False


class EntityReviewRequest(BaseModel):
    cse_codes: list[str]


class EntityReviewResponse(BaseModel):
    entities: list[EntityReviewItem]


class ComparisonBasisSelection(BaseModel):
    structure: list[str] = Field(default_factory=lambda: ["CSE", "Assets", "Datasets", "Protocols"])
    security: list[str] = Field(default_factory=lambda: ["Threat Types", "Severity", "Threat Volume", "Critical Events"])
    soc_supervisory: list[str] = Field(default_factory=lambda: [
        "Attention Score", "Execution Gaps", "Response Time", "Escalation Rate",
        "Evidence Verification", "Asset Telemetry"
    ])


class ComparabilityCheck(BaseModel):
    level: str = "HIGH"  # HIGH | MEDIUM | LOW
    score: float = 1.0
    reasons: list[str] = Field(default_factory=list)
    warning: str | None = None


class ComparisonPreviewRequest(BaseModel):
    cse_codes: list[str]
    basis: ComparisonBasisSelection = Field(default_factory=ComparisonBasisSelection)


class ComparisonPreviewResponse(BaseModel):
    company: str
    selected_cses: list[str]
    comparison_level: str = "CSE-level"
    comparison_basis: list[str]
    assessment_period: str
    datasets_count: int
    assets_count: int
    events_count: int
    comparability: ComparabilityCheck


class MultiCSECompareRequest(BaseModel):
    cse_codes: list[str]
    basis: ComparisonBasisSelection = Field(default_factory=ComparisonBasisSelection)
    assessment_period: str | None = None


class MetricComparisonRow(BaseModel):
    metric_key: str
    metric_label: str
    category: str  # STRUCTURE | SECURITY | SOC_SUPERVISORY
    values: dict[str, Any]
    raw_values: dict[str, float | None]
    unit: str | None = None
    status: dict[str, str]  # AVAILABLE | INSUFFICIENT_DATA


class ThreatComparisonRow(BaseModel):
    threat_type: str
    counts: dict[str, int]


class AssetComparisonRow(BaseModel):
    asset_identifier: str
    asset_name: str
    match_type: str  # "Exact asset match" | "Comparable asset type" | "Non-comparable"
    present_in: list[str]
    criticality: str
    alert_activity: dict[str, int]


class ProtocolComparisonRow(BaseModel):
    protocol: str
    counts: dict[str, int]


class MultiCSECompareResponse(BaseModel):
    scope: str = "CSE-level"
    entities: list[str]
    company: str
    assessment_period: str
    comparability: ComparabilityCheck
    metrics_table: list[MetricComparisonRow]
    threat_comparison: list[ThreatComparisonRow]
    asset_comparison: list[AssetComparisonRow]
    protocol_comparison: list[ProtocolComparisonRow]
    severity_comparison: dict[str, dict[str, int]]
    charts_data: dict[str, Any]


class ProvenanceNode(BaseModel):
    level: str
    name: str
    detail: str
    count: int | None = None


class EntityDrillDownResponse(BaseModel):
    cse_code: str
    metric: str
    value_display: str
    explanation: str
    provenance_chain: list[ProvenanceNode]
    sample_records: list[dict[str, Any]]
