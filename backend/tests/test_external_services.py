import httpx
import pytest
import respx
from fastapi.testclient import TestClient
from httpx import Response

from app.core.config import Settings
from app.services.model_client import check_model_health
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
