from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.config import Settings, get_settings
from app.schemas.speech import TranscriptionResponse
from app.services.speech import (
    SpeechServiceUnavailableError,
    SpeechTranscriptionError,
    transcribe_audio,
)

router = APIRouter(tags=["speech"])
SettingsDep = Annotated[Settings, Depends(get_settings)]


@router.post("/speech-to-text", response_model=TranscriptionResponse)
async def speech_to_text(settings: SettingsDep, file: Annotated[UploadFile, File()]) -> TranscriptionResponse:
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=422, detail="Audio vacío")
    try:
        text = await transcribe_audio(
            settings, audio_bytes, file.filename or "audio.webm", file.content_type or "audio/webm"
        )
    except SpeechServiceUnavailableError as error:
        raise HTTPException(
            status_code=503,
            detail="Transcripción de voz no configurada: falta SPEECH_API_KEY en backend/.env",
        ) from error
    except SpeechTranscriptionError as error:
        raise HTTPException(status_code=502, detail="No se pudo transcribir el audio") from error
    return TranscriptionResponse(text=text)
