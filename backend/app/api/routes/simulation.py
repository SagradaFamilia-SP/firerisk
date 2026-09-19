from fastapi import APIRouter

from app.schemas.simulation import ScenarioInput, SimulationResponse
from app.services.simulation import simulate_scenario

router = APIRouter(tags=["simulation"])


@router.post("/simulate", response_model=SimulationResponse)
def simulate(data: ScenarioInput) -> SimulationResponse:
    return simulate_scenario(data)

