import math

from app.models.assets import ASSETS
from app.schemas.simulation import (
    AffectedAsset,
    DataSource,
    RiskCell,
    ScenarioInput,
    SimulationMetrics,
    SimulationResponse,
)


def risk_score(temp: float, humidity: float, wind: float, fuel: float, slope: float) -> float:
    temp_factor = max(0.0, min(1.0, (temp - 18) / 24))
    dry_factor = max(0.0, min(1.0, (55 - humidity) / 45))
    wind_factor = max(0.0, min(1.0, wind / 55))
    slope_factor = max(0.0, min(1.0, slope / 30))
    score = 100 * (
        0.27 * temp_factor
        + 0.28 * dry_factor
        + 0.25 * wind_factor
        + 0.15 * fuel
        + 0.05 * slope_factor
    )
    return round(max(0.0, min(100.0, score)), 1)


def propagation_polygon(data: ScenarioInput) -> list[list[float]]:
    if not data.hotspot_active:
        return []
    theta = math.radians(data.wind_direction)
    dx, dy = math.sin(theta), -math.cos(theta)
    spread = min(42, 8 + data.wind_speed * 0.65 + data.hour * 0.8)
    width = 7 + data.wind_speed * 0.18
    points = [[data.hotspot_x, data.hotspot_y]]
    for scale, side in ((0.45, -1), (1.0, -1), (1.15, 0), (1.0, 1), (0.45, 1)):
        along = spread * scale
        cross = width * side * (0.35 + scale)
        px = data.hotspot_x + dx * along + (-dy) * cross
        py = data.hotspot_y + dy * along + dx * cross
        points.append([round(max(0, min(100, px)), 2), round(max(0, min(100, py)), 2)])
    return points


def simulate_scenario(data: ScenarioInput) -> SimulationResponse:
    fuels = (0.88, 0.75, 0.55, 0.92, 0.68, 0.82, 0.45, 0.77, 0.95, 0.62, 0.71, 0.86)
    slopes = (8, 16, 4, 22, 12, 17, 3, 10, 26, 7, 13, 19)
    cells = [
        RiskCell(
            id=index,
            risk=risk_score(
                data.temperature + ((index % 4) - 1.5) * 0.7,
                data.humidity + ((index // 4) - 1) * 2,
                data.wind_speed,
                fuel,
                slope,
            ),
            fuel=fuel,
            slope=slope,
        )
        for index, (fuel, slope) in enumerate(zip(fuels, slopes, strict=True))
    ]

    theta = math.radians(data.wind_direction)
    dx, dy = math.sin(theta), -math.cos(theta)
    affected: list[AffectedAsset] = []
    for asset in ASSETS:
        vx, vy = asset["x"] - data.hotspot_x, asset["y"] - data.hotspot_y
        distance = math.hypot(vx, vy)
        alignment = 0 if distance == 0 else max(0, (vx * dx + vy * dy) / distance)
        weather = risk_score(data.temperature, data.humidity, data.wind_speed, 0.82, 12) / 100
        probability = min(
            0.96,
            max(0.01, weather * alignment * max(0, 1 - distance / 58) * asset["criticality"] * 1.6),
        )
        spread_speed_kmh = max(0.15, 0.15 + data.wind_speed * 0.045)
        eta_min = round((distance * 0.35) / spread_speed_kmh * 60) if probability > 0.08 else None
        affected.append(
            AffectedAsset(
                **asset,
                distance_km=round(distance * 0.35, 1),
                probability=round(probability * 100),
                eta_min=eta_min,
            )
        )

    affected.sort(key=lambda item: item.probability, reverse=True)
    top = affected[0]
    metrics = SimulationMetrics(
        territorial_risk=round(sum(cell.risk for cell in cells) / len(cells), 1),
        top_asset=top.name,
        top_probability=top.probability,
        top_eta_min=top.eta_min,
        exposure_eur=round(sum(asset.value_eur * asset.probability / 100 for asset in affected)),
        people_exposed=sum(asset.people for asset in affected if asset.probability >= 25),
    )
    return SimulationResponse(
        cells=cells,
        propagation_polygon=propagation_polygon(data),
        assets=affected,
        metrics=metrics,
        sources=[
            DataSource(name="Meteorología", status="simulada", detail="Temperatura, humedad y viento"),
            DataSource(name="Foco térmico", status="simulado", detail="Compatible con NASA FIRMS / VIIRS"),
            DataSource(name="Vegetación", status="precargada", detail="Combustible por cuadrícula"),
            DataSource(name="Activos", status="cliente", detail="Valor, criticidad y personal"),
        ],
    )
