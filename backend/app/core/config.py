from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App
    APP_NAME: str = "E-Learning Sign Language API"
    DEBUG: bool = True

    # PostgreSQL
    DB_HOST: str = "localhost"
    DB_PORT: str = "5432"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"
    DB_NAME: str = "elearning_db"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/elearning_db"

    # Auth
    SECRET_KEY: str = "change-me-to-a-random-secret"
    SESSION_EXPIRE_HOURS: int = 24

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
