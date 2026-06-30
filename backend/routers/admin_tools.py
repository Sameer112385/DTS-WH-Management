from __future__ import annotations

import json
import math
import os
from datetime import datetime
from typing import Any

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import JSON
from sqlalchemy.orm import Session

from backend.auth import RoleChecker, get_current_user, get_password_hash
from backend.config import settings
from backend.database import get_db
from backend.models import (
    Attachment,
    AuditTrail,
    Cancellation,
    CompanySetting,
    CostCenter,
    Department,
    Discrepancy,
    EmailSetting,
    Material,
    MaterialReceiving,
    MaterialReceivingLineItem,
    MaterialTransfer,
    MaterialTransferLineItem,
    MB52UploadHistory,
    MRF,
    MRFLineItem,
    Plant,
    Project,
    Stock,
    StockIssueMovement,
    StorageLocation,
    User,
    Warehouse,
    WbsElement,
)

router = APIRouter(prefix="/admin-tools", tags=["admin-tools"])

MODULE_TABLES = {
    "company": [Plant, StorageLocation, Warehouse, Project, WbsElement, Department, CostCenter, User],
    "plants": [Plant],
    "storage_locations": [StorageLocation],
    "warehouses": [Warehouse],
    "projects": [Project],
    "wbs_elements": [WbsElement],
    "departments": [Department],
    "cost_centers": [CostCenter],
    "users": [User],
    "materials": [Material],
    "stock": [Stock, MB52UploadHistory, Discrepancy],
    "mrf": [MRF, MRFLineItem, StockIssueMovement],
    "receiving": [MaterialReceiving, MaterialReceivingLineItem],
    "transfer": [MaterialTransfer, MaterialTransferLineItem],
    "reports": [AuditTrail, Cancellation],
    "all": [
        Plant,
        StorageLocation,
        Warehouse,
        Project,
        WbsElement,
        Department,
        CostCenter,
        User,
        Material,
        Stock,
        MB52UploadHistory,
        Discrepancy,
        MRF,
        MRFLineItem,
        StockIssueMovement,
        MaterialReceiving,
        MaterialReceivingLineItem,
        MaterialTransfer,
        MaterialTransferLineItem,
        Cancellation,
        AuditTrail,
        Attachment,
        EmailSetting,
        CompanySetting,
    ],
}


def _normalize_export_value(value: Any) -> Any:
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _normalize_import_value(column, value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.to_pydatetime()
    
    from sqlalchemy import String, Text
    if isinstance(column.type, (String, Text)):
        if isinstance(value, float):
            if value.is_integer():
                value = int(value)
        value = str(value).strip()
        if value.endswith(".0"):
            value = value[:-2]
        if value == "None" or value == "":
            return None
        return value

    if isinstance(value, str):
        value = value.strip()
        if value == "":
            return None
    if isinstance(column.type, JSON) and isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            return value
    return value


def _get_models(module_key: str):
    models = MODULE_TABLES.get(module_key)
    if not models:
        raise HTTPException(status_code=404, detail="Unsupported module export/import key")
    return models


def _restricted_user_dataset(module_key: str, current_user: User):
    company_keys = {
        "company", "all", "plants", "storage_locations", "warehouses", 
        "projects", "wbs_elements", "departments", "cost_centers", "users"
    }
    if module_key in company_keys and current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Only Admin can export or import user and company master datasets.")


def _delete_models(db: Session, models: list[type]):
    for model in reversed(models):
        db.query(model).delete()


@router.get("/export/{module_key}")
def export_module_data(
    module_key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager", "Warehouse Supervisor"])),
):
    _restricted_user_dataset(module_key, current_user)
    models = _get_models(module_key)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_name = f"{module_key}_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    file_path = os.path.join(settings.UPLOAD_DIR, file_name)

    with pd.ExcelWriter(file_path, engine="openpyxl") as writer:
        summary_rows = []
        for model in models:
            rows = db.query(model).all()
            columns = [column.name for column in model.__table__.columns if not (model is User and column.name == "hashed_password")]
            sheet_rows = []
            for row in rows:
                sheet_rows.append({column: _normalize_export_value(getattr(row, column)) for column in columns})
            pd.DataFrame(sheet_rows, columns=columns).to_excel(writer, sheet_name=model.__tablename__[:31], index=False)
            summary_rows.append({"sheet": model.__tablename__, "records": len(sheet_rows)})

        pd.DataFrame(summary_rows).to_excel(writer, sheet_name="summary", index=False)

    audit = AuditTrail(
        user_id=current_user.id,
        username=current_user.username,
        action="Data Export",
        remarks=f"Exported module '{module_key}' to workbook {file_name}",
    )
    db.add(audit)
    db.commit()

    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=file_name,
    )


@router.post("/import/{module_key}")
def import_module_data(
    module_key: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"])),
):
    _restricted_user_dataset(module_key, current_user)
    models = _get_models(module_key)
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Please upload an Excel workbook (.xlsx or .xls)")

    workbook = pd.read_excel(file.file, sheet_name=None)
    expected_sheets = {model.__tablename__[:31]: model for model in models}
    preserved_admin_payload = None

    if User in models:
        current_admin = db.query(User).filter(User.id == current_user.id).first()
        if current_admin:
            preserved_admin_payload = {column.name: getattr(current_admin, column.name) for column in User.__table__.columns}

    missing = [sheet for sheet in expected_sheets if sheet not in workbook]
    if missing:
        raise HTTPException(status_code=400, detail=f"Workbook is missing expected sheet(s): {', '.join(missing)}")

    _delete_models(db, models)

    imported_counts: dict[str, int] = {}
    for sheet_name, model in expected_sheets.items():
        df = workbook[sheet_name]
        df = df.where(pd.notnull(df), None)
        columns = {column.name: column for column in model.__table__.columns}
        imported_counts[sheet_name] = 0

        for row in df.to_dict(orient="records"):
            payload = {}
            for key, value in row.items():
                if key not in columns:
                    continue
                payload[key] = _normalize_import_value(columns[key], value)
            if model is User:
                payload["hashed_password"] = get_password_hash("Temp@12345")
                payload["is_active"] = bool(payload.get("is_active", True))
            db.add(model(**payload))
            imported_counts[sheet_name] += 1

    if preserved_admin_payload and not db.query(User).filter(User.username == preserved_admin_payload["username"]).first():
        db.add(User(**preserved_admin_payload))
        imported_counts["users_preserved_admin"] = 1

    db.commit()

    audit = AuditTrail(
        user_id=current_user.id,
        username=current_user.username,
        action="Data Import",
        remarks=f"Imported module '{module_key}' from workbook {file.filename}",
        new_value=imported_counts,
    )
    db.add(audit)
    db.commit()

    return {"message": f"Imported module '{module_key}' successfully.", "imported": imported_counts}


@router.post("/reset")
def reset_application_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin"])),
):
    preserved_email = db.query(EmailSetting).filter(EmailSetting.id == 1).first()
    preserved_company = db.query(CompanySetting).filter(CompanySetting.id == 1).first()
    current_admin_id = current_user.id

    models_to_clear = [
        Attachment,
        AuditTrail,
        Cancellation,
        MaterialTransferLineItem,
        MaterialTransfer,
        MaterialReceivingLineItem,
        MaterialReceiving,
        StockIssueMovement,
        MRFLineItem,
        MRF,
        Discrepancy,
        MB52UploadHistory,
        Stock,
        Material,
        WbsElement,
        CostCenter,
        Department,
        Warehouse,
        StorageLocation,
        Plant,
        Project,
    ]

    for model in models_to_clear:
        db.query(model).delete()

    db.query(User).filter(User.id != current_admin_id).delete()
    db.commit()

    if preserved_email:
        existing_email = db.query(EmailSetting).filter(EmailSetting.id == 1).first()
        if not existing_email:
            db.add(EmailSetting(**{c.name: getattr(preserved_email, c.name) for c in EmailSetting.__table__.columns}))

    if preserved_company:
        existing_company = db.query(CompanySetting).filter(CompanySetting.id == 1).first()
        if not existing_company:
            db.add(CompanySetting(**{c.name: getattr(preserved_company, c.name) for c in CompanySetting.__table__.columns}))

    current_admin = db.query(User).filter(User.id == current_admin_id).first()
    if current_admin:
        current_admin.is_active = True

    audit = AuditTrail(
        user_id=current_user.id,
        username=current_user.username,
        action="Application Reset",
        remarks="Admin reset application data while preserving current admin and system settings",
    )
    db.add(audit)
    db.commit()

    return {"message": "Application data reset completed. Current admin and settings were preserved."}


@router.get("/template/{module_key}")
def download_module_template(
    module_key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    models = _get_models(module_key)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_name = f"{module_key}_template.xlsx"
    file_path = os.path.join(settings.UPLOAD_DIR, file_name)

    # Generate dummy sample values for columns based on name/type
    def get_dummy_value(column_name, column_type):
        col_lower = column_name.lower()
        if col_lower == "id":
            return 1
        if "email" in col_lower:
            return "sample@example.com"
        if "phone" in col_lower or "mobile" in col_lower:
            return "+966551234567"
        if any(w in col_lower for w in ("qty", "quantity", "amount", "value", "port")):
            return 10.0
        if "date" in col_lower or "time" in col_lower:
            return datetime.now().strftime("%Y-%m-%d")
        if "status" in col_lower:
            return "Active"
        return "Sample Text"

    with pd.ExcelWriter(file_path, engine="openpyxl") as writer:
        for model in models:
            columns = [column.name for column in model.__table__.columns if not (model is User and column.name == "hashed_password")]
            # Put 1 row of dummy sample data so the sheet has columns and a guide row
            sample_row = {}
            for col_name in columns:
                col_obj = model.__table__.columns.get(col_name)
                col_type = col_obj.type if col_obj is not None else None
                sample_row[col_name] = get_dummy_value(col_name, col_type)
            pd.DataFrame([sample_row], columns=columns).to_excel(writer, sheet_name=model.__tablename__[:31], index=False)

    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=file_name,
    )
