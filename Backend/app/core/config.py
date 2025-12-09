"""
Application configuration using Pydantic Settings.
Loads environment variables from .env file.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database
    DATABASE_URL: str
    
    # App settings
    DEBUG: bool = False
    APP_NAME: str = "WebChat API"
    APP_VERSION: str = "0.1.0"
    
    # Security
    SECRET_KEY: str = "changethis-to-a-secure-random-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


@lru_cache
def get_settings() -> Settings:
    """
    Get cached settings instance.
    Using lru_cache to avoid reading .env file on every request.
    """
    return Settings()


# Global settings instance
settings = get_settings()
