import asyncio
import json
import re
import unicodedata
from datetime import UTC, datetime
from typing import Literal

from app.core.config import Settings
from app.schemas.chat import ChatRequest, ChatResponse, ChatSummary
from app.schemas.fires import FireDetection, FireQuery, FireResponse
from app.services.firms import FirmsService
from app.services.model_client import generate_chat_completion

Bbox = tuple[float, float, float, float]

# A small demo gazetteer of Mediterranean/wildfire-prone countries. Spain
# needs two boxes because the Canary Islands sit far outside its mainland
# bounding box; every other country here fits a single box well enough for
# an operational summary.
REGION_BBOXES: dict[str, list[Bbox]] = {
    "espana": [(-9.9, 35.9, 4.5, 43.9), (-18.4, 27.5, -13.3, 29.5)],
    "portugal": [(-9.6, 36.8, -6.1, 42.2)],
    "francia": [(-5.2, 41.3, 9.7, 51.1)],
    "italia": [(6.6, 35.4, 18.6, 47.1)],
    "grecia": [(19.3, 34.7, 28.3, 41.8)],
}

REGION_LABELS: dict[str, str] = {
    "espana": "España",
    "portugal": "Portugal",
    "francia": "Francia",
    "italia": "Italia",
    "grecia": "Grecia",
}

REGION_ALIASES: dict[str, str] = {
    "espana": "espana",
    "spain": "espana",
    "portugal": "portugal",
    "francia": "francia",
    "france": "francia",
    "italia": "italia",
    "italy": "italia",
    "grecia": "grecia",
    "greece": "grecia",
}

DEFAULT_REGION = "espana"
CONFIDENCE_LABELS: dict[str, str] = {"low": "baja", "nominal": "nominal", "high": "alta"}
MAX_FIRES_RETURNED = 300


def _normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def detect_region(message: str) -> str:
    normalized = _normalize(message)
    for alias in sorted(REGION_ALIASES, key=len, reverse=True):
        if re.search(rf"\b{re.escape(alias)}\b", normalized):
            return REGION_ALIASES[alias]
    return DEFAULT_REGION


def detect_hours(message: str) -> Literal[24, 48, 72]:
    normalized = _normalize(message)
    if re.search(r"\b72\b|tres dias|3 dias|una semana|ultima semana", normalized):
        return 72
    if re.search(r"\b48\b|dos dias|2 dias", normalized):
        return 48
    return 24


def _confidence_counts(detections: list[FireDetection]) -> dict[str, int]:
    counts = {"low": 0, "nominal": 0, "high": 0}
    for detection in detections:
        counts[detection.confidence] += 1
    return counts


def _build_fallback_reply(region_label: str, hours: int, detections: list[FireDetection]) -> str:
    if not detections:
        return (
            f"No hay detecciones activas de NASA FIRMS en {region_label} en las últimas {hours} horas.\n\n"
            "Esto no descarta incendios pequeños o cubiertos por nubes: FIRMS solo registra anomalías "
            "térmicas visibles por satélite en el momento de cada paso orbital."
        )

    counts = _confidence_counts(detections)
    top = sorted(detections, key=lambda item: item.frp or 0, reverse=True)[:8]
    lines = [
        f"Incendios activos en {region_label} · últimas {hours} h (NASA FIRMS VIIRS)",
        "",
        f"Total de focos detectados: {len(detections)}",
        f"Confianza — alta: {counts['high']}, nominal: {counts['nominal']}, baja: {counts['low']}",
        "",
        "Focos más intensos:",
    ]
    for item in top:
        hour = item.acquired_at.strftime("%d/%m %H:%MZ")
        frp = f"{item.frp:.1f} MW" if item.frp is not None else "FRP N/D"
        lines.append(
            f"- {item.latitude:.3f}, {item.longitude:.3f} · {hour} · {frp} · "
            f"confianza {CONFIDENCE_LABELS[item.confidence]} · {item.satellite}"
        )
    lines.extend((
        "",
        "Informe: los datos proceden de pasos VIIRS NOAA-20/21 de las últimas horas y reflejan anomalías "
        "térmicas, no necesariamente incendios confirmados sobre el terreno. Prioriza verificación de campo "
        "en los focos de mayor FRP y confianza alta.",
    ))
    return "\n".join(lines)


def _build_model_messages(
    message: str, region_label: str, hours: int, detections: list[FireDetection]
) -> list[dict[str, str]]:
    top = sorted(detections, key=lambda item: item.frp or 0, reverse=True)[:15]
    payload = {
        "region": region_label,
        "window_hours": hours,
        "total_detections": len(detections),
        "confidence_counts": _confidence_counts(detections),
        "top_detections": [
            {
                "lat": round(item.latitude, 3),
                "lon": round(item.longitude, 3),
                "acquired_at_utc": item.acquired_at.isoformat(),
                "confidence": item.confidence,
                "frp_mw": item.frp,
                "satellite": item.satellite,
                "daynight": item.daynight,
            }
            for item in top
        ],
    }
    system = (
        "Eres el asistente operativo de IGNIS, una plataforma de inteligencia de incendios forestales. "
        "Respondes siempre en español, con tono operativo y conciso. Trabajas EXCLUSIVAMENTE con los datos "
        "reales de NASA FIRMS que se te entregan en JSON; nunca inventes incendios, ubicaciones ni cifras "
        "que no estén en ese JSON."
    )
    user = (
        f"Pregunta del usuario: {message}\n\n"
        f"Datos reales de NASA FIRMS (VIIRS) para {region_label}, ventana de {hours} horas:\n"
        f"{json.dumps(payload, ensure_ascii=False)}\n\n"
        "Redacta la respuesta en dos partes: "
        "1) una lista breve (máx. 8 puntos) de los focos más relevantes con ubicación aproximada, hora UTC "
        "y confianza; 2) un informe corto con el total de focos, el reparto por confianza y una "
        "recomendación operativa. Si total_detections es 0, dilo con claridad y explica que FIRMS no ha "
        "detectado anomalías térmicas en la ventana pedida."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


async def answer_chat(request: ChatRequest, firms_service: FirmsService, settings: Settings) -> ChatResponse:
    region_key = detect_region(request.message)
    region_label = REGION_LABELS[region_key]
    hours = detect_hours(request.message)
    bboxes = REGION_BBOXES[region_key]

    results = await asyncio.gather(
        *(
            firms_service.fetch_detections(FireQuery(west=west, south=south, east=east, north=north, hours=hours))
            for (west, south, east, north) in bboxes
        ),
        return_exceptions=True,
    )
    successes = [item for item in results if isinstance(item, FireResponse)]
    if not successes:
        errors = [item for item in results if isinstance(item, BaseException)]
        detail = str(errors[0]) if errors else "NASA FIRMS no está disponible"
        return ChatResponse(
            reply=(
                f"No he podido consultar NASA FIRMS para {region_label} ahora mismo ({detail}). "
                "Vuelve a intentarlo en unos minutos."
            ),
            fires=[],
            summary=ChatSummary(
                region=region_label,
                hours=hours,
                count=0,
                confidence_counts={"low": 0, "nominal": 0, "high": 0},
                max_frp=None,
                generated_at=datetime.now(UTC),
                narrative_source="unconfigured",
            ),
        )

    merged: dict[str, FireDetection] = {}
    for response in successes:
        for detection in response.detections:
            merged[detection.id] = detection
    detections = sorted(merged.values(), key=lambda item: item.acquired_at, reverse=True)

    reply = await generate_chat_completion(
        settings, _build_model_messages(request.message, region_label, hours, detections)
    )
    narrative_source: Literal["model", "fallback"] = "model" if reply else "fallback"
    if not reply:
        reply = _build_fallback_reply(region_label, hours, detections)

    counts = _confidence_counts(detections)
    max_frp = max((item.frp for item in detections if item.frp is not None), default=None)
    return ChatResponse(
        reply=reply,
        fires=detections[:MAX_FIRES_RETURNED],
        summary=ChatSummary(
            region=region_label,
            hours=hours,
            count=len(detections),
            confidence_counts=counts,
            max_frp=max_frp,
            generated_at=datetime.now(UTC),
            narrative_source=narrative_source,
        ),
    )
