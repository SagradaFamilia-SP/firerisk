"""
Wildfire surface-spread estimator.

Ports the physics and propagation strategy from tests/ROS.py onto a bounded
grid around the requested ignition point, sized for interactive web use:
- Real hourly wind/humidity/temperature/precipitation (Open-Meteo forecast),
  applied uniformly across the grid and over time (matching the reference).
- Real elevation (Copernicus GLO-90 via Open-Meteo), sampled on a coarse
  stride and bilinearly interpolated to the full grid, giving slope/aspect
  that genuinely vary across the domain rather than one constant estimate.
- Real ESA WorldCover 2021 v200 (10 m land cover) sampled at every grid
  cell, crosswalked to Anderson-style surface fuel models.
- Real nearby NASA FIRMS detections (when configured) used to seed multiple
  ignition cells, not just the single clicked point.
- Rate of spread from the Rothermel (1972) surface-fire equation, evaluated
  per grid edge and propagated with a multi-source Dijkstra search, so the
  fire front is a genuine 2D perimeter that can wrap around obstacles and
  merge from multiple ignitions, instead of 36 independent rays.

This is an experimental research/prototyping tool, not an operational
wildfire model. It does not model crown fire, spotting/embers, fire
suppression, or barriers such as roads and firebreaks, and must not be used
for evacuation, emergency response, or life-safety decisions.
"""

import asyncio
import heapq
import math
from dataclasses import dataclass, replace
from datetime import timedelta

import httpx
import numpy as np
import rasterio
from rasterio.errors import RasterioIOError
from skimage import measure

from app.schemas.fires import FireQuery
from app.schemas.spread import SpreadPoint, SpreadResponse, SpreadSnapshot, WeatherSample
from app.services.cache import TTLCache
from app.services.firms import FirmsNotConfiguredError, FirmsUnavailableError, get_firms_service

WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
ELEVATION_URL = "https://api.open-meteo.com/v1/elevation"
WORLDCOVER_URL_PREFIX = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map"
WORLDCOVER_FILENAME = "ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"
WORLDCOVER_ENV = {
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
    "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif",
    "GDAL_HTTP_MAX_RETRY": "4",
    "GDAL_HTTP_RETRY_DELAY": "2",
}

EARTH_RADIUS_M = 6_371_000.0

# 121x121 cells at 120 m => ~7.2 km half-width, ~14.4 km across. Large enough
# for a multi-hour surface fire under real Rothermel ROS, small enough that
# WorldCover sampling (~1s warm) and DEM fetch (~0.4s) stay interactive.
GRID_SIZE = 121
CELL_SIZE_M = 120.0
DEM_STRIDE = 6

FIRMS_SEED_RADIUS_KM = 5.0
FIRMS_RECENT_HOURS = 8.0

MAX_ROS_M_MIN = 80.0
MIN_ROS_M_MIN = 0.005

# Byram (1959) fireline intensity: I = H * w * r (kW/m).
# H (heat of combustion) barely varies across forest fuels in practice, so it
# is treated as a constant here, matching standard fire-behaviour practice.
HEAT_OF_COMBUSTION_KJ_KG = 18_600.0
LB_FT2_TO_KG_M2 = 4.882428  # 0.45359237 kg / 0.09290304 m2

# Open-Meteo's free tier is rate-limited per hour/day; caching cuts down on
# repeat calls for the same fire (or nearby ones) instead of hitting it on
# every single click, and lets a stale-but-fresh-enough result keep the
# feature working through a temporary rate-limit window instead of a 502.
WEATHER_CACHE_TTL_SECONDS = 900  # 15 min: forecasts don't meaningfully change faster than this
ELEVATION_CACHE_TTL_SECONDS = 21_600  # 6h: terrain never changes; just bounds cache growth
WEATHER_FORECAST_HOURS = 25  # covers every allowed max_hours (<=24) from a single cached fetch
LOCATION_CACHE_PRECISION = 2  # ~1.1 km buckets: plenty for a regional weather forecast

_weather_cache: TTLCache[list[dict]] = TTLCache(WEATHER_CACHE_TTL_SECONDS)
_elevation_cache: TTLCache[np.ndarray] = TTLCache(ELEVATION_CACHE_TTL_SECONDS)


def _location_cache_key(lat: float, lon: float, precision: int = LOCATION_CACHE_PRECISION) -> str:
    return f"{round(lat, precision):.{precision}f},{round(lon, precision):.{precision}f}"


class SpreadUnavailableError(RuntimeError):
    pass


def _clip(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def angular_diff_deg(a: float, b: float) -> float:
    return abs((a - b + 180.0) % 360.0 - 180.0)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a)) / 1000.0


# =============================================================================
# Grid
# =============================================================================


def meters_per_degree_lat() -> float:
    return 111_320.0


def meters_per_degree_lon(lat: float) -> float:
    return 111_320.0 * math.cos(math.radians(lat))


def make_grid(lat: float, lon: float, grid_size: int, cell_size_m: float) -> tuple[np.ndarray, np.ndarray]:
    """Row 0 is north; rows increase southward."""
    center = (grid_size - 1) / 2.0
    dlat = cell_size_m / meters_per_degree_lat()
    dlon = cell_size_m / meters_per_degree_lon(lat)

    rows = np.arange(grid_size)
    cols = np.arange(grid_size)
    lat_1d = lat - (rows - center) * dlat
    lon_1d = lon + (cols - center) * dlon
    return np.meshgrid(lat_1d, lon_1d, indexing="ij")


def latlon_to_cell(lat: float, lon: float, lat_grid: np.ndarray, lon_grid: np.ndarray) -> tuple[int, int]:
    r = int(np.argmin(np.abs(lat_grid[:, 0] - lat)))
    c = int(np.argmin(np.abs(lon_grid[0, :] - lon)))
    return r, c


def bbox_for_grid(lat_grid: np.ndarray, lon_grid: np.ndarray) -> tuple[float, float, float, float]:
    return (
        float(np.min(lon_grid)),
        float(np.min(lat_grid)),
        float(np.max(lon_grid)),
        float(np.max(lat_grid)),
    )


def fractional_index_to_latlon(row: float, col: float, lat_grid: np.ndarray, lon_grid: np.ndarray) -> tuple[float, float]:
    rows, cols = lat_grid.shape
    row = float(np.clip(row, 0, rows - 1))
    col = float(np.clip(col, 0, cols - 1))
    r0, r1 = int(math.floor(row)), min(int(math.floor(row)) + 1, rows - 1)
    c0, c1 = int(math.floor(col)), min(int(math.floor(col)) + 1, cols - 1)
    fr, fc = row - r0, col - c0
    lat = (1 - fr) * lat_grid[r0, 0] + fr * lat_grid[r1, 0]
    lon = (1 - fc) * lon_grid[0, c0] + fc * lon_grid[0, c1]
    return float(lat), float(lon)


# =============================================================================
# Anderson fuel models + ESA WorldCover crosswalk
# =============================================================================


@dataclass(frozen=True)
class FuelModel:
    """Anderson/NFFL-style fuel model in imperial units, as used by Rothermel."""

    code: str
    name: str
    load_1h_lb_ft2: float
    load_10h_lb_ft2: float
    load_100h_lb_ft2: float
    sav_1h_ft_inv: float
    depth_ft: float
    moisture_extinction: float
    heat_btu_lb: float = 8000.0
    load_scale: float = 1.0


FM1 = FuelModel("FM1", "Short grass", 0.034, 0.000, 0.000, 3500.0, 1.0, 0.12)
FM3 = FuelModel("FM3", "Tall grass", 0.138, 0.000, 0.000, 1500.0, 2.5, 0.25)
FM6 = FuelModel("FM6", "Dormant brush / hardwood slash", 0.069, 0.115, 0.092, 1750.0, 2.5, 0.25)
FM8 = FuelModel("FM8", "Closed timber litter", 0.069, 0.046, 0.115, 2000.0, 0.2, 0.30)


def worldcover_to_fuel_model(class_code: int) -> FuelModel | None:
    """Conservative crosswalk from ESA WorldCover classes to Anderson surface fuel models."""
    code = int(class_code)
    if code == 10:  # trees -> surface litter, not a crown-fire model
        return FM8
    if code == 20:  # shrubland
        return FM6
    if code == 30:  # grassland
        return FM3
    if code == 40:  # cropland / stubble approximation
        return FM1
    if code == 60:  # sparse vegetation
        return replace(FM1, code="FM1-SPARSE", name="Sparse fine fuel", load_scale=0.20)
    if code == 100:  # moss / lichen; conservative weak surface-fuel proxy
        return replace(FM1, code="FM1-MOSS", name="Moss/lichen proxy", load_scale=0.35)
    # Built-up, snow/ice, water, wetland, mangroves => non-burnable here.
    return None


def build_fuel_grid(worldcover: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    fuel_models = np.empty(worldcover.shape, dtype=object)
    burnable = np.zeros(worldcover.shape, dtype=bool)
    for index in np.ndindex(worldcover.shape):
        fm = worldcover_to_fuel_model(int(worldcover[index]))
        fuel_models[index] = fm
        burnable[index] = fm is not None
    return fuel_models, burnable


def fuel_load_kg_m2(fm: FuelModel) -> float:
    """
    Fuel available to the flaming front (kg/m2), for Byram's intensity.

    Assumes the modelled dead-fuel bed (1h+10h+100h loads) is fully consumed
    in the flaming front, the standard simplification used whenever a
    dedicated combustion/consumption sub-model isn't available (Byram 1959,
    and how BehavePlus-style tools report fireline intensity by default).
    """
    total_lb_ft2 = (fm.load_1h_lb_ft2 + fm.load_10h_lb_ft2 + fm.load_100h_lb_ft2) * fm.load_scale
    return total_lb_ft2 * LB_FT2_TO_KG_M2


def fireline_intensity_kw_m(fuel_load_kg_m2_value: float, ros_m_min: float) -> float:
    """Byram (1959): I = H * w * r, with r converted from m/min to m/s so I comes out in kW/m."""
    ros_m_s = max(ros_m_min, 0.0) / 60.0
    return HEAT_OF_COMBUSTION_KJ_KG * fuel_load_kg_m2_value * ros_m_s


# =============================================================================
# Fuel moisture + Rothermel (1972)
# =============================================================================


def estimate_dead_fuel_moisture(temp_c: float, rh_pct: float, precip_mm: float) -> float:
    """Equilibrium-moisture approximation for fine dead fuel, plus a rain-wetting term."""
    rh = _clip(rh_pct, 1.0, 100.0)
    t_f = temp_c * 9.0 / 5.0 + 32.0

    if rh < 10:
        emc_pct = 0.03229 + 0.281073 * rh - 0.000578 * rh * t_f
    elif rh <= 50:
        emc_pct = 2.22749 + 0.160107 * rh - 0.014784 * t_f
    else:
        emc_pct = 21.0606 + 0.005565 * rh * rh - 0.00035 * rh * t_f - 0.483199 * rh

    if precip_mm > 0:
        emc_pct += min(25.0, 12.0 * precip_mm)

    return _clip(emc_pct / 100.0, 0.01, 0.50)


def _rothermel_components(
    fm: FuelModel, dead_moisture: float, wind_speed_m_s: float, slope_deg: float
) -> tuple[float, float, float]:
    """Return R0_ft_min (no-wind/no-slope ROS), phi_w and phi_s for a dead-fuel Anderson model."""
    loads = np.array(
        [fm.load_1h_lb_ft2, fm.load_10h_lb_ft2, fm.load_100h_lb_ft2], dtype=float
    ) * fm.load_scale
    if np.sum(loads) <= 0:
        return 0.0, 0.0, 0.0

    sav = np.array([fm.sav_1h_ft_inv, 109.0, 30.0], dtype=float)
    rho_p = 32.0  # lb/ft3
    total_mineral = 0.0555
    effective_mineral = 0.01

    area = loads * sav / rho_p
    area_sum = float(np.sum(area))
    f = area / area_sum
    sigma = float(np.sum(f * sav))

    moistures = np.array(
        [dead_moisture, min(0.60, dead_moisture * 1.15 + 0.005), min(0.60, dead_moisture * 1.30 + 0.010)]
    )
    mf = float(np.sum(f * moistures))

    mx = fm.moisture_extinction
    if mf >= mx:
        return 0.0, 0.0, 0.0

    w0 = float(np.sum(loads))
    rho_b = w0 / fm.depth_ft
    beta = rho_b / rho_p
    beta_op = 3.348 * sigma ** (-0.8189)
    if beta <= 0 or beta_op <= 0:
        return 0.0, 0.0, 0.0

    a_const = 133.0 * sigma ** (-0.7913)
    sigma15 = sigma ** 1.5
    gamma_max = sigma15 / (495.0 + 0.0594 * sigma15)
    beta_ratio = beta / beta_op
    gamma = gamma_max * (beta_ratio ** a_const) * math.exp(a_const * (1.0 - beta_ratio))

    r_m = _clip(mf / mx, 0.0, 1.0)
    eta_m = max(0.0, 1.0 - 2.59 * r_m + 5.11 * r_m ** 2 - 3.52 * r_m ** 3)
    eta_s = 0.174 * effective_mineral ** (-0.19)

    net_load = w0 * (1.0 - total_mineral)
    reaction_intensity = gamma * net_load * fm.heat_btu_lb * eta_m * eta_s

    xi = math.exp((0.792 + 0.681 * math.sqrt(sigma)) * (beta + 0.1)) / (192.0 + 0.2595 * sigma)
    epsilon = math.exp(-138.0 / sigma)
    q_ig = 250.0 + 1116.0 * mf

    denominator = rho_b * epsilon * q_ig
    if denominator <= 0:
        return 0.0, 0.0, 0.0

    r0 = reaction_intensity * xi / denominator

    # Wind coefficient; 10 m wind converted to midflame with a 0.4 adjustment factor.
    midflame_ft_min = max(0.0, wind_speed_m_s * 196.850394 * 0.40)
    c_const = 7.47 * math.exp(-0.133 * sigma ** 0.55)
    b_const = 0.02526 * sigma ** 0.54
    e_const = 0.715 * math.exp(-3.59e-4 * sigma)
    phi_w = c_const * (midflame_ft_min ** b_const if midflame_ft_min > 0 else 0.0) * beta_ratio ** (-e_const)

    slope_rad = math.radians(_clip(slope_deg, 0.0, 60.0))
    phi_s = 5.275 * beta ** (-0.3) * math.tan(slope_rad) ** 2

    return max(0.0, r0), max(0.0, phi_w), max(0.0, phi_s)


def directional_ros(
    fuel_model: FuelModel | None,
    dead_moisture: float,
    wind_speed_m_s: float,
    wind_from_deg: float,
    slope_deg: float,
    upslope_bearing_deg: float,
    spread_bearing_deg: float,
) -> float:
    """
    Directional ROS (m/min) around the Rothermel no-wind/no-slope solution.

    phi_w and phi_s are computed physically then projected onto the requested
    spread direction via the angular alignment with the downwind/upslope
    bearings, following the same directional extension as the reference
    grid model.
    """
    if fuel_model is None:
        return 0.0

    r0, phi_w, phi_s = _rothermel_components(fuel_model, dead_moisture, wind_speed_m_s, slope_deg)
    if r0 <= 0:
        return 0.0

    downwind = (wind_from_deg + 180.0) % 360.0
    cw = math.cos(math.radians(angular_diff_deg(spread_bearing_deg, downwind)))
    cs = math.cos(math.radians(angular_diff_deg(spread_bearing_deg, upslope_bearing_deg)))

    multiplier = max(0.05, 1.0 + phi_w * cw + phi_s * cs)  # backing fire still creeps
    return r0 * multiplier * 0.3048


# =============================================================================
# Terrain (Open-Meteo elevation, coarse + interpolated)
# =============================================================================


def _interp2_regular(coarse: np.ndarray, out_rows: int, out_cols: int) -> np.ndarray:
    cr, cc = coarse.shape
    src_x = np.linspace(0.0, 1.0, cc)
    dst_x = np.linspace(0.0, 1.0, out_cols)
    temp = np.vstack([np.interp(dst_x, src_x, row) for row in coarse])
    src_y = np.linspace(0.0, 1.0, cr)
    dst_y = np.linspace(0.0, 1.0, out_rows)
    out = np.empty((out_rows, out_cols), dtype=float)
    for c in range(out_cols):
        out[:, c] = np.interp(dst_y, src_y, temp[:, c])
    return out


async def fetch_elevation_grid(lat_grid: np.ndarray, lon_grid: np.ndarray) -> tuple[np.ndarray, str]:
    rows, cols = lat_grid.shape
    center_lat, center_lon = float(lat_grid[rows // 2, cols // 2]), float(lon_grid[rows // 2, cols // 2])
    # A finer bucket (~111 m) than weather's, since terrain genuinely varies
    # over shorter distances and this grid's exact centre matters for slope.
    cache_key = _location_cache_key(center_lat, center_lon, precision=3)
    if (cached := _elevation_cache.get_fresh(cache_key)) is not None:
        return cached, "open-meteo-dem"

    row_idx = list(range(0, rows, DEM_STRIDE))
    col_idx = list(range(0, cols, DEM_STRIDE))
    if row_idx[-1] != rows - 1:
        row_idx.append(rows - 1)
    if col_idx[-1] != cols - 1:
        col_idx.append(cols - 1)

    coarse_lat = lat_grid[np.ix_(row_idx, col_idx)]
    coarse_lon = lon_grid[np.ix_(row_idx, col_idx)]
    lats = coarse_lat.ravel()
    lons = coarse_lon.ravel()

    try:
        elevations: list[float] = []
        batch_size = 100
        async with httpx.AsyncClient(timeout=15.0) as client:
            for start in range(0, len(lats), batch_size):
                end = min(start + batch_size, len(lats))
                params = {
                    "latitude": ",".join(f"{x:.6f}" for x in lats[start:end]),
                    "longitude": ",".join(f"{x:.6f}" for x in lons[start:end]),
                }
                response = await client.get(ELEVATION_URL, params=params)
                response.raise_for_status()
                elevations.extend(float(x) for x in response.json()["elevation"])

        coarse_dem = np.asarray(elevations, dtype=float).reshape(coarse_lat.shape)
        elevation = _interp2_regular(coarse_dem, rows, cols)
        _elevation_cache.set(cache_key, elevation)
        return elevation, "open-meteo-dem"
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        if (stale := _elevation_cache.get_any(cache_key)) is not None:
            return stale, "open-meteo-dem"
        return np.zeros((rows, cols), dtype=float), "flat-fallback"


def terrain_from_dem(elevation: np.ndarray, cell_size_m: float) -> tuple[np.ndarray, np.ndarray]:
    dz_drow, dz_dcol = np.gradient(elevation, cell_size_m, cell_size_m)
    dz_north = -dz_drow
    dz_east = dz_dcol
    slope_deg = np.degrees(np.arctan(np.hypot(dz_north, dz_east)))
    upslope_bearing = (np.degrees(np.arctan2(dz_east, dz_north)) + 360.0) % 360.0
    return slope_deg, upslope_bearing


# =============================================================================
# ESA WorldCover sampling
# =============================================================================


def _fmt_lat(v: int) -> str:
    return ("N" if v >= 0 else "S") + f"{abs(v):02d}"


def _fmt_lon(v: int) -> str:
    return ("E" if v >= 0 else "W") + f"{abs(v):03d}"


def worldcover_tile_id(lat: float, lon: float) -> str:
    lat0 = math.floor(lat / 3.0) * 3
    lon0 = math.floor(lon / 3.0) * 3
    return f"{_fmt_lat(int(lat0))}{_fmt_lon(int(lon0))}"


def worldcover_tile_url(tile: str) -> str:
    return f"{WORLDCOVER_URL_PREFIX}/{WORLDCOVER_FILENAME.format(tile=tile)}"


# Open COG handles are cached for the process lifetime: opening one over HTTP
# costs several seconds (header/IFD read), while re-sampling an already-open
# dataset is near-instant. A demo session realistically touches a handful of
# 3x3 degree tiles, so this never grows unbounded in practice.
_worldcover_datasets: dict[str, "rasterio.io.DatasetReader"] = {}


def _open_worldcover_tile(tile: str) -> "rasterio.io.DatasetReader":
    dataset = _worldcover_datasets.get(tile)
    if dataset is not None:
        return dataset
    with rasterio.Env(**WORLDCOVER_ENV):
        dataset = rasterio.open(f"/vsicurl/{worldcover_tile_url(tile)}")
    _worldcover_datasets[tile] = dataset
    return dataset


def _sample_worldcover_sync(points: list[tuple[float, float]]) -> list[int]:
    by_tile: dict[str, list[int]] = {}
    for index, (lat, lon) in enumerate(points):
        by_tile.setdefault(worldcover_tile_id(lat, lon), []).append(index)

    values = [0] * len(points)
    with rasterio.Env(**WORLDCOVER_ENV):
        for tile, indexes in by_tile.items():
            dataset = _open_worldcover_tile(tile)
            coords = [(points[i][1], points[i][0]) for i in indexes]  # (lon, lat)
            sampled = [int(value[0]) for value in dataset.sample(coords, indexes=1)]
            for i, value in zip(indexes, sampled):
                values[i] = value
    return values


async def sample_worldcover_classes(points: list[tuple[float, float]]) -> list[int]:
    return await asyncio.to_thread(_sample_worldcover_sync, points)


async def fetch_worldcover_grid(lat_grid: np.ndarray, lon_grid: np.ndarray) -> tuple[np.ndarray, str]:
    rows, cols = lat_grid.shape
    points = [(float(lat_grid[r, c]), float(lon_grid[r, c])) for r in range(rows) for c in range(cols)]
    try:
        classes = await sample_worldcover_classes(points)
        return np.array(classes, dtype=np.uint8).reshape(rows, cols), "esa-worldcover"
    except (RasterioIOError, OSError, ValueError, IndexError):
        return np.full((rows, cols), 30, dtype=np.uint8), "fallback-grass"  # treat as grassland


# =============================================================================
# Weather (Open-Meteo forecast, single point applied across the grid)
# =============================================================================


async def fetch_hourly_weather(lat: float, lon: float) -> list[dict]:
    cache_key = _location_cache_key(lat, lon)
    if cached := _weather_cache.get_fresh(cache_key):
        return cached

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
        "forecast_hours": WEATHER_FORECAST_HOURS,
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
        _weather_cache.set(cache_key, result)
        return result
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        if stale := _weather_cache.get_any(cache_key):
            return stale
        raise SpreadUnavailableError("Meteorología no disponible") from exc


# =============================================================================
# NASA FIRMS multi-point ignition seeding
# =============================================================================


async def find_ignition_cells(
    lat: float, lon: float, lat_grid: np.ndarray, lon_grid: np.ndarray
) -> tuple[list[tuple[int, int]], int]:
    """
    Seed ignition with every recent, nearby FIRMS detection, not just the
    clicked point, so the starting fire front reflects the real extent of
    the hotspot cluster instead of a single pixel.
    """
    primary_cell = latlon_to_cell(lat, lon, lat_grid, lon_grid)
    west, south, east, north = bbox_for_grid(lat_grid, lon_grid)

    try:
        service = get_firms_service()
        query = FireQuery(
            west=west,
            south=south,
            east=east,
            north=north,
            hours=24,
            min_confidence="nominal",
        )
        response = await service.fetch_detections(query)
    except (FirmsNotConfiguredError, FirmsUnavailableError):
        return [primary_cell], 1

    candidates = [
        detection
        for detection in response.detections
        if haversine_km(lat, lon, detection.latitude, detection.longitude) <= FIRMS_SEED_RADIUS_KM
    ]
    if not candidates:
        return [primary_cell], 1

    latest = max(detection.acquired_at for detection in candidates)
    recent = [
        detection
        for detection in candidates
        if latest - detection.acquired_at <= timedelta(hours=FIRMS_RECENT_HOURS)
    ]

    cells = {latlon_to_cell(d.latitude, d.longitude, lat_grid, lon_grid) for d in recent}
    cells.add(primary_cell)
    return sorted(cells), len(recent)


# =============================================================================
# Grid propagation (multi-source Dijkstra)
# =============================================================================

NEIGHBORS: tuple[tuple[int, int], ...] = (
    (-1, 0), (-1, 1), (0, 1), (1, 1),
    (1, 0), (1, -1), (0, -1), (-1, -1),
)


def neighbor_bearing(dr: int, dc: int) -> float:
    north = -dr
    east = dc
    return (math.degrees(math.atan2(east, north)) + 360.0) % 360.0


def simulate_grid(
    weather: list[dict],
    fuel_models: np.ndarray,
    burnable: np.ndarray,
    slope: np.ndarray,
    upslope_bearing: np.ndarray,
    ignition_cells: list[tuple[int, int]],
    cell_size_m: float,
    max_hours: int,
) -> tuple[np.ndarray, np.ndarray]:
    """Returns (arrival_time_minutes, ros_m_min_at_arrival): the ROS that actually caused
    each cell to ignite, reused for fireline intensity (Byram) alongside the ROS itself."""
    rows, cols = burnable.shape
    max_time = max_hours * 60.0
    arrival = np.full((rows, cols), np.inf, dtype=float)
    ros_at_arrival = np.full((rows, cols), np.nan, dtype=float)
    queue: list[tuple[float, int, int]] = []

    for r, c in ignition_cells:
        arrival[r, c] = 0.0
        heapq.heappush(queue, (0.0, r, c))

    while queue:
        current_time, r, c = heapq.heappop(queue)
        if current_time != arrival[r, c] or current_time >= max_time:
            continue

        weather_idx = min(int(current_time // 60), len(weather) - 1)
        w = weather[weather_idx]
        dead_moisture = estimate_dead_fuel_moisture(w["temperature_c"], w["rh_pct"], w["precip_mm"])
        wind_speed_m_s = w["wind_kmh"] / 3.6

        for dr, dc in NEIGHBORS:
            nr, nc = r + dr, c + dc
            if not (0 <= nr < rows and 0 <= nc < cols):
                continue
            if not burnable[nr, nc]:
                continue

            bearing = neighbor_bearing(dr, dc)
            local_slope = 0.5 * (float(slope[r, c]) + float(slope[nr, nc]))
            ros = directional_ros(
                fuel_model=fuel_models[nr, nc],
                dead_moisture=dead_moisture,
                wind_speed_m_s=wind_speed_m_s,
                wind_from_deg=w["wind_from_deg"],
                slope_deg=local_slope,
                upslope_bearing_deg=float(upslope_bearing[r, c]),
                spread_bearing_deg=bearing,
            )
            ros = _clip(ros, MIN_ROS_M_MIN, MAX_ROS_M_MIN) if ros > 0 else 0.0
            if ros <= 0:
                continue

            distance_m = cell_size_m * (math.sqrt(2.0) if dr and dc else 1.0)
            new_time = current_time + distance_m / ros
            if new_time < arrival[nr, nc] and new_time <= max_time:
                arrival[nr, nc] = new_time
                ros_at_arrival[nr, nc] = ros
                heapq.heappush(queue, (new_time, nr, nc))

    return arrival, ros_at_arrival


# =============================================================================
# Snapshots (contour extraction + stats)
# =============================================================================


def _cell_area_km2(cell_size_m: float) -> float:
    return (cell_size_m * cell_size_m) / 1_000_000.0


def _ring_from_contour(contour: np.ndarray, lat_grid: np.ndarray, lon_grid: np.ndarray) -> list[SpreadPoint] | None:
    if len(contour) < 4:
        return None
    ring = [SpreadPoint(lat=lat, lon=lon) for lat, lon in (
        fractional_index_to_latlon(row, col, lat_grid, lon_grid) for row, col in contour
    )]
    return ring


def build_snapshots(
    arrival: np.ndarray,
    ros_at_arrival: np.ndarray,
    fuel_models: np.ndarray,
    lat_grid: np.ndarray,
    lon_grid: np.ndarray,
    center_lat: float,
    center_lon: float,
    cell_size_m: float,
    max_hours: int,
) -> list[SpreadSnapshot]:
    snapshots: list[SpreadSnapshot] = []
    cell_area_km2 = _cell_area_km2(cell_size_m)

    # Fireline intensity (Byram 1959: I = H * w * r) for every cell, using the
    # real ROS that actually ignited it (captured by simulate_grid) and the
    # fuel load of its own Anderson model. Cells never reached keep ros=NaN.
    fuel_load_grid = np.zeros(fuel_models.shape, dtype=float)
    for index in np.ndindex(fuel_models.shape):
        fm = fuel_models[index]
        if fm is not None:
            fuel_load_grid[index] = fuel_load_kg_m2(fm)
    intensity_grid = HEAT_OF_COMBUSTION_KJ_KG * fuel_load_grid * (np.nan_to_num(ros_at_arrival, nan=0.0) / 60.0)

    previous_threshold = -1.0
    for hour in range(max_hours + 1):
        threshold = hour * 60.0
        mask = np.isfinite(arrival) & (arrival <= threshold)
        burned_cells = int(np.count_nonzero(mask))
        area_km2 = burned_cells * cell_area_km2

        rings: list[list[SpreadPoint]] = []
        if burned_cells > 0:
            for contour in measure.find_contours(mask.astype(float), 0.5):
                ring = _ring_from_contour(contour, lat_grid, lon_grid)
                if ring:
                    rings.append(ring)

        if rings:
            radii_km = [
                haversine_km(center_lat, center_lon, point.lat, point.lon)
                for ring in rings
                for point in ring
            ]
            radius_min, radius_max = min(radii_km), max(radii_km)
            radius_mean = sum(radii_km) / len(radii_km)
        else:
            radius_min = radius_max = radius_mean = 0.0

        # Only the cells that ignited *during this hour's window* represent the
        # active flaming front right now; already-burned interior cells (or a
        # still-unreached hour 0) are excluded rather than diluting the stats.
        newly_burned = mask & (arrival > previous_threshold) & np.isfinite(ros_at_arrival)
        if np.any(newly_burned):
            front_intensities = intensity_grid[newly_burned]
            intensity_min = float(front_intensities.min())
            intensity_mean = float(front_intensities.mean())
            intensity_max = float(front_intensities.max())
        else:
            intensity_min = intensity_mean = intensity_max = 0.0

        snapshots.append(
            SpreadSnapshot(
                hour=hour,
                radius_km_min=round(radius_min, 3),
                radius_km_max=round(radius_max, 3),
                radius_km_mean=round(radius_mean, 3),
                area_km2=round(area_km2, 3),
                rings=rings,
                intensity_kw_m_min=round(intensity_min, 1),
                intensity_kw_m_mean=round(intensity_mean, 1),
                intensity_kw_m_max=round(intensity_max, 1),
            )
        )
        previous_threshold = threshold

    return snapshots


def _build_model_notes(terrain_source: str, fuel_source: str, firms_detections_used: int) -> list[str]:
    notes = [
        "Cada celda de ignición se trata siempre como combustible, incluida la clicada (FIRMS puede "
        "caer sobre un píxel de carretera/edificio/agua por su huella de sensor); el resto de la "
        f"rejilla ({GRID_SIZE}x{GRID_SIZE} celdas de {CELL_SIZE_M:g} m, ±{GRID_SIZE // 2 * CELL_SIZE_M / 1000:.1f} km) "
        "usa la clasificación real de ESA WorldCover.",
        "La pendiente y orientación del terreno provienen de una rejilla de elevación real "
        f"(Open-Meteo/Copernicus), muestreada cada {DEM_STRIDE} celdas e interpolada, por lo que "
        "varían con la posición en todo el dominio, no son un valor único.",
        "La propagación es una búsqueda multi-origen (Dijkstra) sobre la rejilla 8-conectada: el "
        "frente puede rodear obstáculos no combustibles y fusionar varios puntos de ignición, no "
        "son rayos independientes por rumbo.",
        f"{firms_detections_used} detección(es) NASA FIRMS reciente(s) y cercana(s) al punto clicado "
        "se usaron como semillas de ignición adicionales, además del punto clicado.",
        "La humedad del combustible fino muerto se estima a partir de temperatura/humedad relativa "
        "(aproximación de humedad de equilibrio); no es una medición real de humedad de combustible.",
        "La potencia radiativa del fuego (FRP) de NASA FIRMS se usa solo para seleccionar detecciones "
        "recientes como semillas; nunca como combustible ni como entrada del ROS.",
        "Si el fuego alcanza el borde de la rejilla antes de la hora solicitada, la propagación se "
        "detiene ahí; el dominio no crece dinámicamente con el viento o las horas pedidas.",
        "No se modela fuego de copa, pavesas/proyección de brasas, cortafuegos, carreteras como "
        "barrera, supresión activa ni retroalimentación fuego-atmósfera.",
        "La intensidad de línea de fuego (kW/m) usa la fórmula de Byram (1959) I = H·w·r, con H "
        "(calor de combustión) constante en 18.600 kJ/kg, w la carga total del modelo de combustible "
        "Anderson de cada celda (se asume consumo completo del combustible fino modelado) y r el ROS "
        "real que encendió esa celda en la simulación; solo se calcula sobre las celdas que se "
        "incendiaron durante cada hora, no sobre todo el área ya quemada.",
    ]
    if terrain_source == "flat-fallback":
        notes.append(
            "No se pudo obtener elevación real (Open-Meteo); se ha asumido terreno llano "
            "(pendiente 0°) para esta simulación."
        )
    if fuel_source == "fallback-grass":
        notes.append(
            "No se pudo obtener ESA WorldCover; se ha asumido pasto corto (FM1) en todo el "
            "dominio como combustible conservador de reserva."
        )
    return notes


async def simulate_spread(lat: float, lon: float, max_hours: int) -> SpreadResponse:
    lat_grid, lon_grid = make_grid(lat, lon, GRID_SIZE, CELL_SIZE_M)

    weather = await fetch_hourly_weather(lat, lon)
    elevation, terrain_source = await fetch_elevation_grid(lat_grid, lon_grid)
    slope, upslope_bearing = terrain_from_dem(elevation, CELL_SIZE_M)
    worldcover, fuel_source = await fetch_worldcover_grid(lat_grid, lon_grid)
    fuel_models, burnable = build_fuel_grid(worldcover)
    ignition_cells, firms_detections_used = await find_ignition_cells(lat, lon, lat_grid, lon_grid)

    # Force every ignition cell to be burnable, regardless of its own
    # WorldCover classification (see _build_model_notes for why).
    for r, c in ignition_cells:
        burnable[r, c] = True
        if fuel_models[r, c] is None:
            fuel_models[r, c] = FM1

    arrival, ros_at_arrival = simulate_grid(
        weather, fuel_models, burnable, slope, upslope_bearing, ignition_cells, CELL_SIZE_M, max_hours
    )
    snapshots = build_snapshots(
        arrival, ros_at_arrival, fuel_models, lat_grid, lon_grid, lat, lon, CELL_SIZE_M, max_hours
    )

    return SpreadResponse(
        center=SpreadPoint(lat=lat, lon=lon),
        max_hours=max_hours,
        terrain_source=terrain_source,
        fuel_source=fuel_source,
        ignition_points=[
            SpreadPoint(lat=float(lat_grid[r, c]), lon=float(lon_grid[r, c])) for r, c in ignition_cells
        ],
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
            "Simulación experimental de propagación superficial (Rothermel 1972) sobre "
            "combustibles derivados de ESA WorldCover, propagada en rejilla real. No modela "
            "fuego de copa, pavesas, cortafuegos ni supresión activa. No usar para decisiones "
            "de emergencia, evacuación o seguridad de vidas."
        ),
        model_notes=_build_model_notes(terrain_source, fuel_source, firms_detections_used),
    )
