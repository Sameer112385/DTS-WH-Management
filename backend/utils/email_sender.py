import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Tuple, Dict, Any
from sqlalchemy.orm import Session
from backend.models import EmailSetting
import logging

logger = logging.getLogger("EmailSender")

def send_email_notification(
    subject: str,
    body: str,
    recipient_email: str,
    db: Session
) -> bool:
    """
    Sends an email using the configuration saved in the database
    """
    # Fetch settings from DB
    settings = db.query(EmailSetting).filter(EmailSetting.id == 1).first()
    if not settings or not settings.smtp_server or not settings.sender_email:
        logger.warning("Email notifications are skipped: Email settings are not configured in DB.")
        return False

    try:
        # Create message container
        msg = MIMEMultipart()
        msg['From'] = settings.sender_email
        msg['To'] = recipient_email
        msg['Subject'] = subject

        # Attach body
        msg.attach(MIMEText(body, 'html' if "<html>" in body.lower() else 'plain'))

        # Setup connection
        if settings.ssl_tls:
            server = smtplib.SMTP_SSL(settings.smtp_server, settings.smtp_port or 465, timeout=10)
        else:
            server = smtplib.SMTP(settings.smtp_server, settings.smtp_port or 587, timeout=10)
            server.starttls()

        # Login if username is provided
        if settings.username and settings.password:
            server.login(settings.username, settings.password)

        # Send
        server.sendmail(settings.sender_email, recipient_email, msg.as_string())
        server.quit()
        logger.info(f"Email successfully sent to {recipient_email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send email to {recipient_email}: {str(e)}")
        return False


def test_smtp_connection(setting_data: dict) -> Tuple[bool, str]:
    """
    Validates SMTP configurations by connecting and authenticating (without sending)
    """
    import ssl
    try:
        server_host = setting_data.get("smtp_server")
        server_port = int(setting_data.get("smtp_port") or 465)
        username = setting_data.get("username")
        password = setting_data.get("password")
        ssl_tls = setting_data.get("ssl_tls", True)
        
        if ssl_tls:
            context = ssl.create_default_context()
            server = smtplib.SMTP_SSL(server_host, server_port, context=context, timeout=5)
        else:
            server = smtplib.SMTP(server_host, server_port, timeout=5)
            server.starttls()

        if username and password:
            server.login(username, password)
            
        server.quit()
        return True, "SMTP connection and login succeeded!"
    except Exception as e:
        return False, f"SMTP Connection failed: {str(e)}"
