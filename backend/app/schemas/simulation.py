from pydantic import BaseModel, Field


class ScenarioInput(BaseModel):
    hour: int = Field(ge=0, le=24)
    wind_speed: float = Field(ge=0, le=120)
    wind_direction: float = Field(ge=0, le=360)
    temperature: float = Field(ge=-20, le=60)
    humidity: float = Field(ge=0, le=100)
    hotspot_active: bool = True
    hotspot_x: float = Field(ge=0, le=100)
    hotspot_y: float = Field(ge=0, le=100)


class RiskCell(BaseModel):
    id: int
    risk: float
    fuel: float
    slope: float


class AffectedAsset(BaseModel):
    id: str
    name: str
    x: float
    y: float
    lat: float
    lng: float
    value_eur: int
    people: int
    criticality: float
    icon: str
    distance_km: float
    probability: int
    eta_min: int | None


class SimulationMetrics(BaseModel):
    territorial_risk: float
    top_asset: str
    top_probability: int
    top_eta_min: int | None
    exposure_eur: int
    people_exposed: int


class DataSource(BaseModel):
    name: str
    status: str
    detail: str


class SimulationResponse(BaseModel):
    cells: list[RiskCell]
    propagation_polygon: list[list[float]]
    assets: list[AffectedAsset]
    metrics: SimulationMetrics
    sources: list[DataSource]

