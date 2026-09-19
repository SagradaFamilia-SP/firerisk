import pytest
import respx
from httpx import Response

from app.services.spread import (
    ELEVATION_URL,
    WEATHER_URL,
    angular_diff_deg,
    destination_point,
    directional_ros_m_min,
    march_bearing,
    simulate_spread,
)

CALM_WEATHER = {
    "rh_pct": 40.0,
    "temperature_c": 25.0,
    "precip_mm": 0.0,
    "wind_from_deg": 0.0,
    "wind_kmh": 0.0,
    "gust_kmh": 0.0,
}


def test_angular_diff_wraps_around_360() -> None:
    assert angular_diff_deg(350, 10) == 20
    assert angular_diff_deg(10, 350) == 20


def test_destination_point_north_increases_latitude() -> None:
    lat, lon = destination_point(40.0, -3.0, 0.0, 10.0)
    assert lat > 40.0
    assert abs(lon - (-3.0)) < 1e-6


def test_directional_ros_is_bounded() -> None:
    ros = directional_ros_m_min(0.0, 0.0, 45.0, CALM_WEATHER)
    assert 0.02 <= ros <= 25.0


def test_directional_ros_favors_downwind_direction() -> None:
    windy = {**CALM_WEATHER, "wind_kmh": 40.0, "gust_kmh": 45.0, "wind_from_deg": 270.0}
    downwind_ros = directional_ros_m_min(0.0, 0.0, 90.0, windy)
    upwind_ros = directional_ros_m_min(0.0, 0.0, 270.0, windy)
    assert downwind_ros > upwind_ros


def test_march_bearing_distance_grows_monotonically() -> None:
    distances = march_bearing(0.0, [CALM_WEATHER] * 3, 0.0, 0.0, max_hours=3)
    assert distances[0] == 0.0
    assert distances[1] <= distances[2] <= distances[3]
    assert distances[3] > 0.0


@respx.mock
@pytest.mark.asyncio
async def test_simulate_spread_returns_snapshot_per_hour() -> None:
    respx.get(WEATHER_URL).mock(
        return_value=Response(
            200,
            json={
                "hourly": {
                    "time": [f"2026-09-19T{hour:02d}:00" for hour in range(12)],
                    "temperature_2m": [30.0] * 12,
                    "relative_humidity_2m": [20.0] * 12,
                    "precipitation": [0.0] * 12,
                    "wind_speed_10m": [30.0] * 12,
                    "wind_direction_10m": [90.0] * 12,
                    "wind_gusts_10m": [35.0] * 12,
                }
            },
        )
    )
    respx.get(ELEVATION_URL).mock(return_value=Response(200, json={"elevation": [100, 100, 100, 100, 100]}))

    result = await simulate_spread(lat=41.70, lon=2.10, max_hours=4)

    assert result.terrain_source == "open-meteo-dem"
    assert len(result.snapshots) == 5
    assert result.snapshots[0].radius_km_max == 0.0
    radii = [snapshot.radius_km_max for snapshot in result.snapshots]
    assert radii == sorted(radii)
    assert radii[-1] > 0.0
    assert all(len(snapshot.polygon) == 36 for snapshot in result.snapshots)


@respx.mock
@pytest.mark.asyncio
async def test_simulate_spread_falls_back_when_elevation_unavailable() -> None:
    respx.get(WEATHER_URL).mock(
        return_value=Response(
            200,
            json={
                "hourly": {
                    "time": ["2026-09-19T00:00"] * 12,
                    "temperature_2m": [25.0] * 12,
                    "relative_humidity_2m": [40.0] * 12,
                    "precipitation": [0.0] * 12,
                    "wind_speed_10m": [10.0] * 12,
                    "wind_direction_10m": [180.0] * 12,
                    "wind_gusts_10m": [12.0] * 12,
                }
            },
        )
    )
    respx.get(ELEVATION_URL).mock(return_value=Response(500))

    result = await simulate_spread(lat=41.70, lon=2.10, max_hours=2)

    assert result.terrain_source == "flat-fallback"
    assert len(result.snapshots) == 3
