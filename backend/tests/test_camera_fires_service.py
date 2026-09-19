from pathlib import Path

import pytest

from app.services import camera_fires


@pytest.fixture(autouse=True)
def _isolated_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(camera_fires, "DB_PATH", tmp_path / "camera_fires_test.db")


def test_record_detection_returns_the_saved_row() -> None:
    row = camera_fires.record_detection(40.4168, -3.7038, 0.83, "Cámara en tiempo real")

    assert row["id"] == 1
    assert row["latitude"] == 40.4168
    assert row["longitude"] == -3.7038
    assert row["confidence"] == 0.83
    assert row["label"] == "Cámara en tiempo real"
    assert row["detected_at"]  # a real ISO timestamp was stamped


def test_list_detections_orders_newest_first() -> None:
    camera_fires.record_detection(40.0, -3.0, 0.5, "primera")
    camera_fires.record_detection(41.0, -4.0, 0.6, "segunda")

    rows = camera_fires.list_detections()

    assert [row["label"] for row in rows] == ["segunda", "primera"]


def test_list_detections_respects_limit() -> None:
    for index in range(5):
        camera_fires.record_detection(40.0, -3.0, 0.5, f"deteccion-{index}")

    rows = camera_fires.list_detections(limit=2)

    assert len(rows) == 2


def test_survives_across_separate_connections_in_the_same_db_file() -> None:
    # Each call opens/closes its own connection (see camera_fires.py) — this
    # confirms writes from one call are really durable for a later call, not
    # just visible within a single still-open connection.
    camera_fires.record_detection(40.0, -3.0, 0.5, "persistida")

    rows = camera_fires.list_detections()

    assert len(rows) == 1
    assert rows[0]["label"] == "persistida"


def test_new_detections_have_no_recording_by_default() -> None:
    row = camera_fires.record_detection(40.0, -3.0, 0.5, "sin grabar")

    assert row["recording_path"] is None
    assert camera_fires.get_recording_path(row["id"]) is None


def test_save_recording_persists_the_path() -> None:
    row = camera_fires.record_detection(40.0, -3.0, 0.5, "grabado")

    camera_fires.save_recording(row["id"], f"recordings/{row['id']}.webm")

    assert camera_fires.get_recording_path(row["id"]) == f"recordings/{row['id']}.webm"
    listed = camera_fires.list_detections()
    assert listed[0]["recording_path"] == f"recordings/{row['id']}.webm"
