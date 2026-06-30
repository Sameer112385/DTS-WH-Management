import imaplib
import email
from email.header import decode_header
import re
import time
import threading
import logging
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.models import EmailSetting, MRF, User
from backend.routers.mrf import process_mrf_action
from backend.schemas import MRFUpdate

logger = logging.getLogger("IMAPListener")

def poll_imap_inbox():
    logger.info("IMAP Polling loop started.")
    while True:
        # Check every 15 seconds
        time.sleep(15)
        
        db = SessionLocal()
        try:
            settings = db.query(EmailSetting).filter(EmailSetting.id == 1).first()
            if not settings or not settings.email_approval_enabled or not settings.imap_server:
                continue
                
            # Connect to IMAP
            if settings.ssl_tls:
                mail = imaplib.IMAP4_SSL(settings.imap_server, settings.imap_port or 993)
            else:
                mail = imaplib.IMAP4(settings.imap_server, settings.imap_port or 143)
                
            if settings.username and settings.password:
                mail.login(settings.username, settings.password)
                
            mail.select("inbox")
            
            # Search for UNSEEN emails
            status, messages = mail.search(None, "UNSEEN")
            if status != "OK" or not messages[0]:
                mail.close()
                mail.logout()
                continue
                
            for num in messages[0].split():
                status, data = mail.fetch(num, "(RFC822)")
                if status != "OK":
                    continue
                    
                for response_part in data:
                    if isinstance(response_part, tuple):
                        msg = email.message_from_bytes(response_part[1])
                        
                        # Decode subject
                        subject_header = msg["Subject"]
                        if not subject_header:
                            continue
                        subject, encoding = decode_header(subject_header)[0]
                        if isinstance(subject, bytes):
                            subject = subject.decode(encoding or "utf-8", errors="ignore")
                            
                        # Extract sender email
                        from_header = msg.get("From", "")
                        from_email = ""
                        email_match = re.search(r"<([^>]+)>", from_header)
                        if email_match:
                            from_email = email_match.group(1).strip().lower()
                        else:
                            from_email = from_header.strip().lower()
                            
                        # Check if subject contains MRF reference
                        mrf_match = re.search(r"(MRF-\d{8}-\d{4})", subject)
                        if not mrf_match:
                            continue
                            
                        mrf_ref = mrf_match.group(1)
                        logger.info(f"Processing email reply for MRF {mrf_ref} from {from_email}")
                        
                        # Retrieve MRF and User
                        mrf_obj = db.query(MRF).filter(MRF.reference_number == mrf_ref).first()
                        if not mrf_obj:
                            logger.warning(f"MRF {mrf_ref} not found in database.")
                            continue
                            
                        user_obj = db.query(User).filter(User.email == from_email, User.is_active == True).first()
                        if not user_obj:
                            logger.warning(f"No active User found with email {from_email}")
                            continue
                            
                        # Decode body to find the action
                        body = ""
                        if msg.is_multipart():
                            for part in msg.walk():
                                content_type = part.get_content_type()
                                content_disposition = str(part.get("Content-Disposition"))
                                if content_type == "text/plain" and "attachment" not in content_disposition:
                                    payload = part.get_payload(decode=True)
                                    body = payload.decode(part.get_content_charset() or "utf-8", errors="ignore")
                                    break
                        else:
                            payload = msg.get_payload(decode=True)
                            body = payload.decode(msg.get_content_charset() or "utf-8", errors="ignore")
                            
                        # Parse action from body
                        body_lower = body.lower().strip()
                        action = None
                        if "approve" in body_lower or "approved" in body_lower:
                            action = "approve"
                        elif "reject" in body_lower or "rejected" in body_lower:
                            action = "reject"
                        elif "send back" in body_lower or "send_back" in body_lower:
                            action = "send_back"
                            
                        if not action:
                            logger.warning("Could not determine action (approve/reject/send_back) from email body.")
                            continue
                            
                        # Process MRF Action!
                        try:
                            comments = f"Approved via Email Reply from {user_obj.name}"
                            lines = [line.strip() for line in body.split("\n") if line.strip() and not line.strip().startswith(">")]
                            if lines:
                                clean_lines = [l for l in lines if l.lower() not in {"approve", "approved", "reject", "rejected", "send back", "send_back"}]
                                if clean_lines:
                                    comments = clean_lines[0][:200]
                                    
                            update = MRFUpdate(
                                action=action,
                                approver_name=user_obj.name,
                                comments=comments,
                                signature=f"Email reply action by {user_obj.name}"
                            )
                            process_mrf_action(mrf_obj, update, db, user_obj, source="email")
                            logger.info(f"Successfully processed email action '{action}' for MRF {mrf_ref}")
                            
                            # Mark email as read / seen
                            mail.store(num, "+FLAGS", "\\Seen")
                        except Exception as e:
                            logger.error(f"Failed to process email action: {str(e)}")
            mail.close()
            mail.logout()
        except Exception as e:
            logger.error(f"IMAP poll error: {str(e)}")
        finally:
            db.close()

def start_imap_listener():
    t = threading.Thread(target=poll_imap_inbox, daemon=True)
    t.start()
    logger.info("Started IMAP background listener thread.")
