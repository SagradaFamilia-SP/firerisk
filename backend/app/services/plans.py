import json

import httpx
from pydantic import ValidationError

from app.core.config import Settings
from app.schemas.plans import (
    AgentPlanRequest,
    Incident,
    ModelPlanPayload,
    OperationalPlan,
    PlanAction,
    PlanAsset,
)


def fallback_plan(incident: Incident, assets: list[PlanAsset]) -> OperationalPlan:
    exposed = sorted(assets, key=lambda asset: asset.probability, reverse=True)
    top = exposed[0] if exposed else None
    name = top.name if top else "la instalación"
    probability = top.probability if top else 0
    eta = incident.top_eta_min
    eta_text = f" Ventana estimada de impacto: {eta} minutos." if eta else ""
    return OperationalPlan(
        mode="deterministic_fallback",
        summary=f"Riesgo elevado para {name} ({probability} %).{eta_text}",
        decision="ACTIVAR PREALERTA",
        actions=[
            PlanAction(priority=1, owner="Centro de control", action="Validar el foco con una segunda fuente y contactar con emergencias locales.", deadline_min=2),
            PlanAction(priority=2, owner="Responsable de planta", action="Suspender trabajos en campo y confirmar el recuento de personal.", deadline_min=5),
            PlanAction(priority=3, owner="Operaciones", action="Mantener libre la ruta norte y retirar vehículos del acceso oeste.", deadline_min=8),
            PlanAction(priority=4, owner="Mantenimiento", action="Comprobar depósito, bombas, cortafuegos y desconexión segura.", deadline_min=10),
            PlanAction(priority=5, owner="Dirección", action="Preparar una parada controlada si se reduce la ventana de respuesta.", deadline_min=15),
        ],
        message="Prealerta por incendio forestal próximo. Suspenda los trabajos exteriores y confirme su estado.",
        confidence_note="La propagación es un escenario de apoyo y debe validarse con fuentes oficiales.",
    )


def _extract_json(content: object) -> dict[str, object]:
    if not isinstance(content, str):
        raise ValueError("El modelo no devolvió contenido de texto")
    start = content.find("{")
    end = content.rfind("}")
    if start < 0 or end < start:
        raise ValueError("La respuesta no contiene un objeto JSON")
    parsed = json.loads(content[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("La respuesta JSON no es un objeto")
    return parsed


async def generate_plan(request: AgentPlanRequest, settings: Settings) -> OperationalPlan:
    fallback = fallback_plan(request.incident, request.assets)
    prompt = (
        "Eres un coordinador de emergencias para activos energéticos. "
        "Devuelve únicamente JSON con summary, decision, actions, message y confidence_note.\n"
        f"Incidente: {request.incident.model_dump_json()}\n"
        f"Activos: {json.dumps([asset.model_dump() for asset in request.assets], ensure_ascii=False)}"
    )
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(
                f"{settings.model_base_url}/chat/completions",
                json={
                    "model": settings.model_id,
                    "messages": [
                        {"role": "system", "content": "Responde únicamente con un objeto JSON válido."},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0,
                    "max_tokens": 1200,
                    "response_format": {"type": "json_object"},
                },
            )
            response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        payload = ModelPlanPayload.model_validate(_extract_json(content))
        return OperationalPlan(mode="local_model", **payload.model_dump())
    except (httpx.HTTPError, json.JSONDecodeError, ValidationError, ValueError, KeyError, IndexError, TypeError) as exc:
        fallback.model_error = f"{type(exc).__name__}: {str(exc)[:160]}"
        return fallback
