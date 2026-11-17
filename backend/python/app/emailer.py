import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

import httpx

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

outbox: list[dict] = []


def _smtp_configured(settings: Settings) -> bool:
    return bool(settings.smtp_host and settings.smtp_user and settings.smtp_password)


def _send_smtp(settings: Settings, to_email: str, subject: str, html: str, link: str) -> None:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((settings.smtp_from_name or "EventFinder", settings.smtp_user))
    message["To"] = to_email
    message.set_content(f"{subject}\n\n{link}\n")
    message.add_alternative(html, subtype="html")
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as client:
        client.ehlo()
        client.starttls()
        client.ehlo()
        client.login(settings.smtp_user, settings.smtp_password)
        client.send_message(message)


def send_html_email(to_email: str, subject: str, html: str, link: str) -> None:
    settings = get_settings()
    message = {"to": to_email, "subject": subject, "html": html, "link": link}

    if _smtp_configured(settings):
        _send_smtp(settings, to_email, subject, html, link)
        outbox.append(message)
        return

    if not settings.mailersend_api_token:
        outbox.append(message)
        logger.info("Email is not configured. Verification link for %s: %s", to_email, link)
        return

    payload = {
        "from": {"email": settings.mailersend_from_email, "name": settings.mailersend_from_name},
        "to": [{"email": to_email}],
        "subject": subject,
        "html": html,
    }
    response = httpx.post(
        "https://api.mailersend.com/v1/email",
        headers={
            "Authorization": f"Bearer {settings.mailersend_api_token}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30,
    )
    if response.status_code >= 400:
        logger.error("MailerSend failed: %s %s", response.status_code, response.text)
        raise RuntimeError("email_send_failed")
    outbox.append(message)


def verification_html(link: str) -> str:
    return f"""
<h2>Подтверждение email</h2>
<p>Спасибо за регистрацию.</p>
<p>Для активации аккаунта перейдите по ссылке:</p>
<p><a href="{link}">Подтвердить email</a></p>
<p>{link}</p>
<p>Ссылка действует 24 часа.</p>
"""


def reset_html(link: str) -> str:
    return f"""
<h2>Сброс пароля</h2>
<p>Вы запросили сброс пароля.</p>
<p>Для продолжения перейдите по ссылке:</p>
<p><a href="{link}">Сбросить пароль</a></p>
<p>{link}</p>
<p>Ссылка действует 24 часа.</p>
"""
