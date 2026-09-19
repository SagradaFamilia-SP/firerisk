from fastapi import APIRouter, HTTPException

from app.schemas.spread import SpreadRequest, SpreadResponse
from app.services.spread import SpreadUnavailableError, simulate_spread

router = APIRouter(tags=["spread"])


@router.post("/spread", response_model=SpreadResponse)
async def spread(data: SpreadRequest) -> SpreadResponse:
    try:
        return await simulate_spread(data.lat, data.lon, data.max_hours)
    except SpreadUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
