from pydantic import BaseModel, Field


class AttentionScoreRequest(BaseModel):
    cse_code: str
    ingestion_batch_code: str | None = None
    weights: dict[str, float] | None = None
    thresholds: dict[str, float] | None = None


class AttentionScoreResponse(BaseModel):
    run_code: str
    cse_code: str
    assessment_period: str
    status: str
    execution_gap_score: float
    negative_space_score: float
    anomaly_score: float
    peer_deviation_score: float
    total_score: float
    attention_level: str
    explanation: str
    policy_tier: str | None = None
    policy_status: str | None = None
    action_required: str | None = None
    requires_human_review: bool | None = None
    eligible_for_escalation: bool | None = None


class AttentionScoreView(AttentionScoreResponse):
    pass
