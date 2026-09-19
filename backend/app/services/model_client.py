import httpx

from app.core.config import Settings
from app.schemas.health import HealthResponse


async def generate_chat_completion(
    settings: Settings,
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.3,
    max_tokens: int = 700,
    timeout: float = 15.0,
) -> str | None:
    """Asks the configured OpenAI-compatible model for a completion.

    Returns None on any failure (offline model, bad response shape, timeout)
    so callers can fall back to a deterministic reply instead of surfacing
    an error for what is, from the model's point of view, an optional
    narrative layer over already-computed data.
    """
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{settings.model_base_url}/chat/completions",
                json={
                    "model": settings.model_id,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
            )
            response.raise_for_status()
            payload = response.json()
        content = payload["choices"][0]["message"]["content"]
        return content.strip() if isinstance(content, str) and content.strip() else None
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
        return None


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

