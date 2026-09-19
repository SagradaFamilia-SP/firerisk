from fastapi.testclient import TestClient

from app.api.routes import video


def test_backend_env_loader_populates_vonage_environment(tmp_path, monkeypatch) -> None:
    env_file = tmp_path / ".env"
    key_file = tmp_path / "private.key"
    key_file.write_text("key", encoding="utf-8")
    env_file.write_text(
        "\n".join([
            "VONAGE_APPLICATION_ID=test-application",
            f"VONAGE_PRIVATE_KEY_PATH={key_file}",
        ]),
        encoding="utf-8",
    )
    monkeypatch.delenv("VONAGE_APPLICATION_ID", raising=False)
    monkeypatch.delenv("VONAGE_PRIVATE_KEY_PATH", raising=False)

    video.load_backend_env(env_file)

    assert video.os.getenv("VONAGE_APPLICATION_ID") == "test-application"
    assert video.os.getenv("VONAGE_PRIVATE_KEY_PATH") == str(key_file)


def test_model_path_falls_back_to_backend_model_when_configured_path_is_missing(monkeypatch) -> None:
    monkeypatch.setenv("YOLO_MODEL_PATH", "./missing-model-dir/best.pt")

    assert video.resolve_model_path() == video.BACKEND_DIR / "model" / "best.pt"


def test_video_health_reports_demo_asset_and_model(client: TestClient) -> None:
    response = client.get("/api/video/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["demo_video_exists"] is True
    assert payload["model_exists"] is True
    assert payload["session_created"] is False


def test_video_demo_source_serves_mp4(client: TestClient) -> None:
    response = client.get("/api/video/demo-source")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("video/mp4")
    assert int(response.headers["content-length"]) > 0


def test_video_camera_page_is_single_auto_stream_surface(client: TestClient) -> None:
    response = client.get("/api/video/camera")

    assert response.status_code == 200
    html = response.text
    assert "Vonage connected" in html
    assert "/api/video/demo-source" in html
    assert "/api/video/subscriber" in html
    assert "startCameraStream()" in html
    assert "Fuente:" not in html
    assert "Debug" not in html
