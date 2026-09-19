from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat import answer_chat
from app.services.firms import FirmsService, get_firms_service

router = APIRouter(tags=["chat"])
Service = Annotated[FirmsService, Depends(get_firms_service)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, service: Service, settings: SettingsDep) -> ChatResponse:
    return await answer_chat(payload, service, settings)
