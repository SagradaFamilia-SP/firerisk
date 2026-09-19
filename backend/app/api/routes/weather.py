from fastapi import APIRouter, HTTPException, Query

from app.schemas.weather import WeatherResponse
from app.services.weather import WeatherUnavailableError, fetch_weather

router = APIRouter(tags=["weather"])


@router.get("/weather", response_model=WeatherResponse)
async def weather(
    lat: float = Query(default=39.7178, ge=-90, le=90),
    lon: float = Query(default=-6.2631, ge=-180, le=180),
) -> WeatherResponse:
    try:
        return await fetch_weather(lat, lon)
    except WeatherUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

