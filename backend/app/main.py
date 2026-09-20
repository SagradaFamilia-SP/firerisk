import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.services.firms import get_firms_service

logger = logging.getLogger(__name__)


async def _refresh_firms_loop(interval_seconds: int) -> None:
    """Keeps the FIRMS master cache warm on a timer, independent of any
    request — so a user opening the map is never the one who waits for the
    NASA round trip. Runs once immediately, then every `interval_seconds`."""
    service = get_firms_service()
    while True:
        try:
            await service.refresh_master()
        except Exception:
            logger.exception("FIRMS background refresh failed; keeping the previous data")
        await asyncio.sleep(interval_seconds)


@asynccontextmanager
async def lifespan(application: FastAPI):
    settings = get_settings()
    task = asyncio.create_task(_refresh_firms_loop(settings.firms_refresh_interval_seconds))
    try:
        yield
    finally:
        task.cancel()


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title="PYROS API",
        description="Wildfire intelligence and operational planning API",
        version="1.0.0",
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.frontend_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(api_router, prefix="/api")
    return application


app = create_app()
