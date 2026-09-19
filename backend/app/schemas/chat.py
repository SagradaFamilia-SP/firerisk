from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.fires import FireConfidence, FireDetection


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatSummary(BaseModel):
    region: str | None
    hours: Literal[24, 48, 72]
    count: int
    confidence_counts: dict[FireConfidence, int]
    max_frp: float | None
    generated_at: datetime
    narrative_source: Literal["model", "fallback", "unconfigured"]


class ChatResponse(BaseModel):
    reply: str
    fires: list[FireDetection]
    summary: ChatSummary
