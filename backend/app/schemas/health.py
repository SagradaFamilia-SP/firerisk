from pydantic import BaseModel


class HealthResponse(BaseModel):
    ok: bool = True
    model_online: bool
    models: list[str]
    configured_model: str

