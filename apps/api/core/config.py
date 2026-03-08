from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",  # silently drop unknown env vars
    )

    database_url: str = Field(..., env="DATABASE_URL")
    redis_url: str = Field(..., env="REDIS_URL")
    anthropic_api_key: str = Field(..., env="ANTHROPIC_API_KEY")
    artifacts_dir: str = Field(default="./data/artifacts", env="ARTIFACTS_DIR")
    jwt_secret: str = Field(..., env="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256")
    jwt_expiration_hours: int = Field(default=24)

    # OpenTelemetry settings
    enable_tracing: bool = Field(default=True)
    service_name: str = Field(default="bioos-api")

    # Tamarind Bio API
    tamarind_api_key: str = Field(default="", env="TAMARIND_API_KEY")
    tamarind_api_base_url: str = Field(default="https://api.tamarind.bio/v1", env="TAMARIND_API_BASE_URL")

    # Modal
    modal_app_name: str = Field(default="biosync-orchestrator", env="MODAL_APP_NAME")

    # Celery (defaults to Redis URL when blank)
    celery_broker_url: Optional[str] = Field(default=None)
    celery_result_backend: Optional[str] = Field(default=None)

    def model_post_init(self, __context: object) -> None:
        if not self.celery_broker_url:
            object.__setattr__(self, "celery_broker_url", self.redis_url)
        if not self.celery_result_backend:
            object.__setattr__(self, "celery_result_backend", self.redis_url)


settings = Settings()

# Ensure artifacts directory exists
artifacts_path = Path(settings.artifacts_dir)
artifacts_path.mkdir(parents=True, exist_ok=True)