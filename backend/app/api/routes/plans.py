from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas.plans import AgentPlanRequest, OperationalPlan
from app.services.plans import generate_plan

router = APIRouter(tags=["operations"])


@router.post("/agent-plan", response_model=OperationalPlan)
async def agent_plan(data: AgentPlanRequest) -> OperationalPlan:
    return await generate_plan(data, get_settings())

