import os

class Settings:
    PROJECT_NAME: str = "Warehouse Operations System"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv(
        "JWT_SECRET",
        "super-secret-key-for-jwt-tokens-change-this-in-production"
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    EMAIL_ACTION_TOKEN_EXPIRE_HOURS: int = int(
        os.getenv("EMAIL_ACTION_TOKEN_EXPIRE_HOURS", "72")
    )

    PUBLIC_BASE_URL: str = os.getenv(
        "PUBLIC_BASE_URL",
        "http://127.0.0.1:8000"
    )

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./warehouse.db"
    )

    # Upload folder
    UPLOAD_DIR: str = os.getenv(
        "UPLOAD_DIR",
        "./uploads"
    )

settings = Settings()

# Ensure uploads directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)