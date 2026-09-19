from fastapi.testclient import TestClient


def test_health_is_available(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert response.json()["configured_model"]


def test_simulate_rejects_invalid_humidity(
    client: TestClient, valid_scenario: dict[str, object]
) -> None:
    response = client.post("/api/simulate", json={**valid_scenario, "humidity": 101})
    assert response.status_code == 422


def test_simulate_returns_ranked_assets(
    client: TestClient, valid_scenario: dict[str, object]
) -> None:
    response = client.post("/api/simulate", json=valid_scenario)
    assert response.status_code == 200
    probabilities = [item["probability"] for item in response.json()["assets"]]
    assert probabilities == sorted(probabilities, reverse=True)


def test_unknown_api_route_is_json_404(client: TestClient) -> None:
    response = client.get("/api/missing")
    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}

