from pydantic import BaseModel


class WeatherResponse(BaseModel):
    temperature: float
    humidity: float
    wind_speed: float
    wind_direction: float
    wind_gusts: float | None = None
    time: str
    source: str = "Open-Meteo"

