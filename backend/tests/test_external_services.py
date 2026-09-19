import httpx
import pytest
import respx
from fastapi.testclient import TestClient
from httpx import Response

from app.core.config import Settings
from app.schemas.plans import AgentPlanRequest
from app.services.model_client import check_model_health
from app.services.plans import generate_plan
from app.services.weather import WeatherUnavailableError, fetch_weather


@respx.mock
@pytest.mark.asyncio
async def test_weather_normalizes_open_meteo_current_payload() -> None:
    respx.get("https://api.open-meteo.com/v1/forecast").mock(
        return_value=Response(
            200,
            json={
                "current": {
                    "temperature_2m": 37.4,
                    "relative_humidity_2m": 18,
                    "wind_speed_10m": 34.2,
                    "wind_direction_10m": 72,
                    "wind_gusts_10m": 49.1,
                    "time": "2026-09-19T14:30",
                }
            },
        )
    )
    weather = await fetch_weather(39.7178, -6.2631)
    assert weather.temperature == 37.4
    assert weather.wind_direction == 72
    assert weather.source == "Open-Meteo"


@respx.mock
@pytest.mark.asyncio
async def test_weather_timeout_becomes_domain_error() -> None:
    respx.get("https://api.open-meteo.com/v1/forecast").mock(side_effect=httpx.ReadTimeout("late"))
    with pytest.raises(WeatherUnavailableError, match="Meteorología no disponible"):
        await fetch_weather(39.7178, -6.2631)


@respx.mock
@pytest.mark.asyncio
async def test_model_markdown_json_is_validated() -> None:
    settings = Settings()
    respx.post(f"{settings.model_base_url}/chat/completions").mock(
        return_value=Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": "```json\n{\"summary\":\"Riesgo alto\",\"decision\":\"PREALERTA\",\"actions\":[{\"priority\":1,\"owner\":\"Control\",\"action\":\"Validar foco\",\"deadline_min\":2}],\"message\":\"Permanezca atento\",\"confidence_note\":\"Validar con emergencias\"}\n```"
                        }
                    }
                ]
            },
        )
    )
    plan = await generate_plan(_plan_request(), settings)
    assert plan.mode == "local_model"
    assert plan.actions[0].deadline_min == 2


@respx.mock
@pytest.mark.asyncio
async def test_malformed_model_output_returns_fallback() -> None:
    settings = Settings()
    respx.post(f"{settings.model_base_url}/chat/completions").mock(
        return_value=Response(200, json={"choices": [{"message": {"content": "not json"}}]})
    )
    plan = await generate_plan(_plan_request(), settings)
    assert plan.mode == "deterministic_fallback"
    assert plan.actions
    assert plan.model_error is not None


@respx.mock
@pytest.mark.asyncio
async def test_null_model_content_returns_fallback() -> None:
    settings = Settings()
    respx.post(f"{settings.model_base_url}/chat/completions").mock(
        return_value=Response(200, json={"choices": [{"message": {"content": None}}]})
    )
    plan = await generate_plan(_plan_request(), settings)
    assert plan.mode == "deterministic_fallback"
    assert plan.actions
    assert plan.model_error == "ValueError: El modelo no devolvió contenido de texto"


@respx.mock
@pytest.mark.asyncio
async def test_offline_model_keeps_health_endpoint_healthy() -> None:
    settings = Settings()
    respx.get(f"{settings.model_base_url}/models").mock(side_effect=httpx.ConnectError("offline"))
    health = await check_model_health(settings)
    assert health.ok is True
    assert health.model_online is False


def test_weather_route_returns_502_on_upstream_failure(client: TestClient) -> None:
    with respx.mock(assert_all_called=True) as router:
        router.get("https://api.open-meteo.com/v1/forecast").mock(
            side_effect=httpx.ConnectError("offline")
        )
        response = client.get("/api/weather?lat=39.7178&lon=-6.2631")
    assert response.status_code == 502
    assert response.json()["detail"] == "Meteorología no disponible"


def _plan_request() -> AgentPlanRequest:
    return AgentPlanRequest.model_validate(
        {
            "incident": {
                "type": "wildfire",
                "location": "Talaván Norte",
                "temperature": 39,
                "humidity": 14,
                "wind_speed": 41,
                "wind_direction": 68,
                "horizon_hours": 3,
                "top_eta_min": 54,
                "territorial_risk": 82,
            },
            "assets": [
                {
                    "id": "solar",
                    "name": "Planta Solar Talaván Norte",
                    "lat": 39.7178,
                    "lng": -6.2631,
                    "value_eur": 18_500_000,
                    "people": 9,
                    "probability": 82,
                }
            ],
        }
    )
