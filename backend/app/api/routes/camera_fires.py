import asyncio
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.schemas.camera_fires import CameraFireCreate, CameraFireDetection
from app.services import camera_fires

router = APIRouter(prefix="/camera-fires", tags=["camera-fires"])

# Chrome/Firefox record to WebM; Safari's MediaRecorder only supports MP4.
# The uploaded clip's real container is kept (both the file extension and the
# Content-Type served back) instead of assuming WebM for everyone.
RECORDING_CONTENT_TYPES = {"webm": "video/webm", "mp4": "video/mp4"}


def _recording_extension(file: UploadFile) -> str:
    suffix = Path(file.filename or "").suffix.lstrip(".").lower()
    return suffix if suffix in RECORDING_CONTENT_TYPES else "webm"


@router.post("", response_model=CameraFireDetection, status_code=201)
async def create_camera_fire(payload: CameraFireCreate) -> dict:
    return await asyncio.to_thread(
        camera_fires.record_detection, payload.latitude, payload.longitude, payload.confidence, payload.label
    )


@router.get("", response_model=list[CameraFireDetection])
async def list_camera_fires() -> list[dict]:
    return await asyncio.to_thread(camera_fires.list_detections)


@router.post("/{detection_id}/recording", status_code=204)
async def upload_camera_fire_recording(detection_id: int, file: UploadFile = File(...)) -> None:
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=422, detail="El archivo de grabación está vacío")
    path = camera_fires.recording_file_path(detection_id, _recording_extension(file))
    await asyncio.to_thread(path.write_bytes, contents)
    relative_path = str(path.relative_to(camera_fires.DB_PATH.parent))
    await asyncio.to_thread(camera_fires.save_recording, detection_id, relative_path)


@router.get("/{detection_id}/recording")
async def get_camera_fire_recording(detection_id: int) -> FileResponse:
    relative_path = await asyncio.to_thread(camera_fires.get_recording_path, detection_id)
    if not relative_path:
        raise HTTPException(status_code=404, detail="No hay grabación disponible para este fuego")
    full_path = camera_fires.DB_PATH.parent / relative_path
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="El archivo de grabación no existe")
    extension = full_path.suffix.lstrip(".").lower()
    media_type = RECORDING_CONTENT_TYPES.get(extension, "application/octet-stream")
    return FileResponse(full_path, media_type=media_type)
