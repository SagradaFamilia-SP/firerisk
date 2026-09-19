"""
Directional wildfire spread estimator.

Adapts the prototype ROS (rate-of-spread) model from tests/ROS.py: real hourly
wind/humidity/temperature (Open-Meteo forecast) and a lightweight local slope
estimate (Open-Meteo elevation) drive an anisotropic spread rate that is
marched outward from an ignition point along a ring of bearings. This is
intentionally a directional prototype, not a validated Rothermel
implementation, and must not be used for emergency or life-safety decisions.
"""

import math

import httpx

from app.schemas.spread import SpreadPoint, SpreadResponse, SpreadSnapshot, WeatherSample

WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
ELEVATION_URL = "https://api.open-meteo.com/v1/elevation"

EARTH_RADIUS_KM = 6_371.0
TERRAIN_OFFSET_M = 300.0
BEARINGS: tuple[int, ...] = tuple(range(0, 360, 10))
STEP_M = 25.0

BASE_ROS_M_MIN = 1.50
MIN_ROS_M_MIN = 0.02
MAX_ROS_M_MIN = 25.0


class SpreadUnavailableError(RuntimeError):
    pass


def _clip(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def angular_diff_deg(a: float, b: float) -> float:
    return abs((a - b + 180.0) % 360.0 - 180.0)


def destination_point(lat: float, lon: float, bearing_deg: float, distance_km: float) -> tuple[float, float]:
    angle = math.radians(bearing_deg)
    lat1, lon1 = math.radians(lat), math.radians(lon)
    delta = distance_km / EARTH_RADIUS_KM

    lat2 = math.asin(
        math.sin(lat1) * math.cos(delta) + math.cos(lat1) * math.sin(delta) * math.cos(angle)
    )
    lon2 = lon1 + math.atan2(
        math.sin(angle) * math.sin(delta) * math.cos(lat1),
        math.cos(delta) - math.sin(lat1) * math.sin(lat2),
    )
    return math.degrees(lat2), math.degrees(lon2)


def polygon_area_km2(center_lat: float, points: list[tuple[float, float]]) -> float:
    if len(points) < 3:
        return 0.0
    km_per_deg_lat = 111.32
    km_per_deg_lon = 111.32 * math.cos(math.radians(center_lat))
    xy = [(lon * km_per_deg_lon, lat * km_per_deg_lat) for lat, lon in points]
    area = 0.0
    for index in range(len(xy)):
        x1, y1 = xy[index]
        x2, y2 = xy[(index + 1) % len(xy)]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0


def directional_ros_m_min(
    slope_deg: float,
    upslope_bearing_deg: float,
    spread_bearing_deg: float,
    weather: dict,
) -> float:
    ros = BASE_ROS_M_MIN

    rh = weather["rh_pct"]
    temp = weather["temperature_c"]
    precip = weather["precip_mm"]

    humidity_factor = _clip(1.65 - 0.012 * rh, 0.35, 1.45)
    temperature_factor = _clip(0.85 + 0.018 * max(temp - 10.0, 0.0), 0.80, 1.45)
    rain_factor = math.exp(-0.9 * max(precip, 0.0))
    ros *= humidity_factor * temperature_factor * rain_factor

    downwind = (weather["wind_from_deg"] + 180.0) % 360.0
    wind_alignment = math.cos(math.radians(angular_diff_deg(spread_bearing_deg, downwind)))
    effective_wind_kmh = weather["wind_kmh"] + 0.15 * max(weather["gust_kmh"] - weather["wind_kmh"], 0.0)
    wind_factor = _clip(math.exp(0.055 * effective_wind_kmh * wind_alignment), 0.15, 8.0)
    ros *= wind_factor

    slope_alignment = math.cos(math.radians(angular_diff_deg(spread_bearing_deg, upslope_bearing_deg)))
    slope_tangent = math.tan(math.radians(min(max(slope_deg, 0.0), 45.0)))
    slope_factor = _clip(math.exp(2.2 * slope_tangent * slope_alignment), 0.20, 6.0)
    ros *= slope_factor

    return _clip(ros, MIN_ROS_M_MIN, MAX_ROS_M_MIN)


def march_bearing(
    bearing_deg: float,
    weather: list[dict],
    slope_deg: float,
    upslope_bearing_deg: float,
    max_hours: int,
) -> list[float]:
    """Returns distance travelled (km) at each integer hour 0..max_hours."""
    distances_km = [0.0] * (max_hours + 1)
    t_min = 0.0
    distance_m = 0.0
    next_hour = 1

    while next_hour <= max_hours:
        weather_idx = min(int(t_min // 60), len(weather) - 1)
        ros = directional_ros_m_min(slope_deg, upslope_bearing_deg, bearing_deg, weather[weather_idx])

        dt_min = STEP_M / ros
        new_t_min = t_min + dt_min
        new_distance_m = distance_m + STEP_M

        threshold_min = next_hour * 60.0
        while next_hour <= max_hours and new_t_min >= threshold_min:
            fraction = (threshold_min - t_min) / (new_t_min - t_min) if new_t_min > t_min else 0.0
            interpolated_m = distance_m + (new_distance_m - distance_m) * fraction
            distances_km[next_hour] = interpolated_m / 1000.0
            next_hour += 1
            threshold_min = next_hour * 60.0

        t_min, distance_m = new_t_min, new_distance_m

    return distances_km


async def fetch_hourly_weather(lat: float, lon: float, hours: int) -> list[dict]:
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join(
            [
                "temperature_2m",
                "relative_humidity_2m",
                "precipitation",
                "wind_speed_10m",
                "wind_direction_10m",
                "wind_gusts_10m",
            ]
        ),
        "forecast_hours": max(hours + 1, 12),
        "wind_speed_unit": "kmh",
        "timezone": "UTC",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(WEATHER_URL, params=params)
            response.raise_for_status()
        hourly = response.json()["hourly"]
        result = [
            {
                "time": ts,
                "temperature_c": float(hourly["temperature_2m"][index]),
                "rh_pct": float(hourly["relative_humidity_2m"][index]),
                "precip_mm": float(hourly["precipitation"][index]),
                "wind_kmh": float(hourly["wind_speed_10m"][index]),
                "wind_from_deg": float(hourly["wind_direction_10m"][index]),
                "gust_kmh": float(hourly["wind_gusts_10m"][index]),
            }
            for index, ts in enumerate(hourly["time"])
        ]
        if not result:
            raise SpreadUnavailableError("Meteorología no disponible")
        return result
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        raise SpreadUnavailableError("Meteorología no disponible") from exc


async def fetch_local_terrain(lat: float, lon: float) -> tuple[float, float, str]:
    offset_km = TERRAIN_OFFSET_M / 1000.0
    north = destination_point(lat, lon, 0.0, offset_km)
    east = destination_point(lat, lon, 90.0, offset_km)
    south = destination_point(lat, lon, 180.0, offset_km)
    west = destination_point(lat, lon, 270.0, offset_km)
    samples = [(lat, lon), north, east, south, west]

    try:
        params = {
            "latitude": ",".join(f"{point[0]:.6f}" for point in samples),
            "longitude": ",".join(f"{point[1]:.6f}" for point in samples),
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(ELEVATION_URL, params=params)
            response.raise_for_status()
        elevations = [float(value) for value in response.json()["elevation"]]
        if len(elevations) != 5:
            raise ValueError("respuesta de elevación incompleta")
        _, north_elev, east_elev, south_elev, west_elev = elevations

        dz_north = (north_elev - south_elev) / (2 * TERRAIN_OFFSET_M)
        dz_east = (east_elev - west_elev) / (2 * TERRAIN_OFFSET_M)
        slope_deg = math.degrees(math.atan(math.hypot(dz_north, dz_east)))
        upslope_bearing_deg = (math.degrees(math.atan2(dz_east, dz_north)) + 360.0) % 360.0
        return slope_deg, upslope_bearing_deg, "open-meteo-dem"
    except (httpx.HTTPError, ValueError, KeyError, TypeError, IndexError):
        return 0.0, 0.0, "flat-fallback"


async def simulate_spread(lat: float, lon: float, max_hours: int) -> SpreadResponse:
    weather = await fetch_hourly_weather(lat, lon, max_hours)
    slope_deg, upslope_bearing_deg, terrain_source = await fetch_local_terrain(lat, lon)

    distances_by_bearing = {
        bearing: march_bearing(bearing, weather, slope_deg, upslope_bearing_deg, max_hours)
        for bearing in BEARINGS
    }

    snapshots: list[SpreadSnapshot] = []
    for hour in range(max_hours + 1):
        radii_km = [distances_by_bearing[bearing][hour] for bearing in BEARINGS]
        polygon_points = [
            destination_point(lat, lon, bearing, radii_km[index]) for index, bearing in enumerate(BEARINGS)
        ]
        max_radius = max(radii_km)
        snapshots.append(
            SpreadSnapshot(
                hour=hour,
                radius_km_min=round(min(radii_km), 3),
                radius_km_max=round(max_radius, 3),
                radius_km_mean=round(sum(radii_km) / len(radii_km), 3),
                area_km2=round(polygon_area_km2(lat, polygon_points), 3) if max_radius > 0 else 0.0,
                polygon=[SpreadPoint(lat=point_lat, lon=point_lon) for point_lat, point_lon in polygon_points],
            )
        )

    return SpreadResponse(
        center=SpreadPoint(lat=lat, lon=lon),
        max_hours=max_hours,
        terrain_source=terrain_source,
        weather=[
            WeatherSample(
                time=sample["time"],
                wind_kmh=sample["wind_kmh"],
                wind_from_deg=sample["wind_from_deg"],
                temperature_c=sample["temperature_c"],
                rh_pct=sample["rh_pct"],
            )
            for sample in weather[: max_hours + 1]
        ],
        snapshots=snapshots,
        warning=(
            "Simulación experimental de propagación direccional. No usar para "
            "decisiones de emergencia, evacuación o seguridad de vidas."
        ),
    )
