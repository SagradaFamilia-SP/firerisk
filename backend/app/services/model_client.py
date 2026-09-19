import httpx

from app.core.config import Settings
from app.schemas.health import HealthResponse


async def generate_chat_completion(
    settings: Settings,
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.3,
    max_tokens: int = 1_500,
    timeout: float = 30.0,
) -> str | None:
    """Asks the configured OpenAI-compatible models for a completion.

    The configured model is a Qwen3-style hybrid reasoning model: by default
    it spends a chunk of its own `max_tokens` budget "thinking" (returned
    separately as `message.reasoning`, with `message.content` left null)
    before it writes the actual answer — a trivial one-word test reply alone
    used ~180 reasoning tokens. `enable_thinking: false` (vLLM's chat template
    switch for this model family) skips that entirely, so the full budget
    goes straight to the answer we actually want and replies come back fast.

    Returns None on any failure (offline models, bad response shape, timeout)
    so callers can fall back to a deterministic reply instead of surfacing
    an error for what is, from the models's point of view, an optional
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
                    "chat_template_kwargs": {"enable_thinking": False},
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

