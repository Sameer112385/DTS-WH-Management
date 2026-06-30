from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

import sys

# Add parent directory of 'backend' to sys.path to enable absolute imports of 'backend'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.config import settings
from backend.database import engine, Base
from backend.routers import auth, company, mb52, materials, mrf, receiving, transfer, settings as app_settings, reports, admin_tools

# Create all tables in database
Base.metadata.create_all(bind=engine)

# Add missing columns dynamically if they do not exist
try:
    from sqlalchemy import text
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(mrf_line_items)")).fetchall()
        column_names = [r[1] for r in result]
        if "plant_code" not in column_names:
            conn.execute(text("ALTER TABLE mrf_line_items ADD COLUMN plant_code VARCHAR(50)"))
        if "storage_location_code" not in column_names:
            conn.execute(text("ALTER TABLE mrf_line_items ADD COLUMN storage_location_code VARCHAR(50)"))
        mrf_columns = conn.execute(text("PRAGMA table_info(mrfs)")).fetchall()
        mrf_column_names = [r[1] for r in mrf_columns]
        if "issue_account_type" not in mrf_column_names:
            conn.execute(text("ALTER TABLE mrfs ADD COLUMN issue_account_type VARCHAR(20) DEFAULT 'project'"))
        if "cost_center_code" not in mrf_column_names:
            conn.execute(text("ALTER TABLE mrfs ADD COLUMN cost_center_code VARCHAR(50)"))
        if "project_manager_email" not in mrf_column_names:
            conn.execute(text("ALTER TABLE mrfs ADD COLUMN project_manager_email VARCHAR(255)"))
        if "requestor_manager_email" not in mrf_column_names:
            conn.execute(text("ALTER TABLE mrfs ADD COLUMN requestor_manager_email VARCHAR(255)"))
        if "last_action_comment" not in mrf_column_names:
            conn.execute(text("ALTER TABLE mrfs ADD COLUMN last_action_comment TEXT"))
        if "last_action_by" not in mrf_column_names:
            conn.execute(text("ALTER TABLE mrfs ADD COLUMN last_action_by VARCHAR(100)"))
        if "last_action_at" not in mrf_column_names:
            conn.execute(text("ALTER TABLE mrfs ADD COLUMN last_action_at DATETIME"))
        action_log_table = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='mrf_action_logs'")).fetchone()
        if not action_log_table:
            conn.execute(text("""
                CREATE TABLE mrf_action_logs (
                    id INTEGER PRIMARY KEY,
                    mrf_id INTEGER NOT NULL,
                    action VARCHAR(50) NOT NULL,
                    from_status VARCHAR(100),
                    to_status VARCHAR(100),
                    actor_name VARCHAR(100) NOT NULL,
                    actor_role VARCHAR(100),
                    actor_email VARCHAR(255),
                    comment TEXT,
                    source VARCHAR(30) NOT NULL DEFAULT 'app',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(mrf_id) REFERENCES mrfs(id)
                )
            """))
        conn.execute(text(
            "UPDATE mrfs SET status = 'Pending Warehouse Supervisor Check' "
            "WHERE status = 'Pending Project Manager Approval'"
        ))

        user_indexes = conn.execute(text("PRAGMA index_list(users)")).fetchall()
        unique_email_index = next((idx for idx in user_indexes if idx[1] == "ix_users_email" and idx[2] == 1), None)
        if unique_email_index:
            conn.execute(text("ALTER TABLE users RENAME TO users_old"))
            conn.execute(text("""
                CREATE TABLE users (
                    id INTEGER NOT NULL PRIMARY KEY,
                    username VARCHAR(50) NOT NULL,
                    hashed_password VARCHAR(100) NOT NULL,
                    name VARCHAR(100) NOT NULL,
                    email VARCHAR(100) NOT NULL,
                    mobile VARCHAR(50),
                    role VARCHAR(50) NOT NULL,
                    is_active BOOLEAN,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("""
                INSERT INTO users (id, username, hashed_password, name, email, mobile, role, is_active, created_at)
                SELECT id, username, hashed_password, name, email, mobile, role, is_active, created_at
                FROM users_old
            """))
            conn.execute(text("CREATE UNIQUE INDEX ix_users_username ON users (username)"))
            conn.execute(text("CREATE INDEX ix_users_email ON users (email)"))
            conn.execute(text("CREATE INDEX ix_users_id ON users (id)"))
            conn.execute(text("DROP TABLE users_old"))
        conn.commit()
except Exception as e:
    print(f"Error checking/adding dynamic columns: {e}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Warehouse Operations & Stock Tracking System",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads folder to serve static PDFs
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=settings.UPLOAD_DIR), name="static")

# Include Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(company.router, prefix=settings.API_V1_STR)
app.include_router(mb52.router, prefix=settings.API_V1_STR)
app.include_router(materials.router, prefix=settings.API_V1_STR)
app.include_router(mrf.router, prefix=settings.API_V1_STR)
app.include_router(receiving.router, prefix=settings.API_V1_STR)
app.include_router(transfer.router, prefix=settings.API_V1_STR)
app.include_router(app_settings.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)
app.include_router(admin_tools.router, prefix=settings.API_V1_STR)

@app.on_event("startup")
def startup_event():
    try:
        from backend.utils.imap_listener import start_imap_listener
        start_imap_listener()
    except Exception as e:
        print(f"Error starting IMAP listener: {e}")

@app.get("/")
def read_root():
    return {
        "status": "Healthy",
        "project": settings.PROJECT_NAME,
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
