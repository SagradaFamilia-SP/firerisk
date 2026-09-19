from datetime import UTC, datetime, timedelta

import numpy as np
import pytest
import respx
from httpx import Response

from app.schemas.fires import FireDetection, FireMeta, FireResponse
from app.services import spread
from app.services.firms import FirmsUnavailableError
from app.services.spread import (
    ELEVATION_URL,
    WEATHER_URL,
    FM1,
    FM3,
    angular_diff_deg,
    build_fuel_grid,
    directional_ros,
    estimate_dead_fuel_moisture,
    find_ignition_cells,
    haversine_km,
    latlon_to_cell,
    make_grid,
    neighbor_bearing,
    simulate_grid,
    simulate_spread,
    worldcover_to_fuel_model,
)

DRY_HOT_WEATHER = {
    "rh_pct": 15.0,
    "temperature_c": 32.0,
    "precip_mm": 0.0,
    "wind_from_deg": 270.0,
    "wind_kmh": 30.0,
    "gust_kmh": 35.0,
}


def _fake_detection(lat: float, lon: float, acquired_at: datetime, frp: float = 20.0) -> FireDetection:
    return FireDetection(
        id=f"{lat:.4f}-{lon:.4f}",
        latitude=lat,
        longitude=lon,
        acquired_at=acquired_at,
        satellite="N21",
        instrument="VIIRS",
        source="VIIRS_NOAA21_NRT",
        confidence="nominal",
        brightness=340.0,
        frp=frp,
        daynight="day",
    )


def _fake_response(detections: list[FireDetection]) -> FireResponse:
    return FireResponse(
        detections=detections,
        meta=FireMeta(
            sources=["VIIRS_NOAA21_NRT"],
            requested_hours=24,
            fetched_at=datetime.now(UTC),
            latest_acquisition=max((d.acquired_at for d in detections), default=None),
            count=len(detections),
        ),
    )


class _FakeFirmsService:
    def __init__(self, response: FireResponse | None = None, error: Exception | None = None) -> None:
        self.response = response
        self.error = error

    async def fetch_detections(self, query):  # noqa: ANN001 - test double
        if self.error:
            raise self.error
        return self.response


def test_angular_diff_wraps_around_360() -> None:
    assert angular_diff_deg(350, 10) == 20
    assert angular_diff_deg(10, 350) == 20


def test_haversine_zero_distance_for_same_point() -> None:
    assert haversine_km(41.7, 2.1, 41.7, 2.1) == pytest.approx(0.0, abs=1e-9)


def test_make_grid_and_latlon_to_cell_round_trip() -> None:
    lat_grid, lon_grid = make_grid(41.70, 2.10, 61, 100.0)
    assert lat_grid.shape == (61, 61)
    r, c = latlon_to_cell(41.70, 2.10, lat_grid, lon_grid)
    assert (r, c) == (30, 30)  # centre cell of an odd-sized grid


def test_dead_fuel_moisture_drops_with_low_humidity_and_rises_with_rain() -> None:
    dry = estimate_dead_fuel_moisture(30.0, 15.0, 0.0)
    wet = estimate_dead_fuel_moisture(30.0, 15.0, 5.0)
    assert 0.01 <= dry <= 0.20
    assert wet > dry


def test_worldcover_water_and_urban_are_not_burnable() -> None:
    assert worldcover_to_fuel_model(80) is None  # permanent water
    assert worldcover_to_fuel_model(50) is None  # built-up
    assert worldcover_to_fuel_model(30) is FM3  # grassland


def test_build_fuel_grid_marks_water_as_not_burnable() -> None:
    worldcover = np.array([[30, 80], [50, 10]], dtype=np.uint8)
    fuel_models, burnable = build_fuel_grid(worldcover)
    assert burnable.tolist() == [[True, False], [False, True]]
    assert fuel_models[0, 0] is FM3


def test_directional_ros_is_strongly_nonlinear_with_wind() -> None:
    dead_moisture = estimate_dead_fuel_moisture(32.0, 15.0, 0.0)
    downwind = directional_ros(FM3, dead_moisture, 8.0, 270.0, 0.0, 0.0, 90.0)
    upwind = directional_ros(FM3, dead_moisture, 8.0, 270.0, 0.0, 0.0, 270.0)
    calm_downwind = directional_ros(FM3, dead_moisture, 0.0, 270.0, 0.0, 0.0, 90.0)

    assert downwind > upwind
    # A non-linear (Rothermel power-law) wind coefficient means doubling wind
    # does not merely double ROS; head-fire growth must outpace it heavily.
    assert downwind > calm_downwind * 4


def test_directional_ros_is_zero_for_non_burnable_fuel() -> None:
    assert directional_ros(None, 0.1, 10.0, 270.0, 0.0, 0.0, 90.0) == 0.0


def test_directional_ros_extinguishes_above_moisture_of_extinction() -> None:
    soaked = 0.9  # far above any Anderson model's moisture_extinction
    assert directional_ros(FM3, soaked, 10.0, 270.0, 0.0, 0.0, 90.0) == 0.0


def test_simulate_grid_spreads_further_downwind_than_upwind() -> None:
    rows = cols = 21
    fuel_models = np.full((rows, cols), FM3, dtype=object)
    burnable = np.ones((rows, cols), dtype=bool)
    slope = np.zeros((rows, cols))
    upslope = np.zeros((rows, cols))
    center = (rows // 2, cols // 2)

    arrival = simulate_grid(
        [DRY_HOT_WEATHER] * 6, fuel_models, burnable, slope, upslope, [center], cell_size_m=100.0, max_hours=4
    )

    assert arrival[center] == 0.0
    downwind_time = arrival[center[0], center[1] + 5]  # east, wind blows from the west
    upwind_time = arrival[center[0], center[1] - 5]
    assert np.isfinite(downwind_time)
    assert downwind_time < upwind_time


def test_simulate_grid_stops_at_a_water_barrier() -> None:
    rows = cols = 15
    fuel_models = np.full((rows, cols), FM3, dtype=object)
    burnable = np.ones((rows, cols), dtype=bool)
    center = (rows // 2, cols // 2)
    burnable[:, center[1] + 2] = False  # a north-south "river" east of the ignition
    slope = np.zeros((rows, cols))
    upslope = np.zeros((rows, cols))

    arrival = simulate_grid(
        [DRY_HOT_WEATHER] * 6, fuel_models, burnable, slope, upslope, [center], cell_size_m=100.0, max_hours=6
    )

    assert not np.isfinite(arrival[center[0], center[1] + 3])  # never crosses the river
    assert np.isfinite(arrival[center[0], center[1] + 1])  # but reaches right up to it


def test_ignition_pixel_misclassified_still_burns() -> None:
    """
    Regression test: the reference model force-seeds the ignition cell
    regardless of its own burnability, because a FIRMS detection's sensor
    footprint can legitimately land on a non-burnable WorldCover pixel
    (road/building/water) even though the real fire is in nearby vegetation.
    """
    rows = cols = 11
    fuel_models = np.full((rows, cols), FM3, dtype=object)
    burnable = np.ones((rows, cols), dtype=bool)
    center = (rows // 2, cols // 2)
    fuel_models[center] = None
    burnable[center] = False
    # Mirror simulate_spread's override before calling simulate_grid.
    burnable[center] = True
    fuel_models[center] = FM1
    slope = np.zeros((rows, cols))
    upslope = np.zeros((rows, cols))

    arrival = simulate_grid(
        [DRY_HOT_WEATHER] * 4, fuel_models, burnable, slope, upslope, [center], cell_size_m=100.0, max_hours=2
    )

    assert arrival[center] == 0.0
    assert np.isfinite(arrival[center[0], center[1] + 1])


def test_neighbor_bearing_matches_compass_directions() -> None:
    assert neighbor_bearing(-1, 0) == 0.0  # north
    assert neighbor_bearing(0, 1) == 90.0  # east
    assert neighbor_bearing(1, 0) == 180.0  # south
    assert neighbor_bearing(0, -1) == 270.0  # west


@pytest.mark.asyncio
async def test_find_ignition_cells_seeds_recent_nearby_detections(monkeypatch: pytest.MonkeyPatch) -> None:
    lat, lon = 41.70, 2.10
    lat_grid, lon_grid = make_grid(lat, lon, 61, 100.0)
    now = datetime.now(UTC)

    nearby_recent = _fake_detection(41.701, 2.101, now)
    nearby_stale = _fake_detection(41.699, 2.099, now - timedelta(hours=20))
    far_away = _fake_detection(43.0, 5.0, now)

    monkeypatch.setattr(
        spread,
        "get_firms_service",
        lambda: _FakeFirmsService(_fake_response([nearby_recent, nearby_stale, far_away])),
    )

    cells, used = await find_ignition_cells(lat, lon, lat_grid, lon_grid)

    assert used == 1  # only the recent nearby detection qualifies
    assert len(cells) >= 1
    assert latlon_to_cell(lat, lon, lat_grid, lon_grid) in cells


@pytest.mark.asyncio
async def test_find_ignition_cells_falls_back_to_clicked_point_when_firms_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    lat, lon = 41.70, 2.10
    lat_grid, lon_grid = make_grid(lat, lon, 61, 100.0)
    monkeypatch.setattr(spread, "get_firms_service", lambda: _FakeFirmsService(error=FirmsUnavailableError("down")))

    cells, used = await find_ignition_cells(lat, lon, lat_grid, lon_grid)

    assert used == 1
    assert cells == [latlon_to_cell(lat, lon, lat_grid, lon_grid)]


@respx.mock
@pytest.mark.asyncio
async def test_simulate_spread_returns_snapshot_per_hour(monkeypatch: pytest.MonkeyPatch) -> None:
    respx.get(WEATHER_URL).mock(
        return_value=Response(
            200,
            json={
                "hourly": {
                    "time": [f"2026-09-19T{hour:02d}:00" for hour in range(12)],
                    "temperature_2m": [32.0] * 12,
                    "relative_humidity_2m": [15.0] * 12,
                    "precipitation": [0.0] * 12,
                    "wind_speed_10m": [30.0] * 12,
                    "wind_direction_10m": [270.0] * 12,
                    "wind_gusts_10m": [35.0] * 12,
                }
            },
        )
    )
    def _elevation_response(request):
        count = len(request.url.params.get("latitude", "").split(",")) if request.url.params.get("latitude") else 0
        return Response(200, json={"elevation": [100] * count})

    respx.get(ELEVATION_URL).mock(side_effect=_elevation_response)

    async def fake_worldcover(points: list[tuple[float, float]]) -> list[int]:
        return [30] * len(points)  # grassland everywhere

    monkeypatch.setattr(spread, "sample_worldcover_classes", fake_worldcover)
    monkeypatch.setattr(spread, "get_firms_service", lambda: _FakeFirmsService(error=FirmsUnavailableError("down")))

    result = await simulate_spread(lat=41.70, lon=2.10, max_hours=3)

    assert result.terrain_source == "open-meteo-dem"
    assert result.fuel_source == "esa-worldcover"
    assert len(result.ignition_points) == 1
    assert len(result.snapshots) == 4
    # Hour 0 is just the ignition cell's own ~120 m footprint, not zero: a
    # single burned pixel still has a real (small) rasterized extent.
    assert result.snapshots[0].radius_km_max < 0.1
    radii = [snapshot.radius_km_max for snapshot in result.snapshots]
    assert radii == sorted(radii)
    assert radii[-1] > radii[0]
    assert any(len(snapshot.rings) > 0 for snapshot in result.snapshots[1:])


@respx.mock
@pytest.mark.asyncio
async def test_simulate_spread_falls_back_when_worldcover_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
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

    async def failing_worldcover(points: list[tuple[float, float]]) -> list[int]:
        raise OSError("no network")

    monkeypatch.setattr(spread, "sample_worldcover_classes", failing_worldcover)
    monkeypatch.setattr(spread, "get_firms_service", lambda: _FakeFirmsService(error=FirmsUnavailableError("down")))

    result = await simulate_spread(lat=41.70, lon=2.10, max_hours=2)

    assert result.terrain_source == "flat-fallback"
    assert result.fuel_source == "fallback-grass"
    assert len(result.snapshots) == 3
    assert result.snapshots[-1].radius_km_max > 0.0
