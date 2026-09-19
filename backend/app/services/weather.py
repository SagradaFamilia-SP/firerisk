import httpx

from app.schemas.weather import WeatherResponse


class WeatherUnavailableError(RuntimeError):
    pass


async def fetch_weather(lat: float, lon: float) -> WeatherResponse:
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
        "wind_speed_unit": "kmh",
        "timezone": "auto",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get("https://api.open-meteo.com/v1/forecast", params=params)
            response.raise_for_status()
            current = response.json()["current"]
        return WeatherResponse(
            temperature=current["temperature_2m"],
            humidity=current["relative_humidity_2m"],
            wind_speed=current["wind_speed_10m"],
            wind_direction=current["wind_direction_10m"],
            wind_gusts=current.get("wind_gusts_10m"),
            time=current["time"],
        )
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        raise WeatherUnavailableError("Meteorología no disponible") from exc

