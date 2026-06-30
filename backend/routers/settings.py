from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from backend.database import get_db
from backend.models import EmailSetting, AuditTrail, User, CompanySetting
from backend.schemas import EmailSettingCreate, EmailSettingResponse, AuditTrailResponse, CompanySettingCreate, CompanySettingResponse
from backend.auth import get_current_user, RoleChecker
from backend.utils.email_sender import test_smtp_connection, send_email_notification

router = APIRouter(prefix="/settings", tags=["settings"])

def ensure_company_settings(db: Session) -> CompanySetting:
    settings = db.query(CompanySetting).filter(CompanySetting.id == 1).first()
    if not settings:
        settings = CompanySetting(
            id=1,
            company_name="WAREHOUSE",
            address="",
            plant="",
            currency="USD",
            location="",
            calendar=""
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.get("/email", response_model=EmailSettingResponse)
def get_email_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    settings = db.query(EmailSetting).filter(EmailSetting.id == 1).first()
    if not settings:
        # Create default settings
        settings = EmailSetting(id=1, ssl_tls=True, email_approval_enabled=False)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.post("/email", response_model=EmailSettingResponse)
def update_email_settings(
    settings_in: EmailSettingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    settings = db.query(EmailSetting).filter(EmailSetting.id == 1).first()
    if not settings:
        settings = EmailSetting(id=1)
        db.add(settings)
        
    for field, value in settings_in.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
        
    db.commit()
    db.refresh(settings)
    
    # Audit log
    audit = AuditTrail(
        user_id=current_user.id,
        username=current_user.username,
        action="Email Config Updated",
        remarks="Updated SMTP/IMAP configurations"
    )
    db.add(audit)
    db.commit()
    
    return settings

@router.post("/email/test")
def test_email_settings(
    settings_in: EmailSettingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    """
    Test connection with provided settings and send a test email if successful.
    """
    success, msg = test_smtp_connection(settings_in.model_dump())
    if not success:
        return {"success": False, "message": msg}
        
    # Attempt to send test email if sender email is provided
    if settings_in.sender_email:
        # Save settings temporarily to test
        temp_settings = db.query(EmailSetting).filter(EmailSetting.id == 1).first()
        if not temp_settings:
            temp_settings = EmailSetting(id=1)
            db.add(temp_settings)
            
        old_vals = {}
        for field, value in settings_in.model_dump().items():
            old_vals[field] = getattr(temp_settings, field)
            setattr(temp_settings, field, value)
        db.commit()
        
        test_sent = send_email_notification(
            subject="Test Email - Warehouse System",
            body="If you receive this, the email configuration test was successful!",
            recipient_email=settings_in.sender_email,
            db=db
        )
        
        # Restore old settings
        for field, value in old_vals.items():
            setattr(temp_settings, field, value)
        db.commit()
        
        if test_sent:
            return {"success": True, "message": "SMTP Connection test successful! Test email sent to " + settings_in.sender_email}
        else:
            return {"success": False, "message": "SMTP connection succeeded, but test email sending failed."}
            
    return {"success": True, "message": "SMTP Connection test successful!"}

@router.get("/audit", response_model=List[AuditTrailResponse])
def get_audit_trail(db: Session = Depends(get_db), current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))):
    return db.query(AuditTrail).order_by(AuditTrail.timestamp.desc()).all()

@router.get("/company", response_model=CompanySettingResponse)
def get_company_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return ensure_company_settings(db)

@router.get("/company/public", response_model=CompanySettingResponse)
def get_public_company_settings(db: Session = Depends(get_db)):
    return ensure_company_settings(db)

@router.post("/company", response_model=CompanySettingResponse)
def update_company_settings(
    settings_in: CompanySettingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    settings = db.query(CompanySetting).filter(CompanySetting.id == 1).first()
    if not settings:
        settings = CompanySetting(id=1)
        db.add(settings)
        
    for field, value in settings_in.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
        
    db.commit()
    db.refresh(settings)
    
    # Audit log
    audit = AuditTrail(
        user_id=current_user.id,
        username=current_user.username,
        action="Company Profile Updated",
        remarks=f"Updated company details (Name: {settings.company_name})"
    )
    db.add(audit)
    db.commit()
    
    return settings
