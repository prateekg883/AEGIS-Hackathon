from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=['health'])


class HealthResponse(BaseModel):
    status: str
    service: str
    mode: str


@router.get('/health', response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(
        status='ok',
        service='aegis-sat-api',
        mode='offline',
    )
