import httpx

from app.core.config import Settings
from app.schemas.health import HealthResponse


async def check_model_health(settings: Settings) -> HealthResponse:
    models: list[str] = []
    online = False
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(f"{settings.model_base_url}/models")
            response.raise_for_status()
            models = [str(item.get("id", "")) for item in response.json().get("data", [])]
            online = True
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        online = False
    return HealthResponse(
        model_online=online,
        models=models,
        configured_model=settings.model_id,
    )

