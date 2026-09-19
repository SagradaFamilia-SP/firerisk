"""
Persistence for fires detected by a live camera (YOLO over a Vonage-relayed
stream), as opposed to NASA FIRMS satellite detections.

Plain sqlite3 (stdlib, no ORM) is enough here: this is a small, low-write
table, and a real .db file lets a detection survive a backend restart, unlike
an in-memory list. Each call opens and closes its own connection so this is
safe to run from any thread (e.g. via asyncio.to_thread from the routes).
"""

import sqlite3
from datetime import UTC, datetime
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "camera_fires.db"


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def recordings_dir() -> Path:
    directory = DB_PATH.parent / "recordings"
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def recording_file_path(detection_id: int, extension: str = "webm") -> Path:
    return recordings_dir() / f"{detection_id}.{extension}"


def _ensure_schema(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS camera_fire_detections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            confidence REAL NOT NULL,
            label TEXT NOT NULL,
            detected_at TEXT NOT NULL
        )
        """
    )
    columns = {row["name"] for row in connection.execute("PRAGMA table_info(camera_fire_detections)")}
    if "recording_path" not in columns:
        connection.execute("ALTER TABLE camera_fire_detections ADD COLUMN recording_path TEXT")


def record_detection(latitude: float, longitude: float, confidence: float, label: str) -> dict:
    connection = _connect()
    try:
        _ensure_schema(connection)
        detected_at = datetime.now(UTC).isoformat()
        cursor = connection.execute(
            "INSERT INTO camera_fire_detections (latitude, longitude, confidence, label, detected_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (latitude, longitude, confidence, label, detected_at),
        )
        connection.commit()
        return {
            "id": cursor.lastrowid,
            "latitude": latitude,
            "longitude": longitude,
            "confidence": confidence,
            "label": label,
            "detected_at": detected_at,
            "recording_path": None,
        }
    finally:
        connection.close()


def list_detections(limit: int = 200) -> list[dict]:
    connection = _connect()
    try:
        _ensure_schema(connection)
        rows = connection.execute(
            "SELECT id, latitude, longitude, confidence, label, detected_at, recording_path "
            "FROM camera_fire_detections ORDER BY detected_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()


def save_recording(detection_id: int, relative_path: str) -> None:
    connection = _connect()
    try:
        _ensure_schema(connection)
        connection.execute(
            "UPDATE camera_fire_detections SET recording_path = ? WHERE id = ?",
            (relative_path, detection_id),
        )
        connection.commit()
    finally:
        connection.close()


def get_recording_path(detection_id: int) -> str | None:
    connection = _connect()
    try:
        _ensure_schema(connection)
        row = connection.execute(
            "SELECT recording_path FROM camera_fire_detections WHERE id = ?",
            (detection_id,),
        ).fetchone()
        return row["recording_path"] if row else None
    finally:
        connection.close()
