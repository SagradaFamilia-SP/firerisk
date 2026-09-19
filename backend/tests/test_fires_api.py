from datetime import UTC, datetime

import respx
from fastapi.testclient import TestClient
from httpx import Response

from app.core.config import Settings
from app.main import app
from app.schemas.fires import FireMeta, FireResponse
from app.services.firms import FirmsService, get_firms_service


class FakeFirmsService:
    async def fetch_detections(self, query):  # noqa: ANN001, ANN201
        return FireResponse(
            detections=[],
            meta=FireMeta(
                sources=query.sources,
                requested_hours=query.hours,
                fetched_at=datetime(2026, 9, 19, 15, tzinfo=UTC),
                latest_acquisition=None,
                count=0,
            ),
        )


def test_fires_endpoint_parses_viewport_filters(client: TestClient) -> None:
    app.dependency_overrides[get_firms_service] = lambda: FakeFirmsService()
    try:
        response = client.get(
            "/api/fires",
            params={
                "west": -7,
                "south": 39,
                "east": -5,
                "north": 41,
                "hours": 48,
                "sources": "NOAA20",
                "min_confidence": "nominal",
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["meta"]["sources"] == ["VIIRS_NOAA20_NRT"]
    assert response.json()["meta"]["requested_hours"] == 48


def test_fires_endpoint_rejects_invalid_bounds(client: TestClient) -> None:
    response = client.get(
        "/api/fires",
        params={"west": -7, "south": 42, "east": -5, "north": 41},
    )
    assert response.status_code == 422


def test_wms_rejects_unapproved_layer_before_upstream(client: TestClient) -> None:
    response = client.get(
        "/api/fires/wms",
        params={
            "service": "WMS",
            "request": "GetMap",
            "version": "1.1.1",
            "layers": "private_layer",
            "format": "image/png",
            "transparent": "true",
            "width": 256,
            "height": 256,
            "bbox": "-7,39,-5,41",
            "srs": "EPSG:4326",
        },
    )
    assert response.status_code == 422


def test_wms_is_proxied_and_cached_without_exposing_key() -> None:
    secret = "server-only-secret"
    service = FirmsService(
        Settings(nasa_firms_map_key=secret, firms_base_url="https://firms.example")
    )
    app.dependency_overrides[get_firms_service] = lambda: service
    params = {
        "service": "WMS",
        "request": "GetMap",
        "version": "1.1.1",
        "layers": "fires_viirs_noaa20_24,fires_viirs_noaa21_24",
        "styles": "",
        "format": "image/png",
        "transparent": "true",
        "width": 256,
        "height": 256,
        "bbox": "-7,39,-5,41",
        "srs": "EPSG:4326",
    }
    try:
        with respx.mock(assert_all_called=True) as mock:
            upstream = mock.get(
                f"https://firms.example/mapserver/wms/fires/{secret}/"
            ).mock(return_value=Response(200, content=b"png-data", headers={"content-type": "image/png"}))
            with TestClient(app) as test_client:
                first = test_client.get("/api/fires/wms", params=params)
                second = test_client.get("/api/fires/wms", params=params)
    finally:
        app.dependency_overrides.clear()

    assert first.status_code == 200
    assert first.content == b"png-data"
    assert first.headers["content-type"].startswith("image/png")
    assert "max-age=900" in first.headers["cache-control"]
    assert second.status_code == 200
    assert upstream.call_count == 1
    assert secret not in first.text


def test_firms_upstream_failure_has_safe_error_message() -> None:
    secret = "never-leak-me"
    service = FirmsService(
        Settings(nasa_firms_map_key=secret, firms_base_url="https://firms.example")
    )
    app.dependency_overrides[get_firms_service] = lambda: service
    try:
        with respx.mock(assert_all_called=True) as mock:
            mock.get(url__regex=r"https://firms\.example/api/area/csv/.*").mock(
                return_value=Response(500, text=f"upstream rejected key {secret}")
            )
            with TestClient(app) as test_client:
                response = test_client.get(
                    "/api/fires",
                    params={"west": -7, "south": 39, "east": -5, "north": 41},
                )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 502
    assert secret not in response.text
    assert "NASA FIRMS" in response.json()["detail"]
