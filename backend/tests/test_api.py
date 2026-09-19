from fastapi.testclient import TestClient


def test_health_is_available(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert response.json()["configured_model"]


def test_unknown_api_route_is_json_404(client: TestClient) -> None:
    response = client.get("/api/missing")
    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}
