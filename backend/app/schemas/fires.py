from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

FirmsSource = Literal["VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"]
FireConfidence = Literal["low", "nominal", "high"]


class FireDetection(BaseModel):
    id: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    acquired_at: datetime
    satellite: str
    instrument: str
    source: FirmsSource
    confidence: FireConfidence
    brightness: float
    brightness_ti5: float | None = None
    frp: float | None = None
    scan: float | None = None
    track: float | None = None
    daynight: Literal["day", "night"]


class FireMeta(BaseModel):
    sources: list[FirmsSource]
    requested_hours: Literal[24, 48, 72]
    fetched_at: datetime
    latest_acquisition: datetime | None
    count: int
    stale: bool = False
    cache: Literal["hit", "miss"] = "miss"


class FireResponse(BaseModel):
    detections: list[FireDetection]
    meta: FireMeta


class FireQuery(BaseModel):
    west: float = Field(ge=-180, le=180)
    south: float = Field(ge=-90, le=90)
    east: float = Field(ge=-180, le=180)
    north: float = Field(ge=-90, le=90)
    hours: Literal[24, 48, 72] = 24
    sources: list[FirmsSource] = ["VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"]
    min_confidence: FireConfidence = "low"

    @model_validator(mode="after")
    def validate_bounds_and_sources(self) -> "FireQuery":
        if self.south >= self.north:
            raise ValueError("south debe ser menor que north")
        if self.west == self.east:
            raise ValueError("west y east no pueden ser iguales")
        if not self.sources:
            raise ValueError("Debe seleccionarse al menos una fuente")
        return self


class WmsQuery(BaseModel):
    service: Literal["WMS"] = "WMS"
    request: Literal["GetMap"] = "GetMap"
    version: Literal["1.1.1", "1.3.0"] = "1.1.1"
    layers: str
    styles: str = ""
    format: Literal["image/png"] = "image/png"
    transparent: Literal["true", "false"] = "true"
    width: int = Field(ge=1, le=1024)
    height: int = Field(ge=1, le=1024)
    bbox: str
    srs: str | None = None
    crs: str | None = None

    @model_validator(mode="after")
    def validate_wms(self) -> "WmsQuery":
        allowed = {"fires_viirs_noaa20_24", "fires_viirs_noaa21_24"}
        selected = {item.strip() for item in self.layers.split(",") if item.strip()}
        if not selected or not selected.issubset(allowed):
            raise ValueError("Capa WMS no permitida")
        if not (self.srs or self.crs):
            raise ValueError("Se requiere srs o crs")
        coordinates = self.bbox.split(",")
        if len(coordinates) != 4:
            raise ValueError("bbox WMS inválido")
        try:
            [float(value) for value in coordinates]
        except ValueError as exc:
            raise ValueError("bbox WMS inválido") from exc
        return self

