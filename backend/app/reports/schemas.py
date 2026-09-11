from pydantic import BaseModel


class GenerateReportRequest(BaseModel):
    cse_code: str
    assessment_period: str | None = None


class AssessmentReportSummary(BaseModel):
    report_id: int
    report_code: str
    cse_code: str
    assessment_period: str
    title: str
    report_status: str


class AssessmentReportDetail(AssessmentReportSummary):
    summary: str | None = None
    supervisory_attention: dict
    execution_gap_observations: list[dict]
    negative_space_observations: list[dict]
    peer_benchmarking: list[dict]
    priority_manual_review_samples: list[dict]
    evidence_traceability: bool
    manual_verification_areas: list[str]
    data_limitations: list[str]
    assessment_scope: dict
