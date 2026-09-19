import os
from pathlib import Path
from typing import Any

import numpy as np
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

BACKEND_DIR = Path(__file__).resolve().parents[3]
REPO_DIR = BACKEND_DIR.parent
STATIC_DIR = BACKEND_DIR / "app" / "static" / "vonage_yolo"
DEMO_VIDEO_CANDIDATES = (
    REPO_DIR / "tests" / "vonage_yolo_env_demo" / "foc.mp4",
    REPO_DIR / "tests" / "foc.mp4",
)


def load_backend_env(env_file: Path = BACKEND_DIR / ".env") -> None:
    load_dotenv(env_file, override=False)


load_backend_env()

def resolve_model_path() -> Path:
    configured = os.getenv("YOLO_MODEL_PATH")
    default_path = BACKEND_DIR / "model" / "best.pt"

    if not configured:
        return default_path

    configured_path = Path(configured)
    if not configured_path.is_absolute():
        configured_path = (BACKEND_DIR / configured_path).resolve()

    if configured_path.exists():
        return configured_path

    return default_path


MODEL_PATH = resolve_model_path()

router = APIRouter(prefix="/video", tags=["video"])

_video_session_id: str | None = None
_yolo_model: Any | None = None


def _decode_token(token: Any) -> str:
    if isinstance(token, bytes):
        return token.decode("utf-8")
    return str(token)


def _modern_vonage_credentials() -> dict[str, str] | None:
    application_id = os.getenv("VONAGE_APPLICATION_ID")
    private_key_path = os.getenv("VONAGE_PRIVATE_KEY_PATH")

    if not application_id or not private_key_path:
        return None

    key_path = Path(private_key_path)
    if not key_path.is_absolute():
        key_path = (BACKEND_DIR / key_path).resolve()

    if not key_path.exists():
        raise RuntimeError(f"Private key not found: {key_path}")

    from vonage import Auth, Vonage
    from vonage_video import SessionOptions, TokenOptions

    client = Vonage(Auth(application_id=application_id, private_key=str(key_path)))

    global _video_session_id
    if _video_session_id is None:
        session = client.video.create_session(SessionOptions(media_mode="routed"))
        _video_session_id = session.session_id

    publisher_token = client.video.generate_client_token(
        TokenOptions(session_id=_video_session_id, role="publisher"),
    )
    subscriber_token = client.video.generate_client_token(
        TokenOptions(session_id=_video_session_id, role="subscriber"),
    )

    return {
        "mode": "vonage-application",
        "application_id": application_id,
        "session_id": _video_session_id,
        "publisher_token": _decode_token(publisher_token),
        "subscriber_token": _decode_token(subscriber_token),
    }


def _legacy_opentok_credentials() -> dict[str, str] | None:
    api_key = os.getenv("VONAGE_API_KEY")
    api_secret = os.getenv("VONAGE_API_SECRET")

    if not api_key or not api_secret:
        return None

    from opentok import MediaModes, OpenTok, Roles

    opentok = OpenTok(api_key, api_secret)

    global _video_session_id
    if _video_session_id is None:
        session = opentok.create_session(media_mode=MediaModes.routed)
        _video_session_id = session.session_id

    return {
        "mode": "legacy-opentok",
        "application_id": api_key,
        "session_id": _video_session_id,
        "publisher_token": opentok.generate_token(_video_session_id, role=Roles.publisher),
        "subscriber_token": opentok.generate_token(_video_session_id, role=Roles.subscriber),
    }


def get_video_credentials() -> dict[str, str]:
    modern = _modern_vonage_credentials()
    if modern:
        return modern

    legacy = _legacy_opentok_credentials()
    if legacy:
        return legacy

    raise RuntimeError(
        "No Vonage Video credentials configured. "
        "Set VONAGE_APPLICATION_ID + VONAGE_PRIVATE_KEY_PATH."
    )


def get_model() -> Any:
    global _yolo_model

    if _yolo_model is None:
        if not MODEL_PATH.exists():
            raise RuntimeError(
                f"YOLO model not found at {MODEL_PATH}. Put best.pt there or set YOLO_MODEL_PATH."
            )

        from ultralytics import YOLO

        _yolo_model = YOLO(str(MODEL_PATH))

    return _yolo_model


def get_demo_video_path() -> Path:
    for path in DEMO_VIDEO_CANDIDATES:
        if path.exists():
            return path
    return DEMO_VIDEO_CANDIDATES[0]


@router.get("/pipeline", include_in_schema=False)
async def pipeline_page() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@router.get("/camera", include_in_schema=False)
async def camera_page() -> FileResponse:
    return FileResponse(STATIC_DIR / "camera.html")


@router.get("/camera-live", include_in_schema=False)
async def camera_live_page() -> FileResponse:
    return FileResponse(STATIC_DIR / "camera_live.html")


@router.get("/subscriber", include_in_schema=False)
async def subscriber_page() -> FileResponse:
    return FileResponse(STATIC_DIR / "subscriber.html")


@router.get("/demo-source", include_in_schema=False)
async def demo_source() -> FileResponse:
    demo_video_path = get_demo_video_path()
    if not demo_video_path.exists():
        raise HTTPException(status_code=404, detail="Demo video foc.mp4 not found")
    return FileResponse(demo_video_path, media_type="video/mp4", filename="foc.mp4")


@router.get("/credentials")
async def video_credentials() -> dict[str, str]:
    try:
        return get_video_credentials()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/detect")
async def detect(request: Request) -> dict[str, Any]:
    try:
        form = await request.form()
        frame = form.get("frame")
        if frame is None or not hasattr(frame, "read"):
            raise HTTPException(status_code=400, detail="Missing image frame")

        payload = await frame.read()
        array = np.frombuffer(payload, dtype=np.uint8)

        import cv2

        image = cv2.imdecode(array, cv2.IMREAD_COLOR)
        if image is None:
            raise HTTPException(status_code=400, detail="Invalid image frame")

        model = get_model()
        results = model.predict(source=image, conf=float(os.getenv("YOLO_CONFIDENCE", "0.25")), verbose=False)
        result = results[0]
        detections = []

        if result.boxes is not None:
            for box in result.boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                class_name = str(result.names[class_id])
                x1, y1, x2, y2 = [float(value) for value in box.xyxy[0].tolist()]
                detections.append({
                    "class_id": class_id,
                    "class_name": class_name,
                    "confidence": round(confidence, 4),
                    "bbox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
                })

        fire_or_smoke = any(
            detection["class_name"].lower() in {"fire", "smoke"}
            for detection in detections
        )
        image_height, image_width = image.shape[:2]

        return {
            "fire_or_smoke": fire_or_smoke,
            "detections": detections,
            "model_classes": result.names,
            "image_width": image_width,
            "image_height": image_height,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/health")
async def video_health() -> dict[str, Any]:
    return {
        "ok": True,
        "model_path": str(MODEL_PATH),
        "model_exists": MODEL_PATH.exists(),
        "demo_video_path": str(get_demo_video_path()),
        "demo_video_exists": get_demo_video_path().exists(),
        "vonage_modern_configured": bool(
            os.getenv("VONAGE_APPLICATION_ID") and os.getenv("VONAGE_PRIVATE_KEY_PATH")
        ),
        "vonage_legacy_configured": bool(os.getenv("VONAGE_API_KEY") and os.getenv("VONAGE_API_SECRET")),
        "session_created": _video_session_id is not None,
    }
