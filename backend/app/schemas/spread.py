from typing import Literal

from pydantic import BaseModel, Field


class SpreadRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    max_hours: int = Field(default=12, ge=1, le=24)


class SpreadPoint(BaseModel):
    lat: float
    lon: float


class SpreadSnapshot(BaseModel):
    hour: int
    radius_km_min: float
    radius_km_max: float
    radius_km_mean: float
    area_km2: float
    rings: list[list[SpreadPoint]]


class WeatherSample(BaseModel):
    time: str
    wind_kmh: float
    wind_from_deg: float
    temperature_c: float
    rh_pct: float


class SpreadResponse(BaseModel):
    center: SpreadPoint
    max_hours: int
    terrain_source: Literal["open-meteo-dem", "flat-fallback"]
    fuel_source: Literal["esa-worldcover", "fallback-grass"]
    ignition_points: list[SpreadPoint]
    weather: list[WeatherSample]
    snapshots: list[SpreadSnapshot]
    warning: str
    model_notes: list[str]
