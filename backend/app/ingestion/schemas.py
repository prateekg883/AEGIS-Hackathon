from typing import Any

from pydantic import BaseModel, Field


class IngestionError(BaseModel):
    row: int
    field: str | None = None
    error: str


class PipelineStage(BaseModel):
    stage_id: str
    name: str
    description: str
    status: str
    output_summary: str
    metrics: dict[str, Any] = Field(default_factory=dict)


class AnalyticsSummary(BaseModel):
    attention_score: float | None = None
    attention_level: str | None = None
    execution_gaps_count: int = 0
    negative_space_count: int = 0
    anomalies_count: int = 0
    prioritised_samples_count: int = 0
    report_status: str = "GENERATED"
    stages: list[PipelineStage] = Field(default_factory=list)


class IngestionResult(BaseModel):
    batch_code: str
    status: str
    record_type: str
    total_records: int
    accepted_records: int
    rejected_records: int
    errors: list[IngestionError] = Field(default_factory=list)
    analytics: AnalyticsSummary | None = None



class BatchStatus(BaseModel):
    batch_code: str
    source_type: str
    source_name: str
    assessment_period: str
    record_count: int
    status: str
    ingested_at: str | None = None
    accepted_records: int | None = None
    rejected_records: int | None = None
