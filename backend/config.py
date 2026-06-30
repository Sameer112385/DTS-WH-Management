import os

class Settings:
    PROJECT_NAME: str = "Warehouse Operations System"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("JWT_SECRET", "super-secret-key-for-jwt-tokens-change-this-in-production")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    EMAIL_ACTION_TOKEN_EXPIRE_HOURS: int = int(os.getenv("EMAIL_ACTION_TOKEN_EXPIRE_HOURS", "72"))
    PUBLIC_BASE_URL: str = os.getenv("PUBLIC_BASE_URL", "http://127.0.0.1:8000")
    
    # DB URL: Fallback to local SQLite inside scratch directory if not defined
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite:///C:/Users/dts7435/.gemini/antigravity/scratch/warehouse_app/backend/warehouse.db"
    )
    
    # Upload folder
    UPLOAD_DIR: str = os.getenv(
        "UPLOAD_DIR",
        "C:/Users/dts7435/.gemini/antigravity/scratch/warehouse_app/backend/uploads"
    )

settings = Settings()

# Ensure uploads directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
