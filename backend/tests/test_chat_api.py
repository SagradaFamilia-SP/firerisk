from datetime import UTC, datetime

import respx
from fastapi.testclient import TestClient
from httpx import Response

from app.core.config import Settings, get_settings
from app.main import app
from app.schemas.fires import FireDetection, FireMeta, FireResponse
from app.services.firms import get_firms_service


def _detection(id_: str, lat: float, lon: float, frp: float, confidence: str = "nominal") -> FireDetection:
    return FireDetection(
        id=id_,
        latitude=lat,
        longitude=lon,
        acquired_at=datetime(2026, 9, 19, 10, tzinfo=UTC),
        satellite="Suomi NPP",
        instrument="VIIRS",
        source="VIIRS_NOAA20_NRT",
        confidence=confidence,
        brightness=320.0,
        frp=frp,
        daynight="day",
    )


class FakeFirmsService:
    def __init__(self, detections: list[FireDetection]) -> None:
        self._detections = detections

    async def fetch_detections(self, query):  # noqa: ANN001, ANN201
        return FireResponse(
            detections=self._detections,
            meta=FireMeta(
                sources=query.sources,
                requested_hours=query.hours,
                fetched_at=datetime(2026, 9, 19, 12, tzinfo=UTC),
                latest_acquisition=None,
                count=len(self._detections),
            ),
        )


def _override(detections: list[FireDetection]) -> None:
    app.dependency_overrides[get_firms_service] = lambda: FakeFirmsService(detections)
    app.dependency_overrides[get_settings] = lambda: Settings(
        model_base_url="http://fake-model/v1", model_id="test-model"
    )


def test_chat_lists_and_reports_fires_with_fallback_when_model_unavailable() -> None:
    detections = [
        _detection("a", 40.0, -3.7, 45.2, "high"),
        _detection("b", 39.4, -0.4, 12.1, "low"),
    ]
    _override(detections)
    try:
        with respx.mock(assert_all_called=False) as mock:
            mock.post("http://fake-model/v1/chat/completions").mock(return_value=Response(500))
            with TestClient(app) as test_client:
                response = test_client.post("/api/chat", json={"message": "¿Qué incendios tengo en España?"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["region"] == "España"
    assert body["summary"]["narrative_source"] == "fallback"
    assert body["summary"]["count"] == 2
    assert len(body["fires"]) == 2
    assert "España" in body["reply"]


def test_chat_defaults_to_spain_when_no_region_named() -> None:
    _override([])
    try:
        with respx.mock(assert_all_called=False) as mock:
            mock.post("http://fake-model/v1/chat/completions").mock(return_value=Response(500))
            with TestClient(app) as test_client:
                response = test_client.post("/api/chat", json={"message": "hay incendios activos ahora?"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["region"] == "España"
    assert body["summary"]["count"] == 0
    assert body["fires"] == []


def test_chat_uses_model_narrative_when_available() -> None:
    _override([])
    try:
        with respx.mock(assert_all_called=False) as mock:
            mock.post("http://fake-model/v1/chat/completions").mock(
                return_value=Response(
                    200, json={"choices": [{"message": {"content": "Informe generado por el modelo."}}]}
                )
            )
            with TestClient(app) as test_client:
                response = test_client.post("/api/chat", json={"message": "incendios en Francia"})
    finally:
        app.dependency_overrides.clear()

    body = response.json()
    assert body["summary"]["narrative_source"] == "model"
    assert body["reply"] == "Informe generado por el modelo."
    assert body["summary"]["region"] == "Francia"


def test_chat_reports_source_failure_gracefully() -> None:
    class BrokenFirmsService:
        async def fetch_detections(self, query):  # noqa: ANN001, ANN201
            raise RuntimeError("FIRMS no está configurado")

    app.dependency_overrides[get_firms_service] = lambda: BrokenFirmsService()
    app.dependency_overrides[get_settings] = lambda: Settings(
        model_base_url="http://fake-model/v1", model_id="test-model"
    )
    try:
        with TestClient(app) as test_client:
            response = test_client.post("/api/chat", json={"message": "incendios en España"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["narrative_source"] == "unconfigured"
    assert body["fires"] == []
