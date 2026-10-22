import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .services.database import db_connection, get_state, parse_json_column, save_state
from .services.mailer import send_otp_email


app = FastAPI(title="InTrack API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AuthorizedStudent(BaseModel):
    model_config = ConfigDict(extra="allow")

    studentNumber: str
    name: str | None = None
    email: EmailStr
    program: str
    section: str
    accountStatus: str = "ACTIVE"
    activated: bool = False
    emailVerified: bool = False
    passwordChanged: bool = False
    failedOtpAttempts: int = 0
    lockoutUntil: str | None = None
    otpRequestTimestamps: list[Any] = Field(default_factory=list)


class AuthorizedStudentsPayload(BaseModel):
    students: list[AuthorizedStudent] = Field(default_factory=list)


class StatePayload(BaseModel):
    state: dict[str, Any] | None = None


class SendOtpPayload(BaseModel):
    email: EmailStr
    code: str
    purpose: str | None = None


class CaptchaVerificationPayload(BaseModel):
    challengeId: str
    answer: str


class PrivacyConsentPayload(BaseModel):
    email: str
    role: str
    version: str
    acceptedAt: str


captcha_challenges: dict[str, dict[str, Any]] = {}
CAPTCHA_TTL_MINUTES = 5
CAPTCHA_MAX_ATTEMPTS = 3


@app.exception_handler(HTTPException)
def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict):
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


def split_student_name(name: str | None) -> tuple[str, str | None, str]:
    parts = [part for part in str(name or "").strip().split() if part]
    first_name = parts[0] if parts else "Student"
    middle_name = " ".join(parts[1:-1]) if len(parts) > 2 else None
    last_name = parts[-1] if len(parts) > 1 else "Record"
    return first_name, middle_name, last_name


def to_mysql_datetime(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    return datetime.fromisoformat(normalized).strftime("%Y-%m-%d %H:%M:%S")


def to_iso_datetime(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def remove_expired_captcha_challenges() -> None:
    now = datetime.now(timezone.utc)
    expired_ids = [challenge_id for challenge_id, challenge in captcha_challenges.items() if challenge["expires_at"] <= now]
    for challenge_id in expired_ids:
        captcha_challenges.pop(challenge_id, None)


@app.get("/api/captcha/challenge")
def create_captcha_challenge() -> dict[str, str]:
    remove_expired_captcha_challenges()
    first = secrets.randbelow(8) + 2
    second = secrets.randbelow(8) + 1
    challenge_id = secrets.token_urlsafe(24)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=CAPTCHA_TTL_MINUTES)
    captcha_challenges[challenge_id] = {
        "answer": str(first + second),
        "expires_at": expires_at,
        "attempts": 0,
    }
    return {
        "challengeId": challenge_id,
        "prompt": f"What is {first} + {second}?",
        "expiresAt": expires_at.isoformat(),
    }


@app.post("/api/captcha/verify")
def verify_captcha(payload: CaptchaVerificationPayload) -> dict[str, bool]:
    remove_expired_captcha_challenges()
    challenge = captcha_challenges.get(payload.challengeId)
    if not challenge:
        raise HTTPException(status_code=400, detail="This security challenge has expired. Please try a new one.")

    challenge["attempts"] += 1
    if not secrets.compare_digest(challenge["answer"], payload.answer.strip()):
        if challenge["attempts"] >= CAPTCHA_MAX_ATTEMPTS:
            captcha_challenges.pop(payload.challengeId, None)
        raise HTTPException(status_code=400, detail="That answer was not correct. Please try again.")

    captcha_challenges.pop(payload.challengeId, None)
    return {"verified": True}


@app.post("/api/privacy-consents")
def save_privacy_consent(payload: PrivacyConsentPayload) -> dict[str, bool]:
    accepted_at = to_mysql_datetime(payload.acceptedAt)
    if not accepted_at or not payload.email.strip() or not payload.version.strip():
        raise HTTPException(status_code=400, detail="A complete consent record is required.")
    if payload.role not in {"student", "adviser", "coordinator"}:
        raise HTTPException(status_code=400, detail="The account role is not valid.")

    try:
        with db_connection() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO privacy_consents (account_identifier, account_role, notice_version, accepted_at)
                        VALUES (%s, %s, %s, %s)
                        ON DUPLICATE KEY UPDATE accepted_at = VALUES(accepted_at)
                        """,
                        (payload.email.strip().lower(), payload.role, payload.version.strip(), accepted_at),
                    )
                connection.commit()
            except Exception:
                connection.rollback()
                raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

    return {"ok": True}


def map_authorized_student(row: dict[str, Any]) -> dict[str, Any]:
    name = " ".join(
        part
        for part in [row.get("first_name"), row.get("middle_name"), row.get("last_name")]
        if part
    )

    timestamps = parse_json_column(row.get("otp_request_timestamps")) or []

    return {
        "studentNumber": row["student_number"],
        "name": name,
        "email": row["pup_webmail"],
        "program": row["program"],
        "section": row["year_section"],
        "accountStatus": row["account_status"],
        "activated": bool(row["activated"]),
        "emailVerified": bool(row["email_verified"]),
        "passwordChanged": bool(row["password_changed"]),
        "failedOtpAttempts": int(row["failed_otp_attempts"] or 0),
        "lockoutUntil": to_iso_datetime(row.get("lockout_until")),
        "otpRequestTimestamps": timestamps if isinstance(timestamps, list) else [],
    }


@app.get("/api/health")
def health() -> dict[str, Any]:
    try:
        with db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail={"ok": False, "database": "unavailable", "error": str(error)},
        ) from error

    return {"ok": True, "database": "connected"}


@app.get("/api/authorized-students")
def list_authorized_students() -> dict[str, Any]:
    try:
        with db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT student_number, pup_webmail, last_name, first_name, middle_name,
                           program, year_section, account_status, activated, email_verified,
                           password_changed, failed_otp_attempts, lockout_until,
                           otp_request_timestamps
                    FROM authorized_students
                    ORDER BY last_name, first_name
                    """
                )
                rows = cursor.fetchall()
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

    return {"students": [map_authorized_student(row) for row in rows]}


@app.put("/api/authorized-students")
def save_authorized_students(payload: AuthorizedStudentsPayload) -> dict[str, bool]:
    try:
        with db_connection() as connection:
            try:
                with connection.cursor() as cursor:
                    for student in payload.students:
                        first_name, middle_name, last_name = split_student_name(student.name)
                        cursor.execute(
                            """
                            INSERT INTO authorized_students (
                              student_number, pup_webmail, last_name, first_name, middle_name,
                              program, year_section, account_status, activated, email_verified,
                              password_changed, failed_otp_attempts, lockout_until,
                              otp_request_timestamps
                            )
                            VALUES (
                              %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                              CAST(%s AS JSON)
                            )
                            ON DUPLICATE KEY UPDATE
                              pup_webmail = VALUES(pup_webmail),
                              last_name = VALUES(last_name),
                              first_name = VALUES(first_name),
                              middle_name = VALUES(middle_name),
                              program = VALUES(program),
                              year_section = VALUES(year_section),
                              account_status = VALUES(account_status),
                              activated = VALUES(activated),
                              email_verified = VALUES(email_verified),
                              password_changed = VALUES(password_changed),
                              failed_otp_attempts = VALUES(failed_otp_attempts),
                              lockout_until = VALUES(lockout_until),
                              otp_request_timestamps = VALUES(otp_request_timestamps)
                            """,
                            (
                                student.studentNumber,
                                str(student.email),
                                last_name,
                                first_name,
                                middle_name,
                                student.program,
                                student.section,
                                student.accountStatus,
                                student.activated,
                                student.emailVerified,
                                student.passwordChanged,
                                student.failedOtpAttempts,
                                to_mysql_datetime(student.lockoutUntil),
                                json.dumps(student.otpRequestTimestamps),
                            ),
                        )
                connection.commit()
            except Exception:
                connection.rollback()
                raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

    return {"ok": True}


@app.get("/api/{key}-state")
def load_state(key: str) -> dict[str, Any]:
    try:
        state = get_state(key)
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

    return {"state": state}


@app.put("/api/{key}-state")
def update_state(key: str, payload: StatePayload) -> dict[str, bool]:
    try:
        save_state(key, payload.state or {})
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

    return {"ok": True}


@app.post("/api/send-otp")
def send_otp(payload: SendOtpPayload) -> dict[str, bool]:
    email = str(payload.email)
    if not email.lower().endswith("@iskolarngbayan.pup.edu.ph"):
        raise HTTPException(
            status_code=400,
            detail="OTP can only be sent to a PUP Webmail address.",
        )

    try:
        send_otp_email(email, payload.code, payload.purpose)
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

    return {"ok": True}
