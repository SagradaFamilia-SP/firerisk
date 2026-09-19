from fastapi import APIRouter

from app.api.routes import chat, fires, health, location, speech, spread, weather

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(fires.router)
api_router.include_router(location.router)
api_router.include_router(weather.router)
api_router.include_router(spread.router)
api_router.include_router(chat.router)
api_router.include_router(speech.router)
