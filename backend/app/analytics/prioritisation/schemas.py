from pydantic import BaseModel


class PrioritisationRequest(BaseModel):
    cse_code: str
    ingestion_batch_code: str | None = None


class PrioritisedSampleView(BaseModel):
    rank: int
    record_type: str
    record_id: str
    priority_score: float
    severity: str
    reason: str
    review_status: str


class PrioritisationResponse(BaseModel):
    run_code: str
    cse_code: str
    status: str
    total_samples: int
    samples: list[PrioritisedSampleView]
