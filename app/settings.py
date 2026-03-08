"""
Application settings loaded from environment variables via pydantic-settings.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Anthropic
    anthropic_api_key: str = Field(..., alias="ANTHROPIC_API_KEY")

    # Tamarind Bio
    tamarind_api_key: str = Field(..., alias="TAMARIND_API_KEY")
    tamarind_api_base_url: str = Field(
        default="https://api.tamarind.bio/v1",
        alias="TAMARIND_API_BASE_URL",
    )

    # Redis
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")

    # Modal
    modal_app_name: str = Field(default="biosync-orchestrator", alias="MODAL_APP_NAME")

    # App
    app_env: str = Field(default="development", alias="APP_ENV")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
