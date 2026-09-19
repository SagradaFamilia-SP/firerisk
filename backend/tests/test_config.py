from app.core.config import Settings


def test_frontend_origins_accept_comma_separated_environment_value(monkeypatch) -> None:
    monkeypatch.setenv("FRONTEND_ORIGINS", "http://localhost:5173,https://demo.ignis.test")
    settings = Settings()
    assert settings.frontend_origins == ["http://localhost:5173", "https://demo.ignis.test"]
