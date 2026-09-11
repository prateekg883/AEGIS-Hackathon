from pydantic import BaseModel


class AnomalyRunRequest(BaseModel):
    cse_code: str | None = None
    ingestion_batch_code: str | None = None


class AnomalyRunResponse(BaseModel):
    run_code: str
    status: str
    cse_code: str | None
    assessment_period: str
    rules_evaluated: int
    findings_created: int
    note: str | None = None


class AnomalyRunStatus(BaseModel):
    run_code: str
    status: str
    run_type: str
    cse_code: str | None
    assessment_period: str
    started_at: str
    completed_at: str | None
    findings_created: int
