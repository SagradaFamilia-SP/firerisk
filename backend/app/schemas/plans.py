from typing import Literal

from pydantic import BaseModel, Field


class Incident(BaseModel):
    type: str
    location: str
    temperature: float
    humidity: float
    wind_speed: float
    wind_direction: float
    horizon_hours: int
    top_eta_min: int | None = None
    territorial_risk: float


class PlanAsset(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    value_eur: int
    people: int
    probability: int = Field(ge=0, le=100)


class AgentPlanRequest(BaseModel):
    incident: Incident
    assets: list[PlanAsset]


class PlanAction(BaseModel):
    priority: int
    owner: str
    action: str
    deadline_min: int


class OperationalPlan(BaseModel):
    mode: Literal["local_model", "deterministic_fallback"]
    summary: str
    decision: str
    actions: list[PlanAction]
    message: str
    confidence_note: str
    model_error: str | None = None


class ModelPlanPayload(BaseModel):
    summary: str
    decision: str
    actions: list[PlanAction]
    message: str
    confidence_note: str

