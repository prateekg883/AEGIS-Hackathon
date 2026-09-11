from typing import Any

from pydantic import BaseModel, Field


class EvidenceItem(BaseModel):
    evidence_code: str
    record_type: str
    record_id: str
    summary: str
    evidence_reference: str | None = None
    relationship_to_finding: str = 'supporting evidence'


class FindingExplanation(BaseModel):
    fact: str
    interpretation: str
    manual_verification: str


class FindingExplanationResponse(BaseModel):
    finding_code: str
    rule_code: str
    cse: str
    assessment_period: str
    category: str
    severity: str
    title: str
    explanation: FindingExplanation
    reason: str
    supporting_metrics: list[dict[str, Any]] = Field(default_factory=list)
    observed_value: str | None = None
    expected_value: str | None = None
    deviation: str | None = None
    evidence: list[EvidenceItem] = Field(default_factory=list)
    data_limitations: list[str] = Field(default_factory=list)
    manual_verification_guidance: list[str] = Field(default_factory=list)


class EvidenceResponse(BaseModel):
    finding_code: str
    cse: str
    assessment_period: str
    evidence: list[EvidenceItem] = Field(default_factory=list)


class AttentionScoreComponent(BaseModel):
    value: float | None = None
    weight: float | None = None
    contribution: float | None = None
    status: str
    reason: str | None = None


class AttentionScoreExplanationResponse(BaseModel):
    cse_code: str
    assessment_period: str
    attention_level: str
    total_score: float
    component_breakdown: dict[str, AttentionScoreComponent]
    explanation: str
    top_contributing_findings: list[str] = Field(default_factory=list)
    data_limitations: list[str] = Field(default_factory=list)
