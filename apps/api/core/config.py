from pydantic import Field
from pydantic_settings import BaseSettings
from pathlib import Path
from typing import Any, Dict


class Settings(BaseSettings):
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
    
    # Celery settings
    celery_broker_url: str = Field(default=None)
    celery_result_backend: str = Field(default=None)
    
    class Config:
        env_file = ".env"
        case_sensitive = False
    
    def __init__(self, **kwargs: Any):
        super().__init__(**kwargs)
        # Default Celery URLs to Redis URL if not set
        if not self.celery_broker_url:
            self.celery_broker_url = self.redis_url
        if not self.celery_result_backend:
            self.celery_result_backend = self.redis_url


settings = Settings()

# Ensure artifacts directory exists
artifacts_path = Path(settings.artifacts_dir)
artifacts_path.mkdir(parents=True, exist_ok=True)