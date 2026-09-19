import httpx

from app.core.config import Settings


class SpeechServiceUnavailableError(Exception):
    """Raised when no speech-to-text API key is configured."""


class SpeechTranscriptionError(Exception):
    """Raised when the upstream speech-to-text API call fails."""


async def transcribe_audio(
    settings: Settings, audio_bytes: bytes, filename: str, content_type: str
) -> str:
    if not settings.speech_api_key:
        raise SpeechServiceUnavailableError()

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.speech_base_url}/v1/bridges/unmute/stt/{settings.speech_model}",
                headers={"Authorization": f"Bearer {settings.speech_api_key}"},
                data={"language": settings.speech_language},
                files={"audio": (filename, audio_bytes, content_type or "audio/webm")},
            )
            response.raise_for_status()
            payload = response.json()
        channels = payload.get("results", {}).get("channels") or []
        alternatives = channels[0].get("alternatives") if channels else []
        text = alternatives[0].get("transcript") if alternatives else None
        if not isinstance(text, str):
            raise SpeechTranscriptionError("Respuesta de transcripción inválida")
        return text.strip()
    except httpx.HTTPError as error:
        raise SpeechTranscriptionError(str(error)) from error
