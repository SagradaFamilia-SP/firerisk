from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    model_base_url: str = "http://localhost:30000/v1"
    model_id: str = "/workspace/models/qwen3.6-35b-a3b"
    frontend_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]
    nasa_firms_map_key: str | None = None
    firms_base_url: str = "https://firms.modaps.eosdis.nasa.gov"
    firms_data_cache_ttl_seconds: int = 300
    firms_wms_cache_ttl_seconds: int = 900
    nominatim_base_url: str = "https://nominatim.openstreetmap.org"
    nominatim_cache_ttl_seconds: int = 86_400
    nominatim_user_agent: str = "PYROS Wildfire Intelligence demo contact: local-dev"
    speech_api_key: str | None = None
    speech_base_url: str = "https://api.slng.ai"
    speech_model: str = "deepgram/nova:3"
    speech_language: str = "es"

    @field_validator("frontend_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
