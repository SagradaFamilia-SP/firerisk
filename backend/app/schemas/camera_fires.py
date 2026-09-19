from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class CameraFireCreate(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    confidence: float = Field(ge=0, le=1)
    label: str = "Cámara en tiempo real"


class CameraFireDetection(BaseModel):
    id: int
    latitude: float
    longitude: float
    confidence: float
    label: str
    source: Literal["camera"] = "camera"
    detected_at: datetime
    recording_url: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _derive_recording_url(cls, data: Any) -> Any:
        if isinstance(data, dict) and data.get("recording_path"):
            data = {**data, "recording_url": f"/camera-fires/{data['id']}/recording"}
        return data
