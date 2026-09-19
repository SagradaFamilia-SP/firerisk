from fastapi import APIRouter

from app.api.routes import health, plans, simulation, weather

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(weather.router)
api_router.include_router(simulation.router)
api_router.include_router(plans.router)

