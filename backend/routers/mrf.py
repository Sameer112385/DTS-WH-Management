from fastapi import APIRouter, Depends, HTTPException, status, Response, Form, Query
from fastapi.responses import FileResponse
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from html import escape
import os
from typing import List, Optional
from backend.database import get_db
from backend.models import (
    MRF, MRFLineItem, Stock, Material, User,
    AuditTrail, Plant, Warehouse, Project, Department, CostCenter, StockIssueMovement, EmailSetting, MRFActionLog, CompanySetting
)
from backend.schemas import MRFCreate, MRFUpdate, MRFResponse, DirectIssueCreate
from backend.auth import get_current_user, RoleChecker, create_access_token
from backend.utils.pdf_generator import generate_mrf_pdf
from backend.utils.email_sender import send_email_notification
from backend.config import settings
from jose import jwt, JWTError

router = APIRouter(prefix="/mrf", tags=["mrf"])
NON_PROJECT_CODE = "NON_PROJECT"

# Helper to generate unique MRF ref
def generate_mrf_ref(db: Session) -> str:
    today = datetime.now().strftime("%Y%m%d")
    prefix = f"MRF-{today}-"
    # Find matching ref for today
    count = db.query(MRF).filter(MRF.reference_number.like(f"{prefix}%")).count()
    serial = str(count + 1).zfill(4)
    return f"{prefix}{serial}"

def generate_direct_issue_ref(db: Session) -> str:
    today = datetime.now().strftime("%Y%m%d")
    prefix = f"DIR-{today}-"
    count = db.query(MRF).filter(MRF.reference_number.like(f"{prefix}%")).count()
    serial = str(count + 1).zfill(4)
    return f"{prefix}{serial}"

def resolve_account_assignment(
    db: Session,
    issue_account_type: Optional[str],
    project_code: Optional[str],
    cost_center_code: Optional[str]
):
    issue_type = (issue_account_type or "project").strip().lower()
    if issue_type not in ("project", "cost_center"):
        raise HTTPException(status_code=400, detail="issue_account_type must be either 'project' or 'cost_center'")

    if issue_type == "project":
        if not project_code:
            raise HTTPException(status_code=400, detail="project_code is required for project-based issuance")
        return issue_type, project_code, None

    if not cost_center_code:
        raise HTTPException(status_code=400, detail="cost_center_code is required for cost center-based issuance")

    cost_center = db.query(CostCenter).filter(CostCenter.code == cost_center_code).first()
    if not cost_center:
        raise HTTPException(status_code=404, detail="Cost center not found")

    placeholder = db.query(Project).filter(Project.code == NON_PROJECT_CODE).first()
    if not placeholder:
        placeholder = Project(
            code=NON_PROJECT_CODE,
            name="Non-Project Issues",
            description="System placeholder project for cost center-based issues"
        )
        db.add(placeholder)
        db.commit()

    return issue_type, NON_PROJECT_CODE, cost_center_code


def email_notifications_enabled(db: Session) -> bool:
    email_settings = db.query(EmailSetting).filter(EmailSetting.id == 1).first()
    return bool(email_settings and email_settings.email_approval_enabled)


def notify_emails(db: Session, recipients: list[str], subject: str, body: str):
    for email in {email.strip() for email in recipients if email and email.strip()}:
        send_email_notification(subject=subject, body=body, recipient_email=email, db=db)


def notify_role_users(db: Session, roles: list[str], subject: str, body: str):
    recipients = [
        user.email for user in db.query(User).filter(User.role.in_(roles), User.is_active == True).all()
        if user.email
    ]
    notify_emails(db, recipients, subject, body)


def create_email_action_token(mrf: MRF, recipient_email: str, role: str) -> str:
    return create_access_token(
        {
            "sub": f"email-action:{mrf.id}:{recipient_email}",
            "mrf_id": mrf.id,
            "email": recipient_email,
            "role": role,
            "kind": "mrf_email_action"
        },
        expires_delta=timedelta(hours=settings.EMAIL_ACTION_TOKEN_EXPIRE_HOURS)
    )


def decode_email_action_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired email action token")
    if payload.get("kind") != "mrf_email_action":
        raise HTTPException(status_code=401, detail="Invalid email action token")
    return payload


def build_email_action_links(mrf: MRF, recipient_email: str, role: str) -> str:
    token = create_email_action_token(mrf, recipient_email, role)
    base = f"{settings.PUBLIC_BASE_URL}{settings.API_V1_STR}/mrf/email-action"
    links = {
        "Approve": f"{base}?token={token}&action=approve",
        "Reject": f"{base}?token={token}&action=reject",
        "Send Back": f"{base}?token={token}&action=send_back",
    }
    return "\n".join([f"{label}: {url}" for label, url in links.items()])


def build_email_action_links_html(mrf: MRF, recipient_email: str, role: str) -> str:
    token = create_email_action_token(mrf, recipient_email, role)
    base = f"{settings.PUBLIC_BASE_URL}{settings.API_V1_STR}/mrf/email-action"
    links = {
        "Approve": f"{base}?token={token}&action=approve",
        "Reject": f"{base}?token={token}&action=reject",
        "Send Back": f"{base}?token={token}&action=send_back",
    }
    button_style = (
        "display:inline-block;padding:10px 16px;margin-right:8px;border-radius:6px;"
        "text-decoration:none;font-weight:600;color:#ffffff;"
    )
    colors = {
        "Approve": "#16a34a",
        "Reject": "#dc2626",
        "Send Back": "#d97706",
    }
    return "".join(
        [
            f"<a href=\"{escape(url)}\" style=\"{button_style}background:{colors[label]};\">{escape(label)}</a>"
            for label, url in links.items()
        ]
    )


def resolve_email_action_user(db: Session, payload: dict) -> User:
    email = payload.get("email")
    role = payload.get("role")
    user = db.query(User).filter(User.email == email, User.role == role, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=404, detail="No active approver account matches this email action link")
    return user


def build_mrf_email_body(mrf: MRF) -> str:
    issue_target = f"Cost Center {mrf.cost_center_code}" if mrf.issue_account_type == "cost_center" else f"Project {mrf.project_code}"
    lines = [
        f"MRF Reference: {mrf.reference_number}",
        f"Status: {mrf.status}",
        f"Request Date: {mrf.date}",
        f"Requestor: {mrf.requested_by_name}",
        f"Staff / Mobile: {mrf.staff_mobile or 'N/A'}",
        f"Department ID: {mrf.department_id or 'N/A'}",
        f"Issue Target: {issue_target}",
        f"Default WBS: {mrf.wbs_code or 'N/A'}",
        f"Warehouse ID: {mrf.requested_from_warehouse_id or 'N/A'}",
        f"Purpose: {mrf.purpose or 'N/A'}",
        f"Location: {mrf.location or 'N/A'}",
        f"Warehouse POC: {mrf.warehouse_poc_name or 'N/A'} / {mrf.warehouse_poc_mobile or 'N/A'}",
        f"Additional POC: {mrf.additional_poc_name or 'N/A'} / {mrf.additional_poc_mobile or 'N/A'}",
        f"Requestor Manager: {mrf.requestor_manager_name or 'N/A'} / {mrf.requestor_manager_email or 'N/A'}",
        f"Project Manager: {mrf.project_manager_name or 'N/A'} / {mrf.project_manager_email or 'N/A'}",
        f"Reference PR: {mrf.reference_pr or 'N/A'}",
        f"Reference PO: {mrf.reference_po or 'N/A'}",
        f"Comments: {mrf.comments or 'N/A'}",
        "",
        "Requested Materials:"
    ]
    for line in mrf.line_items:
        lines.append(
            f"- SN {line.sn}: {line.material_code} | {line.description} | UOM {line.uom} | "
            f"Requested {line.requested_qty} | Approved {line.approved_qty} | Issued {line.issued_qty} | "
            f"WBS {line.wbs_code or mrf.wbs_code or 'N/A'}"
        )
    if mrf.last_action_comment:
        lines.extend(["", f"Latest Review Note: {mrf.last_action_comment}"])
    if any([mrf.vehicle_number, mrf.driver_name, mrf.transport_company, mrf.receiver_name, mrf.delivery_location]):
        lines.extend([
            "",
            "Dispatch Details:",
            f"Vehicle: {mrf.vehicle_number or 'N/A'} / {mrf.vehicle_type or 'N/A'}",
            f"Driver: {mrf.driver_name or 'N/A'} / {mrf.driver_mobile or 'N/A'} / {mrf.driver_iqama or 'N/A'}",
            f"Transport Company: {mrf.transport_company or 'N/A'}",
            f"Receiver: {mrf.receiver_name or 'N/A'} / {mrf.receiver_mobile or 'N/A'}",
            f"Delivery Location: {mrf.delivery_location or mrf.location or 'N/A'}",
        ])
    return "\n".join(lines)


def notify_mrf_stakeholders(db: Session, mrf: MRF, subject: str):
    notify_emails(
        db,
        [mrf.requestor_manager_email or "", mrf.project_manager_email or ""],
        subject,
        build_mrf_email_body(mrf)
    )


def build_email_reply_actions_html(mrf: MRF, sender_email: str) -> str:
    import urllib.parse
    subject = f"Re: MRF Approval Required: {mrf.reference_number}"
    approve_href = f"mailto:{sender_email}?subject={urllib.parse.quote(subject)}&body={urllib.parse.quote('APPROVED')}"
    reject_href = f"mailto:{sender_email}?subject={urllib.parse.quote(subject)}&body={urllib.parse.quote('REJECTED')}"
    sendback_href = f"mailto:{sender_email}?subject={urllib.parse.quote(subject)}&body={urllib.parse.quote('SEND_BACK')}"
    
    button_style = (
        "display:inline-block;padding:10px 16px;margin-right:8px;border-radius:6px;"
        "text-decoration:none;font-weight:600;color:#ffffff;font-size:14px;"
    )
    return f"""
    <div style="margin-top:16px;padding:16px;border:1px dashed #cbd5e1;border-radius:10px;background:#f8fafc;">
      <div style="font-weight:700;margin-bottom:8px;color:#334155;font-size:14px;">Local / Offline Email Actions (For Local Laptop Run)</div>
      <p style="margin:0 0 12px 0;color:#64748b;font-size:13px;">
        Since the web application is running locally on your laptop, online links may not load on your phone/external device.
        Click one of the options below to draft a reply email to the system to approve or reject this request:
      </p>
      <div>
        <a href="{approve_href}" style="{button_style}background:#16a34a;">Approve via Email Reply</a>
        <a href="{reject_href}" style="{button_style}background:#dc2626;">Reject via Email Reply</a>
        <a href="{sendback_href}" style="{button_style}background:#d97706;">Send Back via Email Reply</a>
      </div>
    </div>
    """

def build_mrf_email_message(mrf: MRF, intro: str, recipient_email: Optional[str] = None, role: Optional[str] = None) -> str:
    escaped_intro = escape(intro)
    escaped_body = escape(build_mrf_email_body(mrf))
    
    # Try fetching sender email for mailto reply link
    from backend.database import SessionLocal
    from backend.models import EmailSetting
    sender_email = None
    db_session = SessionLocal()
    try:
        es = db_session.query(EmailSetting).filter(EmailSetting.id == 1).first()
        if es:
            sender_email = es.sender_email
    except Exception:
        pass
    finally:
        db_session.close()

    action_html = ""
    if recipient_email and role:
        reply_actions = ""
        if sender_email:
            reply_actions = build_email_reply_actions_html(mrf, sender_email)
            
        action_html = f"""
        <div style="margin-top:18px;padding:16px;border:1px solid #d6d3ff;border-radius:10px;background:#f8f7ff;">
          <div style="font-weight:700;margin-bottom:12px;">Email Actions</div>
          <div>{build_email_action_links_html(mrf, recipient_email, role)}</div>
          <p style="margin:12px 0 0 0;color:#475569;font-size:13px;">
            These links are time-limited and open a review page where the approver can confirm the decision and add notes.
          </p>
          {reply_actions}
        </div>
        """
    return f"""
    <html>
      <body style="font-family:Segoe UI, Arial, sans-serif;color:#0f172a;line-height:1.5;">
        <p style="font-size:15px;margin-bottom:12px;">{escaped_intro}</p>
        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:16px;background:#ffffff;">
          <pre style="white-space:pre-wrap;font-family:Consolas, monospace;font-size:13px;margin:0;">{escaped_body}</pre>
        </div>
        {action_html}
      </body>
    </html>
    """


def render_email_action_page(mrf: MRF, action: str, approver: User, token: str) -> str:
    action_labels = {
        "approve": "Approve",
        "reject": "Reject",
        "send_back": "Send Back",
    }
    selected_label = action_labels[action]
    details = escape(build_mrf_email_body(mrf))
    return f"""
    <html>
      <head>
        <title>MRF Email Approval</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style="margin:0;background:#0f172a;font-family:Segoe UI, Arial, sans-serif;color:#e2e8f0;">
        <div style="max-width:900px;margin:32px auto;padding:24px;">
          <div style="background:#111c31;border:1px solid #23314f;border-radius:18px;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,0.35);">
            <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;">
              <div>
                <div style="font-size:28px;font-weight:800;margin-bottom:8px;">MRF Email Action</div>
                <div style="font-size:15px;color:#94a3b8;">Reference {escape(mrf.reference_number)} | Current Status: {escape(mrf.status)}</div>
              </div>
              <div style="padding:8px 12px;border-radius:999px;background:#1e293b;color:#cbd5e1;font-size:13px;">
                Approver: {escape(approver.name)} ({escape(approver.role)})
              </div>
            </div>

            <div style="margin-top:20px;padding:16px;border-radius:12px;background:#1e293b;border:1px solid #334155;">
              <div style="font-weight:700;font-size:16px;margin-bottom:8px;">Selected Action: {selected_label}</div>
              <div style="color:#94a3b8;font-size:14px;">Review the full MRF details below, add a note if needed, and confirm your decision.</div>
            </div>

            <form method="post" action="{settings.API_V1_STR}/mrf/email-action/submit" style="margin-top:20px;">
              <input type="hidden" name="token" value="{escape(token)}" />
              <input type="hidden" name="action" value="{escape(action)}" />
              <div style="margin-bottom:16px;">
                <label style="display:block;font-size:14px;font-weight:600;margin-bottom:8px;">Decision Note</label>
                <textarea
                  name="comments"
                  rows="4"
                  placeholder="Add approval note or required correction details"
                  style="width:100%;box-sizing:border-box;border-radius:12px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;padding:12px;font-size:14px;"
                ></textarea>
              </div>

              <div style="border:1px solid #334155;border-radius:12px;padding:16px;background:#0b1220;">
                <pre style="white-space:pre-wrap;font-family:Consolas, monospace;font-size:13px;margin:0;color:#e2e8f0;">{details}</pre>
              </div>

              <div style="margin-top:20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                <button
                  type="submit"
                  style="border:none;border-radius:10px;padding:12px 18px;font-weight:700;cursor:pointer;background:{'#16a34a' if action == 'approve' else '#dc2626' if action == 'reject' else '#d97706'};color:#ffffff;"
                >
                  Confirm {selected_label}
                </button>
                <span style="font-size:13px;color:#94a3b8;">This action will be recorded in the MRF approval history.</span>
              </div>
            </form>
          </div>
        </div>
      </body>
    </html>
    """


def log_mrf_action(db: Session, mrf: MRF, action: str, old_status: str, actor: User, source: str, comment: Optional[str]):
    db.add(MRFActionLog(
        mrf_id=mrf.id,
        action=action,
        from_status=old_status,
        to_status=mrf.status,
        actor_name=actor.name,
        actor_role=actor.role,
        actor_email=actor.email,
        comment=comment,
        source=source
    ))


def process_mrf_action(
    mrf: MRF,
    update: MRFUpdate,
    db: Session,
    current_user: User,
    source: str = "app"
) -> MRF:
    old_status = mrf.status
    role = current_user.role
    action = (update.action or "approve").strip().lower()
    decision_actions = {"approve", "reject", "send_back", "resubmit", "cancel"}

    if action not in decision_actions:
        raise HTTPException(status_code=400, detail="Invalid action. Use approve, reject, send_back, resubmit, or cancel.")

    if action == "cancel":
        if mrf.status in ("Issued", "Cancelled", "Rejected"):
            raise HTTPException(status_code=400, detail=f"Cannot cancel request in '{mrf.status}' status.")
        mrf.status = "Cancelled"
        mrf.last_action_comment = (update.comments or "").strip() or "Cancelled by user"
        mrf.last_action_by = update.approver_name or current_user.name
        mrf.last_action_at = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(mrf)
        log_mrf_action(db, mrf, "cancel", old_status, current_user, source, mrf.last_action_comment)
        
        audit = AuditTrail(
            user_id=current_user.id,
            username=current_user.username,
            action="MRF Cancelled",
            remarks=f"MRF {mrf.reference_number} was cancelled by {current_user.name}"
        )
        db.add(audit)
        db.commit()
        db.refresh(mrf)
        return mrf

    if action in {"approve", "reject", "send_back"} and not update.signature:
        raise HTTPException(status_code=400, detail="Signature is required for this decision.")

    if action in {"reject", "send_back", "resubmit"} and not (update.comments or "").strip():
        raise HTTPException(status_code=400, detail="Comments are required for reject, send back, and resubmit actions.")

    mrf.last_action_comment = (update.comments or "").strip() or None
    mrf.last_action_by = update.approver_name or current_user.name
    mrf.last_action_at = datetime.now(timezone.utc)

    if mrf.status == "Pending Requestor Manager Approval":
        if role not in ["Requestor Manager", "Admin"]:
            raise HTTPException(status_code=403, detail="Only Requestor Manager can process this stage")
        mrf.requestor_manager_name = update.approver_name or current_user.name
        if action == "approve":
            mrf.requestor_manager_signature = update.signature
            mrf.status = "Pending Warehouse Supervisor Check"
            if email_notifications_enabled(db):
                for user in db.query(User).filter(User.role.in_(["Warehouse Supervisor", "Admin"]), User.is_active == True).all():
                    if user.email:
                        send_email_notification(
                            f"MRF Supervisor Check Required: {mrf.reference_number}",
                            build_mrf_email_message(mrf, "MRF is ready for Warehouse Supervisor stock check.", user.email, user.role),
                            user.email,
                            db
                        )
        elif action == "reject":
            mrf.requestor_manager_signature = update.signature
            mrf.status = "Rejected"
            if email_notifications_enabled(db):
                notify_mrf_stakeholders(db, mrf, f"MRF Rejected: {mrf.reference_number}")
        elif action == "send_back":
            mrf.requestor_manager_signature = update.signature
            mrf.status = "Sent Back to Requestor"
            if email_notifications_enabled(db):
                notify_mrf_stakeholders(db, mrf, f"MRF Sent Back: {mrf.reference_number}")
        else:
            raise HTTPException(status_code=400, detail="Resubmit is not valid at this stage.")

    elif mrf.status == "Pending Warehouse Supervisor Check":
        if role not in ["Warehouse Supervisor", "Admin"]:
            raise HTTPException(status_code=403, detail="Only Warehouse Supervisor can process this stage")
        if update.approved_quantities:
            for line in mrf.line_items:
                line_id_str = str(line.id)
                if line_id_str in update.approved_quantities:
                    line.approved_qty = float(update.approved_quantities[line_id_str])
        mrf.supervisor_name = update.approver_name or current_user.name
        if action == "approve":
            mrf.supervisor_signature = update.signature
            mrf.status = "Pending Warehouse Manager Approval"
            if email_notifications_enabled(db):
                for user in db.query(User).filter(User.role.in_(["Warehouse Manager", "Admin"]), User.is_active == True).all():
                    if user.email:
                        send_email_notification(
                            f"MRF Manager Approval Required: {mrf.reference_number}",
                            build_mrf_email_message(mrf, "MRF is ready for Warehouse Manager approval.", user.email, user.role),
                            user.email,
                            db
                        )
        elif action == "reject":
            mrf.supervisor_signature = update.signature
            mrf.status = "Rejected"
            if email_notifications_enabled(db):
                notify_mrf_stakeholders(db, mrf, f"MRF Rejected: {mrf.reference_number}")
        elif action == "send_back":
            mrf.supervisor_signature = update.signature
            mrf.status = "Pending Requestor Manager Approval"
            if email_notifications_enabled(db):
                send_email_notification(
                    f"MRF Returned to Requestor Manager: {mrf.reference_number}",
                    build_mrf_email_message(mrf, "MRF was sent back and needs Requestor Manager review again.", mrf.requestor_manager_email, "Requestor Manager"),
                    mrf.requestor_manager_email,
                    db
                )
        else:
            raise HTTPException(status_code=400, detail="Resubmit is not valid at this stage.")

    elif mrf.status == "Pending Warehouse Manager Approval":
        if role not in ["Warehouse Manager", "Admin"]:
            raise HTTPException(status_code=403, detail="Only Warehouse Manager can process this stage")
        mrf.manager_name = update.approver_name or current_user.name
        if action == "approve":
            mrf.manager_signature = update.signature
            mrf.status = "Ready to Issue"
        elif action == "reject":
            mrf.manager_signature = update.signature
            mrf.status = "Rejected"
            if email_notifications_enabled(db):
                notify_mrf_stakeholders(db, mrf, f"MRF Rejected: {mrf.reference_number}")
        elif action == "send_back":
            mrf.manager_signature = update.signature
            mrf.status = "Pending Warehouse Supervisor Check"
            if email_notifications_enabled(db):
                for user in db.query(User).filter(User.role.in_(["Warehouse Supervisor", "Admin"]), User.is_active == True).all():
                    if user.email:
                        send_email_notification(
                            f"MRF Returned to Supervisor: {mrf.reference_number}",
                            build_mrf_email_message(mrf, "MRF was sent back by Warehouse Manager.", user.email, user.role),
                            user.email,
                            db
                        )
        else:
            raise HTTPException(status_code=400, detail="Resubmit is not valid at this stage.")

    elif mrf.status == "Ready to Issue":
        if role not in ["Warehouse Worker", "Warehouse Supervisor", "Warehouse Manager", "Admin"]:
            raise HTTPException(status_code=403, detail="Only Warehouse staff can process issuance")
        if action == "send_back":
            mrf.status = "Pending Warehouse Manager Approval"
        elif action == "reject":
            mrf.status = "Rejected"
            if email_notifications_enabled(db):
                notify_mrf_stakeholders(db, mrf, f"MRF Rejected Before Issue: {mrf.reference_number}")
        elif action != "approve":
            raise HTTPException(status_code=400, detail="Only approve is valid for issuing materials.")

        if action in {"send_back", "reject"}:
            db.commit()
            db.refresh(mrf)
            log_mrf_action(db, mrf, action, old_status, current_user, source, mrf.last_action_comment)
            audit = AuditTrail(
                user_id=current_user.id,
                username=current_user.username,
                action="MRF Approved/Updated",
                remarks=f"MRF {mrf.reference_number} transitioned from '{old_status}' to '{mrf.status}' via action '{action}'"
            )
            db.add(audit)
            db.commit()
            db.refresh(mrf)
            return mrf

        if not update.vehicle_number or not update.driver_name or not update.driver_mobile or not update.driver_iqama or not update.transport_company or not update.receiver_name or not update.receiver_mobile:
            raise HTTPException(
                status_code=400,
                detail="Driver details, vehicle number, iqama number, transport company, and receiver details are required before material issuance confirmation."
            )
        mrf.vehicle_number = update.vehicle_number
        mrf.vehicle_type = update.vehicle_type
        mrf.driver_name = update.driver_name
        mrf.driver_mobile = update.driver_mobile
        mrf.driver_iqama = update.driver_iqama
        mrf.transport_company = update.transport_company
        mrf.receiver_name = update.receiver_name
        mrf.receiver_mobile = update.receiver_mobile
        mrf.delivery_location = update.delivery_location or mrf.location
        mrf.worker_name = current_user.name
        mrf.worker_signature = update.signature
        mrf.driver_signature = update.signature
        mrf.receiver_signature = update.signature
        allow_negative_stock = False
        for line in mrf.line_items:
            if line.approved_qty <= 0:
                continue
            if update.issuing_stock_selections and str(line.id) in update.issuing_stock_selections and update.issuing_stock_selections[str(line.id)]:
                selected_stock_id = int(update.issuing_stock_selections[str(line.id)])
                stock = db.query(Stock).filter(Stock.id == selected_stock_id).first()
                if not stock or stock.material_code != line.material_code:
                    raise HTTPException(status_code=400, detail=f"Invalid stock selection for material {line.material_code}")
                stocks = [stock]
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Storage location stock selection is required for material {line.material_code}."
                )
            needed = line.approved_qty
            if needed <= 0:
                continue
            total_avail = sum([s.available_qty for s in stocks])
            if total_avail < needed and not allow_negative_stock:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for material {line.material_code}. Needed {needed}, available {total_avail}.")
            remaining = needed
            for stock in stocks:
                if remaining <= 0:
                    break
                if stock.available_qty >= remaining:
                    avg_value_per_unit = stock.stock_value / stock.available_qty if stock.available_qty > 0 else 0
                    moved_qty = remaining
                    moved_value = remaining * avg_value_per_unit
                    stock.available_qty -= remaining
                    stock.stock_value -= moved_value
                    line.issued_qty += remaining
                    line.plant_code = stock.plant_code
                    line.storage_location_code = stock.storage_location_code
                    db.add(StockIssueMovement(
                        mrf_id=mrf.id, mrf_line_item_id=line.id, stock_id=stock.id,
                        material_code=line.material_code, plant_code=stock.plant_code,
                        storage_location_code=stock.storage_location_code, wbs_code=stock.wbs_code,
                        quantity=moved_qty, stock_value=moved_value
                    ))
                    remaining = 0
                else:
                    avg_value_per_unit = stock.stock_value / stock.available_qty if stock.available_qty > 0 else 0
                    moved_qty = stock.available_qty
                    moved_value = moved_qty * avg_value_per_unit
                    remaining -= moved_qty
                    line.issued_qty += moved_qty
                    line.plant_code = stock.plant_code
                    line.storage_location_code = stock.storage_location_code
                    db.add(StockIssueMovement(
                        mrf_id=mrf.id, mrf_line_item_id=line.id, stock_id=stock.id,
                        material_code=line.material_code, plant_code=stock.plant_code,
                        storage_location_code=stock.storage_location_code, wbs_code=stock.wbs_code,
                        quantity=moved_qty, stock_value=moved_value
                    ))
                    stock.available_qty = 0.0
                    stock.stock_value = 0.0
            if remaining > 0 and allow_negative_stock:
                if stocks:
                    stocks[0].available_qty -= remaining
                    line.issued_qty += remaining
                else:
                    db.add(Stock(
                        material_code=line.material_code, plant_code="PL01",
                        storage_location_code="SL01", wbs_code=line.wbs_code,
                        available_qty=-remaining, stock_value=0.0
                    ))
                    line.issued_qty += remaining
        mrf.status = "Issued"

    elif mrf.status == "Sent Back to Requestor":
        if role not in ["Requestor", "Admin"]:
            raise HTTPException(status_code=403, detail="Only Requestor can resubmit a sent-back MRF")
        if action != "resubmit":
            raise HTTPException(status_code=400, detail="Only resubmit is valid for a sent-back MRF")
        mrf.status = "Pending Requestor Manager Approval"
        if email_notifications_enabled(db):
            send_email_notification(
                f"MRF Resubmitted: {mrf.reference_number}",
                build_mrf_email_message(mrf, "MRF has been resubmitted and needs Requestor Manager approval again.", mrf.requestor_manager_email, "Requestor Manager"),
                mrf.requestor_manager_email,
                db
            )
    else:
        raise HTTPException(status_code=400, detail="Cannot approve/issue at this current status stage.")

    mrf.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(mrf)

    log_mrf_action(db, mrf, action, old_status, current_user, source, mrf.last_action_comment)

    if mrf.status == "Issued":
        pdf_filename = f"mrf_{mrf.reference_number}.pdf"
        pdf_path = os.path.join(settings.UPLOAD_DIR, pdf_filename)
        dept_name = db.query(Department.name).filter(Department.id == mrf.department_id).scalar() or "N/A"
        wh_name = db.query(Warehouse.name).filter(Warehouse.id == mrf.requested_from_warehouse_id).scalar() or "N/A"
        proj_name = db.query(Project.name).filter(Project.code == mrf.project_code).scalar() or "N/A"
        cc_name = "N/A"
        if mrf.cost_center_code:
            cc_name = db.query(CostCenter.name).filter(CostCenter.code == mrf.cost_center_code).scalar() or "N/A"
        
        comp = db.query(CompanySetting).filter(CompanySetting.id == 1).first()
        comp_name = comp.company_name if comp else "WAREHOUSE"
        comp_logo = comp.company_logo if comp else None

        mrf_pdf_data = {
            "company_name": comp_name,
            "company_logo": comp_logo,
            "worker_name": mrf.worker_name,
            "worker_signature": mrf.worker_signature,
            "reference_number": mrf.reference_number,
            "date": mrf.date,
            "requested_by_name": mrf.requested_by_name,
            "department_name": dept_name,
            "project_name": proj_name,
            "wbs_code": mrf.wbs_code or "N/A",
            "issue_account_type": mrf.issue_account_type,
            "cost_center_code": mrf.cost_center_code or "N/A",
            "cost_center_name": cc_name,
            "warehouse_name": wh_name,
            "reference_pr": mrf.reference_pr or "",
            "reference_po": mrf.reference_po or "",
            "warehouse_poc_name": mrf.warehouse_poc_name,
            "warehouse_poc_mobile": mrf.warehouse_poc_mobile,
            "additional_poc_name": mrf.additional_poc_name,
            "additional_poc_mobile": mrf.additional_poc_mobile,
            "location": mrf.location,
            "purpose": mrf.purpose,
            "vehicle_number": mrf.vehicle_number,
            "vehicle_type": mrf.vehicle_type,
            "driver_name": mrf.driver_name,
            "driver_mobile": mrf.driver_mobile,
            "driver_iqama": mrf.driver_iqama,
            "transport_company": mrf.transport_company,
            "receiver_name": mrf.receiver_name,
            "receiver_mobile": mrf.receiver_mobile,
            "requestor_signature": mrf.requestor_signature,
            "requestor_manager_signature": mrf.requestor_manager_signature,
            "project_manager_signature": mrf.project_manager_signature,
            "supervisor_signature": mrf.supervisor_signature,
            "manager_signature": mrf.manager_signature,
            "driver_signature": mrf.driver_signature,
            "receiver_signature": mrf.receiver_signature,
            "requestor_manager_name": mrf.requestor_manager_name,
            "requestor_manager_email": mrf.requestor_manager_email,
            "project_manager_name": mrf.project_manager_name,
            "project_manager_email": mrf.project_manager_email,
            "supervisor_name": mrf.supervisor_name,
            "manager_name": mrf.manager_name,
            "line_items": [{
                "material_code": line.material_code,
                "description": line.description,
                "uom": line.uom,
                "requested_qty": line.requested_qty,
                "approved_qty": line.approved_qty,
                "issued_qty": line.issued_qty,
                "wbs_code": line.wbs_code
            } for line in mrf.line_items]
        }
        try:
            generate_mrf_pdf(mrf_pdf_data, pdf_path, cancelled=False)
        except Exception:
            pass

    audit = AuditTrail(
        user_id=current_user.id,
        username=current_user.username,
        action="MRF Approved/Updated",
        remarks=f"MRF {mrf.reference_number} transitioned from '{old_status}' to '{mrf.status}' via action '{action}'"
    )
    db.add(audit)
    db.commit()
    db.refresh(mrf)
    return mrf

@router.post("/", response_model=MRFResponse)
def create_mrf(mrf_in: MRFCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ref_num = generate_mrf_ref(db)
    issue_account_type, project_code, cost_center_code = resolve_account_assignment(
        db,
        mrf_in.issue_account_type,
        mrf_in.project_code,
        mrf_in.cost_center_code
    )
    
    # Calculate total quantity
    total = sum([item.requested_qty for item in mrf_in.line_items])

    if not (mrf_in.requestor_manager_name or "").strip():
        raise HTTPException(status_code=400, detail="requestor_manager_name is required")
    if not (mrf_in.requestor_manager_email or "").strip():
        raise HTTPException(status_code=400, detail="requestor_manager_email is required")

    if issue_account_type == "project":
        if not (mrf_in.project_manager_name or "").strip():
            raise HTTPException(status_code=400, detail="project_manager_name is required for project-based issuance")
        if not (mrf_in.project_manager_email or "").strip():
            raise HTTPException(status_code=400, detail="project_manager_email is required for project-based issuance")
    
    # Initialize MRF
    mrf = MRF(
        reference_number=ref_num,
        date=mrf_in.date,
        requested_by_name=mrf_in.requested_by_name,
        staff_mobile=mrf_in.staff_mobile,
        department_id=mrf_in.department_id,
        project_code=project_code,
        issue_account_type=issue_account_type,
        cost_center_code=cost_center_code,
        requestor_manager_name=(mrf_in.requestor_manager_name or None),
        requestor_manager_email=(mrf_in.requestor_manager_email or None),
        project_manager_name=(mrf_in.project_manager_name or None),
        project_manager_email=(mrf_in.project_manager_email or None),
        requested_from_warehouse_id=mrf_in.requested_from_warehouse_id,
        purpose=mrf_in.purpose,
        location=mrf_in.location,
        warehouse_poc_name=mrf_in.warehouse_poc_name,
        warehouse_poc_mobile=mrf_in.warehouse_poc_mobile,
        additional_poc_name=mrf_in.additional_poc_name,
        additional_poc_mobile=mrf_in.additional_poc_mobile,
        wbs_code=mrf_in.wbs_code,
        reference_pr=mrf_in.reference_pr,
        reference_po=mrf_in.reference_po,
        total_qty=total,
        comments=mrf_in.comments,
        status="Pending Requestor Manager Approval",
        requestor_signature=mrf_in.requestor_signature
    )
    
    db.add(mrf)
    db.commit()
    db.refresh(mrf)
    
    for item in mrf_in.line_items:
        line = MRFLineItem(
            mrf_id=mrf.id,
            sn=item.sn,
            material_code=item.material_code,
            description=item.description,
            uom=item.uom,
            requested_qty=item.requested_qty,
            approved_qty=item.requested_qty, # Default approved to requested initially
            issued_qty=0.0,
            wbs_code=item.wbs_code or mrf.wbs_code,
            plant_code=item.plant_code,
            storage_location_code=item.storage_location_code
        )
        db.add(line)
        
    db.commit()
    db.refresh(mrf)

    db.add(MRFActionLog(
        mrf_id=mrf.id,
        action="created",
        from_status="Draft",
        to_status=mrf.status,
        actor_name=current_user.name,
        actor_role=current_user.role,
        actor_email=current_user.email,
        comment=(mrf.comments or "").strip() or None,
        source="app"
    ))
    
    # Audit log
    audit = AuditTrail(
        user_id=current_user.id,
        username=current_user.username,
        action="MRF Created",
        remarks=f"Created Material Request Form {mrf.reference_number}"
    )
    db.add(audit)
    db.commit()

    if email_notifications_enabled(db):
        notify_emails(
            db,
            [mrf.requestor_manager_email or ""],
            f"MRF Approval Required: {mrf.reference_number}",
            build_mrf_email_message(mrf, "MRF requires Requestor Manager approval.", mrf.requestor_manager_email, "Requestor Manager"),
        )
        if issue_account_type == "project" and mrf.project_manager_email:
            notify_emails(
                db,
                [mrf.project_manager_email],
                f"MRF Logged for Project Visibility: {mrf.reference_number}",
                build_mrf_email_message(mrf, "An MRF has been created for your project. This email is for visibility only."),
            )
    
    return mrf

@router.get("/", response_model=List[MRFResponse])
def get_mrfs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(MRF).order_by(MRF.created_at.desc()).all()

@router.get("/email-action", response_class=HTMLResponse)
def get_email_action_page(
    token: str = Query(...),
    action: str = Query(...),
    db: Session = Depends(get_db)
):
    normalized_action = action.strip().lower()
    if normalized_action not in {"approve", "reject", "send_back"}:
        raise HTTPException(status_code=400, detail="Invalid email action")

    payload = decode_email_action_token(token)
    mrf = db.query(MRF).filter(MRF.id == payload.get("mrf_id")).first()
    if not mrf:
        raise HTTPException(status_code=404, detail="MRF not found")
    approver = resolve_email_action_user(db, payload)
    return HTMLResponse(render_email_action_page(mrf, normalized_action, approver, token))


@router.post("/email-action/submit", response_class=HTMLResponse)
def submit_email_action(
    token: str = Form(...),
    action: str = Form(...),
    comments: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    normalized_action = action.strip().lower()
    if normalized_action not in {"approve", "reject", "send_back"}:
        raise HTTPException(status_code=400, detail="Invalid email action")

    payload = decode_email_action_token(token)
    mrf = db.query(MRF).filter(MRF.id == payload.get("mrf_id")).first()
    if not mrf:
        raise HTTPException(status_code=404, detail="MRF not found")

    approver = resolve_email_action_user(db, payload)
    update = MRFUpdate(
        action=normalized_action,
        approver_name=approver.name,
        comments=(comments or "").strip() or None,
        signature=f"Email link approval by {approver.name}",
    )
    updated_mrf = process_mrf_action(mrf, update, db, approver, source="email")
    return HTMLResponse(
        f"""
        <html>
          <body style="margin:0;background:#0f172a;font-family:Segoe UI, Arial, sans-serif;color:#e2e8f0;">
            <div style="max-width:760px;margin:48px auto;padding:24px;">
              <div style="background:#111c31;border:1px solid #23314f;border-radius:18px;padding:24px;">
                <div style="font-size:28px;font-weight:800;margin-bottom:10px;">Action Recorded</div>
                <p style="font-size:15px;color:#cbd5e1;">
                  {escape(normalized_action.replace('_', ' ').title())} has been recorded for
                  <b>{escape(updated_mrf.reference_number)}</b>.
                </p>
                <div style="margin-top:16px;padding:16px;border-radius:12px;background:#0b1220;border:1px solid #334155;">
                  <div style="margin-bottom:8px;"><b>New Status:</b> {escape(updated_mrf.status)}</div>
                  <div><b>Decision Note:</b> {escape((comments or '').strip() or 'No note provided')}</div>
                </div>
              </div>
            </div>
          </body>
        </html>
        """
    )

@router.get("/{mrf_id}", response_model=MRFResponse)
def get_mrf(mrf_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    mrf = db.query(MRF).filter(MRF.id == mrf_id).first()
    if not mrf:
        raise HTTPException(status_code=404, detail="MRF not found")
    return mrf

@router.post("/{mrf_id}/approve", response_model=MRFResponse)
def approve_mrf(
    mrf_id: int,
    update: MRFUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    mrf = db.query(MRF).filter(MRF.id == mrf_id).first()
    if not mrf:
        raise HTTPException(status_code=404, detail="MRF not found")
    return process_mrf_action(mrf, update, db, current_user, source="app")

@router.get("/{mrf_id}/pdf")
def download_mrf_pdf(mrf_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    mrf = db.query(MRF).filter(MRF.id == mrf_id).first()
    if not mrf:
        raise HTTPException(status_code=404, detail="MRF not found")
        
    pdf_filename = f"mrf_{mrf.reference_number}.pdf"
    pdf_path = os.path.join(settings.UPLOAD_DIR, pdf_filename)
    
    # If the file does not exist, let's generate it on the fly
    if not os.path.exists(pdf_path):
        dept_name = db.query(Department.name).filter(Department.id == mrf.department_id).scalar() or "N/A"
        wh_name = db.query(Warehouse.name).filter(Warehouse.id == mrf.requested_from_warehouse_id).scalar() or "N/A"
        proj_name = db.query(Project.name).filter(Project.code == mrf.project_code).scalar() or "N/A"
        cc_name = "N/A"
        if mrf.cost_center_code:
            cc_name = db.query(CostCenter.name).filter(CostCenter.code == mrf.cost_center_code).scalar() or "N/A"
        
        comp = db.query(CompanySetting).filter(CompanySetting.id == 1).first()
        comp_name = comp.company_name if comp else "WAREHOUSE"
        comp_logo = comp.company_logo if comp else None

        mrf_pdf_data = {
            "company_name": comp_name,
            "company_logo": comp_logo,
            "worker_name": mrf.worker_name,
            "worker_signature": mrf.worker_signature,
            "reference_number": mrf.reference_number,
            "date": mrf.date,
            "requested_by_name": mrf.requested_by_name,
            "department_name": dept_name,
            "project_name": proj_name,
            "wbs_code": mrf.wbs_code or "N/A",
            "issue_account_type": mrf.issue_account_type,
            "cost_center_code": mrf.cost_center_code or "N/A",
            "cost_center_name": cc_name,
            "warehouse_name": wh_name,
            "reference_pr": mrf.reference_pr or "",
            "reference_po": mrf.reference_po or "",
            "warehouse_poc_name": mrf.warehouse_poc_name,
            "warehouse_poc_mobile": mrf.warehouse_poc_mobile,
            "additional_poc_name": mrf.additional_poc_name,
            "additional_poc_mobile": mrf.additional_poc_mobile,
            "location": mrf.location,
            "purpose": mrf.purpose,
            
            "vehicle_number": mrf.vehicle_number,
            "vehicle_type": mrf.vehicle_type,
            "driver_name": mrf.driver_name,
            "driver_mobile": mrf.driver_mobile,
            "driver_iqama": mrf.driver_iqama,
            "transport_company": mrf.transport_company,
            "receiver_name": mrf.receiver_name,
            "receiver_mobile": mrf.receiver_mobile,
            
            "requestor_signature": mrf.requestor_signature,
            "requestor_manager_signature": mrf.requestor_manager_signature,
            "project_manager_signature": mrf.project_manager_signature,
            "supervisor_signature": mrf.supervisor_signature,
            "manager_signature": mrf.manager_signature,
            "driver_signature": mrf.driver_signature,
            "receiver_signature": mrf.receiver_signature,
            
            "requestor_manager_name": mrf.requestor_manager_name,
            "requestor_manager_email": mrf.requestor_manager_email,
            "project_manager_name": mrf.project_manager_name,
            "project_manager_email": mrf.project_manager_email,
            "supervisor_name": mrf.supervisor_name,
            "manager_name": mrf.manager_name,
            
            "line_items": [
                {
                    "material_code": line.material_code,
                    "description": line.description,
                    "uom": line.uom,
                    "requested_qty": line.requested_qty,
                    "approved_qty": line.approved_qty,
                    "issued_qty": line.issued_qty,
                    "wbs_code": line.wbs_code
                } for line in mrf.line_items
            ]
        }
        
        is_cancelled = (mrf.status == "Cancelled")
        generate_mrf_pdf(mrf_pdf_data, pdf_path, cancelled=is_cancelled)
        
    return FileResponse(pdf_path, media_type="application/pdf", filename=pdf_filename)

@router.post("/direct-issue", response_model=MRFResponse)
def direct_issue_material(
    issue_in: DirectIssueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Look up stock matching: Material + Plant + Storage Location + WBS
    stock_query = db.query(Stock).filter(
        Stock.material_code == issue_in.material_code,
        Stock.plant_code == issue_in.plant_code,
        Stock.storage_location_code == issue_in.storage_location_code
    )
    if issue_in.wbs_code:
        stock_query = stock_query.filter(Stock.wbs_code == issue_in.wbs_code)
    else:
        stock_query = stock_query.filter(Stock.wbs_code.is_(None) | (Stock.wbs_code == ""))
        
    stock = stock_query.first()
    
    # Check if stock exists and has enough available quantity
    if not stock or stock.available_qty < issue_in.quantity:
        avail = stock.available_qty if stock else 0.0
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock at the selected location. Needed {issue_in.quantity}, available {avail}."
        )
        
    # 2. Deduct quantity and stock value
    avg_value_per_unit = stock.stock_value / stock.available_qty if stock.available_qty > 0 else 0.0
    moved_value = issue_in.quantity * avg_value_per_unit
    stock.available_qty -= issue_in.quantity
    stock.stock_value -= moved_value
    issue_account_type, project_code, cost_center_code = resolve_account_assignment(
        db,
        issue_in.issue_account_type,
        issue_in.project_code,
        issue_in.cost_center_code
    )
    
    # 3. Create MRF with status "Issued"
    ref_num = generate_direct_issue_ref(db)
    mrf = MRF(
        reference_number=ref_num,
        date=datetime.now().strftime("%Y-%m-%d"),
        requested_by_name=issue_in.requested_by_name,
        department_id=issue_in.department_id,
        project_code=project_code,
        issue_account_type=issue_account_type,
        cost_center_code=cost_center_code,
        wbs_code=issue_in.wbs_code,
        purpose=issue_in.purpose,
        total_qty=issue_in.quantity,
        comments=issue_in.remarks,
        status="Issued",
        
        # Auto-approved signatures
        requestor_signature=issue_in.signature,
        requestor_manager_signature="System Auto-Approved",
        supervisor_signature="System Auto-Approved",
        manager_signature="System Auto-Approved",
        worker_signature=issue_in.signature,
        driver_signature=issue_in.signature,
        receiver_signature=issue_in.signature,
        
        # Approver Names
        requestor_manager_name="System",
        supervisor_name="System",
        manager_name="System",
        worker_name=current_user.name,
        
        # Transport details
        vehicle_number=issue_in.vehicle_number,
        vehicle_type=issue_in.vehicle_type,
        driver_name=issue_in.driver_name,
        driver_mobile=issue_in.driver_mobile,
        driver_iqama=issue_in.driver_iqama,
        transport_company=issue_in.transport_company,
        receiver_name=issue_in.receiver_name,
        receiver_mobile=issue_in.receiver_mobile,
        delivery_location=issue_in.delivery_location
    )
    db.add(mrf)
    db.commit()
    db.refresh(mrf)
    
    mat = db.query(Material).filter(Material.material_code == issue_in.material_code).first()
    line = MRFLineItem(
        mrf_id=mrf.id,
        sn=1,
        material_code=issue_in.material_code,
        description=mat.description if mat else "Direct Issue Item",
        uom=mat.uom if mat else "EA",
        requested_qty=issue_in.quantity,
        approved_qty=issue_in.quantity,
        issued_qty=issue_in.quantity,
        wbs_code=issue_in.wbs_code,
        plant_code=issue_in.plant_code,
        storage_location_code=issue_in.storage_location_code
    )
    db.add(line)
    db.commit()
    db.refresh(mrf)
    db.add(StockIssueMovement(
        mrf_id=mrf.id,
        mrf_line_item_id=line.id,
        stock_id=stock.id,
        material_code=line.material_code,
        plant_code=stock.plant_code,
        storage_location_code=stock.storage_location_code,
        wbs_code=stock.wbs_code,
        quantity=issue_in.quantity,
        stock_value=moved_value
    ))
    db.commit()
    
    # 5. Generate PDF automatically
    pdf_filename = f"mrf_{mrf.reference_number}.pdf"
    pdf_path = os.path.join(settings.UPLOAD_DIR, pdf_filename)
    
    dept_name = db.query(Department.name).filter(Department.id == mrf.department_id).scalar() or "N/A"
    wh_name = "N/A"
    proj_name = db.query(Project.name).filter(Project.code == mrf.project_code).scalar() or "N/A"
    cc_name = "N/A"
    if mrf.cost_center_code:
        cc_name = db.query(CostCenter.name).filter(CostCenter.code == mrf.cost_center_code).scalar() or "N/A"
    
    comp = db.query(CompanySetting).filter(CompanySetting.id == 1).first()
    comp_name = comp.company_name if comp else "WAREHOUSE"
    comp_logo = comp.company_logo if comp else None

    mrf_pdf_data = {
        "company_name": comp_name,
        "company_logo": comp_logo,
        "worker_name": mrf.worker_name,
        "worker_signature": mrf.worker_signature,
        "reference_number": mrf.reference_number,
        "date": mrf.date,
        "requested_by_name": mrf.requested_by_name,
        "department_name": dept_name,
        "project_name": proj_name,
        "wbs_code": mrf.wbs_code or "N/A",
        "issue_account_type": mrf.issue_account_type,
        "cost_center_code": mrf.cost_center_code or "N/A",
        "cost_center_name": cc_name,
        "warehouse_name": wh_name,
        "reference_pr": mrf.reference_pr or "",
        "reference_po": mrf.reference_po or "",
        "warehouse_poc_name": mrf.warehouse_poc_name,
        "warehouse_poc_mobile": mrf.warehouse_poc_mobile,
        "additional_poc_name": mrf.additional_poc_name,
        "additional_poc_mobile": mrf.additional_poc_mobile,
        "location": mrf.location or issue_in.delivery_location or "N/A",
        "purpose": mrf.purpose,
        
        "vehicle_number": mrf.vehicle_number,
        "vehicle_type": mrf.vehicle_type,
        "driver_name": mrf.driver_name,
        "driver_mobile": mrf.driver_mobile,
        "driver_iqama": mrf.driver_iqama,
        "transport_company": mrf.transport_company,
        "receiver_name": mrf.receiver_name,
        "receiver_mobile": mrf.receiver_mobile,
        
        "requestor_signature": mrf.requestor_signature,
        "requestor_manager_signature": mrf.requestor_manager_signature,
        "project_manager_signature": mrf.project_manager_signature,
        "supervisor_signature": mrf.supervisor_signature,
        "manager_signature": mrf.manager_signature,
        "driver_signature": mrf.driver_signature,
        "receiver_signature": mrf.receiver_signature,
        
        "requestor_manager_name": mrf.requestor_manager_name,
        "requestor_manager_email": mrf.requestor_manager_email,
        "project_manager_name": mrf.project_manager_name,
        "project_manager_email": mrf.project_manager_email,
        "supervisor_name": mrf.supervisor_name,
        "manager_name": mrf.manager_name,
        
        "line_items": [
            {
                "material_code": line.material_code,
                "description": line.description,
                "uom": line.uom,
                "requested_qty": line.requested_qty,
                "approved_qty": line.approved_qty,
                "issued_qty": line.issued_qty,
                "wbs_code": line.wbs_code
            }
        ]
    }
    
    try:
        generate_mrf_pdf(mrf_pdf_data, pdf_path, cancelled=False)
        # Add attachment record
        from backend.models import Attachment
        attach = Attachment(
            transaction_type="MRF",
            transaction_id=mrf.id,
            filename=pdf_filename,
            file_path=f"/static/{pdf_filename}",
            uploaded_by="System"
        )
        db.add(attach)
        db.commit()
    except Exception as e:
        print(f"Failed to auto generate PDF for direct issue: {str(e)}")
        
    # 6. Audit log
    audit = AuditTrail(
        user_id=current_user.id,
        username=current_user.username,
        action="MRF Direct Issued",
        remarks=f"Directly issued material {issue_in.material_code} (Qty: {issue_in.quantity}) via MRF {mrf.reference_number}"
    )
    db.add(audit)
    db.commit()
    
    return mrf
