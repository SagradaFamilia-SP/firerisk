from app.schemas.simulation import ScenarioInput
from app.services.simulation import propagation_polygon, risk_score, simulate_scenario


VALID_SCENARIO = {
    "hour": 3,
    "wind_speed": 41,
    "wind_direction": 68,
    "temperature": 39,
    "humidity": 14,
    "hotspot_active": True,
    "hotspot_x": 25,
    "hotspot_y": 58,
}


def test_risk_score_is_bounded() -> None:
    assert risk_score(-20, 100, 0, 0, 0) == 0
    assert risk_score(60, 0, 120, 1, 30) == 100


def test_inactive_hotspot_has_no_polygon() -> None:
    scenario = ScenarioInput(**{**VALID_SCENARIO, "hotspot_active": False})
    assert propagation_polygon(scenario) == []


def test_active_hotspot_polygon_stays_inside_percentage_grid() -> None:
    polygon = propagation_polygon(ScenarioInput(**VALID_SCENARIO))
    assert len(polygon) == 6
    assert all(0 <= coordinate <= 100 for point in polygon for coordinate in point)


def test_simulation_orders_assets_by_probability() -> None:
    result = simulate_scenario(ScenarioInput(**VALID_SCENARIO))
    probabilities = [asset.probability for asset in result.assets]
    assert probabilities == sorted(probabilities, reverse=True)
    assert 0 <= result.metrics.territorial_risk <= 100


def test_simulation_reports_no_people_below_exposure_threshold() -> None:
    calm = ScenarioInput(**{**VALID_SCENARIO, "wind_speed": 0, "humidity": 100, "temperature": 0})
    result = simulate_scenario(calm)
    assert result.metrics.people_exposed == 0
