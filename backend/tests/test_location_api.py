import respx
from fastapi.testclient import TestClient
from httpx import Response

from app.core.config import Settings
from app.main import app
from app.services.location import LocationService, get_location_service


def test_reverse_location_uses_nominatim_and_caches(client: TestClient) -> None:
    service = LocationService(Settings(nominatim_base_url="https://nominatim.example"))
    app.dependency_overrides[get_location_service] = lambda: service
    try:
      with respx.mock(assert_all_called=True) as mock:
          upstream = mock.get("https://nominatim.example/reverse").mock(
              return_value=Response(
                  200,
                  json={
                      "display_name": "Valle del Tajo, Cáceres, España",
                      "address": {
                          "village": "Valle del Tajo",
                          "municipality": "Cáceres",
                          "country": "España",
                      },
                  },
              )
          )
          first = client.get("/api/location/reverse?lat=40.7341&lon=-86.436")
          second = client.get("/api/location/reverse?lat=40.7341&lon=-86.436")
    finally:
        app.dependency_overrides.clear()

    assert first.status_code == 200
    assert first.json()["label"] == "Valle del Tajo, Cáceres"
    assert first.json()["coordinates"] == "40.7341, -86.4360"
    assert second.status_code == 200
    assert upstream.call_count == 1
    assert "PYROS" in upstream.calls[0].request.headers["user-agent"]
