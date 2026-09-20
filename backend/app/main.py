import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse

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
        # orjson serializes a large list of Pydantic models (e.g. tens of
        # thousands of fire detections for a world view) far faster than
        # FastAPI's default json+jsonable_encoder path, which was a real
        # chunk of the /api/fires response time even once the data itself
        # came straight from the in-memory master cache.
        default_response_class=ORJSONResponse,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.frontend_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # Shrinks a large /api/fires payload well before it hits the network —
    # matters more here than usual since Apache's reverse proxy in front of
    # this doesn't compress on its own.
    application.add_middleware(GZipMiddleware, minimum_size=1000)
    application.include_router(api_router, prefix="/api")
    return application


app = create_app()
