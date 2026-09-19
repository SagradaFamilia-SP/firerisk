from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.schemas.location import ReverseLocationResponse
from app.services.location import LocationService, LocationUnavailableError, get_location_service

router = APIRouter(tags=["location"])
Service = Annotated[LocationService, Depends(get_location_service)]


@router.get("/location/reverse", response_model=ReverseLocationResponse)
async def reverse_location(
    service: Service,
    lat: Annotated[float, Query(ge=-90, le=90)],
    lon: Annotated[float, Query(ge=-180, le=180)],
) -> ReverseLocationResponse:
    try:
        return await service.reverse(lat, lon)
    except LocationUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
