from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.services import camera_fires


@pytest.fixture(autouse=True)
def _isolated_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(camera_fires, "DB_PATH", tmp_path / "camera_fires_test.db")


def test_create_and_list_camera_fire(client: TestClient) -> None:
    response = client.post(
        "/api/camera-fires",
        json={"latitude": 40.4168, "longitude": -3.7038, "confidence": 0.83, "label": "Cámara en tiempo real"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["id"] == 1
    assert body["source"] == "camera"

    listed = client.get("/api/camera-fires")
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["label"] == "Cámara en tiempo real"


def test_create_camera_fire_rejects_out_of_range_confidence(client: TestClient) -> None:
    response = client.post(
        "/api/camera-fires",
        json={"latitude": 40.0, "longitude": -3.0, "confidence": 1.5},
    )
    assert response.status_code == 422


def test_recording_is_absent_until_uploaded(client: TestClient) -> None:
    created = client.post(
        "/api/camera-fires",
        json={"latitude": 40.0, "longitude": -3.0, "confidence": 0.7},
    ).json()
    assert created["recording_url"] is None

    missing = client.get(f"/api/camera-fires/{created['id']}/recording")
    assert missing.status_code == 404


def test_upload_and_fetch_camera_fire_recording(client: TestClient) -> None:
    created = client.post(
        "/api/camera-fires",
        json={"latitude": 40.0, "longitude": -3.0, "confidence": 0.7},
    ).json()

    upload = client.post(
        f"/api/camera-fires/{created['id']}/recording",
        files={"file": ("clip.webm", b"fake-webm-bytes", "video/webm")},
    )
    assert upload.status_code == 204

    listed = client.get("/api/camera-fires").json()
    assert listed[0]["recording_url"] == f"/camera-fires/{created['id']}/recording"

    recording = client.get(f"/api/camera-fires/{created['id']}/recording")
    assert recording.status_code == 200
    assert recording.content == b"fake-webm-bytes"
    assert recording.headers["content-type"] == "video/webm"


def test_upload_recording_keeps_the_real_mp4_container_for_safari_clips(client: TestClient) -> None:
    created = client.post(
        "/api/camera-fires",
        json={"latitude": 40.0, "longitude": -3.0, "confidence": 0.7},
    ).json()

    upload = client.post(
        f"/api/camera-fires/{created['id']}/recording",
        files={"file": ("clip.mp4", b"fake-mp4-bytes", "video/mp4")},
    )
    assert upload.status_code == 204

    recording = client.get(f"/api/camera-fires/{created['id']}/recording")
    assert recording.status_code == 200
    assert recording.content == b"fake-mp4-bytes"
    assert recording.headers["content-type"] == "video/mp4"


def test_upload_rejects_an_empty_recording(client: TestClient) -> None:
    created = client.post(
        "/api/camera-fires",
        json={"latitude": 40.0, "longitude": -3.0, "confidence": 0.7},
    ).json()

    upload = client.post(
        f"/api/camera-fires/{created['id']}/recording",
        files={"file": ("clip.webm", b"", "video/webm")},
    )
    assert upload.status_code == 422
