from pydantic import BaseModel


class ExecutionGapRunRequest(BaseModel):
    cse_code: str | None = None
    ingestion_batch_code: str | None = None


class ExecutionGapRunResponse(BaseModel):
    run_code: str
    status: str
    cse_code: str | None
    rules_evaluated: int
    findings_created: int


class ExecutionGapRunStatus(BaseModel):
    run_code: str
    status: str
    run_type: str
    cse_code: str | None
    started_at: str
    completed_at: str | None
    findings_created: int
