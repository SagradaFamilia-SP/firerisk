from fastapi import APIRouter

from app.api.routes import fires, health, location, spread, weather

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(fires.router)
api_router.include_router(location.router)
api_router.include_router(weather.router)
api_router.include_router(spread.router)
