#!/usr/bin/env python3
"""Личные кабинеты: регистрация, сессии и коллекция на сервере.

Как назначить администратора (role=admin):
1. Если в БД ещё нет ни одного admin — первый зарегистрированный получает роль admin.
2. Либо email из переменной NUMISMAT_ADMIN_EMAIL (при регистрации, входе и старте сервиса).
3. Вручную: `python scripts/promote_admin.py you@example.com`
   или SQL: `UPDATE users SET role = 'admin' WHERE email = 'you@example.com';`
   (файл БД: $NUMISMAT_DATA_DIR/app.db, на проде обычно /opt/data/app.db).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import io
import json
import logging
import os
import re
import secrets
import smtplib
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterator, Literal

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
COOKIE_NAME = "numismat_session"
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
ALLOWED_PHOTO_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
PBKDF2_ITERATIONS = 210_000
PASSWORD_RESET_RESPONSE = (
    "Если аккаунт с таким email существует, мы отправили ссылку для восстановления пароля."
)
PASSWORD_RESET_TTL_MINUTES = 30
PASSWORD_RESET_REQUEST_WINDOW_MINUTES = 60
PASSWORD_RESET_REQUESTS_PER_EMAIL = 3
PASSWORD_RESET_REQUESTS_PER_IP = 10
PASSWORD_RESET_ATTEMPTS_PER_IP = 20
logger = logging.getLogger(__name__)

try:
    import bcrypt as _bcrypt
except ImportError:
    _bcrypt = None


def _data_dir() -> Path:
    return Path(os.getenv("NUMISMAT_DATA_DIR", "ml/data"))


def _db_path() -> Path:
    return _data_dir() / "app.db"


def _uploads_dir() -> Path:
    return Path(os.getenv("NUMISMAT_UPLOADS_DIR", str(_data_dir() / "uploads")))


@lru_cache
def _secret_key() -> str:
    env = os.getenv("NUMISMAT_SECRET_KEY", "").strip()
    if env:
        return env
    path = _data_dir() / "secret.key"
    if path.is_file():
        return path.read_text(encoding="utf-8").strip()
    _data_dir().mkdir(parents=True, exist_ok=True)
    key = secrets.token_urlsafe(48)
    path.write_text(key, encoding="utf-8")
    return key


def hash_password(password: str) -> str:
    payload = password.encode("utf-8")
    if _bcrypt is not None:
        return "bcrypt$" + _bcrypt.hashpw(payload[:72], _bcrypt.gensalt()).decode("ascii")
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", payload, salt, PBKDF2_ITERATIONS)
    return f"pbkdf2${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    payload = password.encode("utf-8")
    try:
        if hashed.startswith("bcrypt$"):
            if _bcrypt is None:
                return False
            return _bcrypt.checkpw(payload[:72], hashed.removeprefix("bcrypt$").encode("ascii"))
        scheme, iterations, salt_hex, digest_hex = hashed.split("$")
        if scheme != "pbkdf2":
            return False
        digest = hashlib.pbkdf2_hmac("sha256", payload, bytes.fromhex(salt_hex), int(iterations))
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _token_for(user_id: int, session_version: int = 0) -> str:
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = _b64url(json.dumps({
        "sub": str(user_id),
        "sv": session_version,
        "exp": int((datetime.now(timezone.utc) + timedelta(days=7)).timestamp()),
    }, separators=(",", ":")).encode())
    signing = f"{header}.{payload}".encode()
    signature = hmac.new(_secret_key().encode(), signing, hashlib.sha256).digest()
    return f"{header}.{payload}.{_b64url(signature)}"


def _session_from_token(token: str) -> tuple[int, int]:
    _header_b64, payload_b64, signature_b64 = token.split(".")
    signing = f"{_header_b64}.{payload_b64}".encode()
    expected = _b64url(hmac.new(_secret_key().encode(), signing, hashlib.sha256).digest())
    if not hmac.compare_digest(expected, signature_b64):
        raise ValueError("bad signature")
    payload = json.loads(_b64url_decode(payload_b64))
    if int(payload.get("exp", 0)) < int(datetime.now(timezone.utc).timestamp()):
        raise ValueError("expired")
    return int(payload["sub"]), int(payload.get("sv", 0))


@contextmanager
def db() -> Iterator[sqlite3.Connection]:
    path = _db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _admin_email() -> str:
    return os.getenv("NUMISMAT_ADMIN_EMAIL", "").strip().lower()


def _promote_env_admin(conn: sqlite3.Connection) -> None:
    email = _admin_email()
    if email:
        conn.execute("UPDATE users SET role = 'admin' WHERE email = ?", (email,))


def _ensure_bootstrap_admin(conn: sqlite3.Connection) -> None:
    """Если админа нет — назначить email из env или самого первого пользователя."""
    _promote_env_admin(conn)
    has_admin = conn.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1").fetchone()
    if has_admin is not None:
        return
    first = conn.execute("SELECT id FROM users ORDER BY id ASC LIMIT 1").fetchone()
    if first is not None:
        conn.execute("UPDATE users SET role = 'admin' WHERE id = ?", (int(first["id"]),))


def _role_for_new_user(conn: sqlite3.Connection, email: str) -> str:
    if _admin_email() and email == _admin_email():
        return "admin"
    has_admin = conn.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1").fetchone()
    if has_admin is None:
        return "admin"
    return "user"


def init_storage() -> None:
    _data_dir().mkdir(parents=True, exist_ok=True)
    _uploads_dir().mkdir(parents=True, exist_ok=True)
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                session_version INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS coins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                subtitle TEXT NOT NULL DEFAULT '',
                country TEXT NOT NULL DEFAULT '',
                year INTEGER NOT NULL DEFAULT 0,
                metal TEXT NOT NULL DEFAULT '',
                grade TEXT NOT NULL DEFAULT '',
                value REAL NOT NULL DEFAULT 0,
                color TEXT NOT NULL DEFAULT 'silver',
                mark TEXT NOT NULL DEFAULT '₽',
                photo_relpath TEXT,
                photo_reverse_relpath TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            CREATE INDEX IF NOT EXISTS idx_coins_user ON coins(user_id);
            CREATE TABLE IF NOT EXISTS shares (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_id INTEGER NOT NULL,
                token TEXT NOT NULL UNIQUE,
                access TEXT NOT NULL DEFAULT 'read',
                invitee_email TEXT,
                invitee_user_id INTEGER,
                coin_id INTEGER,
                created_at TEXT NOT NULL,
                FOREIGN KEY (owner_id) REFERENCES users(id),
                FOREIGN KEY (invitee_user_id) REFERENCES users(id)
            );
            CREATE INDEX IF NOT EXISTS idx_shares_owner ON shares(owner_id);
            CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(token);
            CREATE INDEX IF NOT EXISTS idx_shares_invitee_email ON shares(invitee_email);
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL,
                used_at TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash
                ON password_reset_tokens(token_hash);
            CREATE INDEX IF NOT EXISTS idx_password_reset_user
                ON password_reset_tokens(user_id);
            CREATE TABLE IF NOT EXISTS password_reset_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kind TEXT NOT NULL,
                email_hash TEXT,
                ip_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_password_reset_events_created
                ON password_reset_events(kind, created_at);
            """
        )
        _ensure_user_session_schema(conn)
        _ensure_share_schema(conn)
        _ensure_coin_photo_schema(conn)
        _ensure_bootstrap_admin(conn)


def _ensure_user_session_schema(conn: sqlite3.Connection) -> None:
    columns = {row[1] for row in conn.execute("PRAGMA table_info(users)").fetchall()}
    if "session_version" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0")


def _ensure_coin_photo_schema(conn: sqlite3.Connection) -> None:
    columns = {row[1] for row in conn.execute("PRAGMA table_info(coins)").fetchall()}
    if "photo_reverse_relpath" not in columns:
        conn.execute("ALTER TABLE coins ADD COLUMN photo_reverse_relpath TEXT")


def _ensure_share_schema(conn: sqlite3.Connection) -> None:
    columns = {row[1] for row in conn.execute("PRAGMA table_info(shares)").fetchall()}
    if "coin_id" not in columns:
        conn.execute("ALTER TABLE shares ADD COLUMN coin_id INTEGER")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_shares_coin ON shares(coin_id)")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _env_int(name: str, default: int) -> int:
    try:
        return max(1, int(os.getenv(name, str(default))))
    except ValueError:
        return default


def _validate_password(password: str) -> None:
    if len(password) < 8 or len(password) > 128:
        raise HTTPException(422, "Пароль должен содержать от 8 до 128 символов")
    if not any(char.isalpha() for char in password) or not any(char.isdigit() for char in password):
        raise HTTPException(422, "Пароль должен содержать хотя бы одну букву и одну цифру")
    if any(char.isspace() for char in password):
        raise HTTPException(422, "Пароль не должен содержать пробелы")


def _private_hash(value: str) -> str:
    return hmac.new(_secret_key().encode(), value.encode(), hashlib.sha256).hexdigest()


def _request_ip(request: Request) -> str:
    # Uvicorn корректно заполняет client.host при включённых trusted proxy headers.
    return request.client.host if request.client else "unknown"


def _rate_limit_reset(
    conn: sqlite3.Connection,
    *,
    kind: Literal["request", "confirm"],
    request: Request,
    email: str | None = None,
) -> bool:
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(minutes=PASSWORD_RESET_REQUEST_WINDOW_MINUTES)).isoformat()
    ip_hash = _private_hash(_request_ip(request))
    email_hash = _private_hash(email) if email else None
    conn.execute("DELETE FROM password_reset_events WHERE created_at < ?", (cutoff,))
    ip_limit = (
        _env_int("NUMISMAT_RESET_REQUESTS_PER_IP", PASSWORD_RESET_REQUESTS_PER_IP)
        if kind == "request"
        else _env_int("NUMISMAT_RESET_ATTEMPTS_PER_IP", PASSWORD_RESET_ATTEMPTS_PER_IP)
    )
    ip_count = conn.execute(
        "SELECT COUNT(*) FROM password_reset_events WHERE kind = ? AND ip_hash = ? AND created_at >= ?",
        (kind, ip_hash, cutoff),
    ).fetchone()[0]
    email_limited = False
    if email_hash is not None:
        email_limit = _env_int("NUMISMAT_RESET_REQUESTS_PER_EMAIL", PASSWORD_RESET_REQUESTS_PER_EMAIL)
        email_count = conn.execute(
            """
            SELECT COUNT(*) FROM password_reset_events
            WHERE kind = ? AND email_hash = ? AND created_at >= ?
            """,
            (kind, email_hash, cutoff),
        ).fetchone()[0]
        email_limited = int(email_count) >= email_limit
    conn.execute(
        """
        INSERT INTO password_reset_events (kind, email_hash, ip_hash, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (kind, email_hash, ip_hash, now.isoformat()),
    )
    return int(ip_count) < ip_limit and not email_limited


def _password_reset_url(request: Request, token: str) -> str:
    origin = _public_origin(request)
    if os.getenv("NUMISMAT_ENV", "development").strip().lower() == "production":
        configured = os.getenv("NUMISMAT_PUBLIC_URL", "").strip()
        if not configured or not origin.startswith("https://"):
            raise RuntimeError("В production нужен HTTPS NUMISMAT_PUBLIC_URL")
    return f"{origin}/reset-password?token={token}"


def _send_password_reset_email(email: str, reset_url: str, ttl_minutes: int) -> None:
    mode = os.getenv("NUMISMAT_EMAIL_MODE", "disabled").strip().lower()
    environment = os.getenv("NUMISMAT_ENV", "development").strip().lower()
    if mode == "disabled":
        return
    if mode == "console":
        if environment == "production":
            raise RuntimeError("console email mode запрещён в production")
        logger.warning("DEV password reset link for %s: %s", email, reset_url)
        return
    if mode != "smtp":
        raise RuntimeError("NUMISMAT_EMAIL_MODE должен быть disabled, console или smtp")

    host = os.getenv("NUMISMAT_SMTP_HOST", "").strip()
    sender = os.getenv("NUMISMAT_SMTP_FROM", "").strip()
    if not host or not sender:
        raise RuntimeError("Для SMTP нужны NUMISMAT_SMTP_HOST и NUMISMAT_SMTP_FROM")
    port = _env_int("NUMISMAT_SMTP_PORT", 465 if os.getenv("NUMISMAT_SMTP_SSL") == "1" else 587)
    message = EmailMessage()
    message["Subject"] = "Восстановление пароля — Нумизмат"
    message["From"] = sender
    message["To"] = email
    message.set_content(
        "Чтобы установить новый пароль, откройте ссылку:\n\n"
        f"{reset_url}\n\n"
        f"Ссылка действует {ttl_minutes} минут и может быть использована только один раз. "
        "Если вы не запрашивали восстановление, проигнорируйте письмо."
    )
    smtp_class = smtplib.SMTP_SSL if os.getenv("NUMISMAT_SMTP_SSL") == "1" else smtplib.SMTP
    with smtp_class(host, port, timeout=15) as smtp:
        if smtp_class is smtplib.SMTP and os.getenv("NUMISMAT_SMTP_STARTTLS", "1") == "1":
            smtp.starttls()
        username = os.getenv("NUMISMAT_SMTP_USERNAME", "")
        password = os.getenv("NUMISMAT_SMTP_PASSWORD", "")
        if username:
            smtp.login(username, password)
        smtp.send_message(message)


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
        secure=os.getenv("NUMISMAT_COOKIE_SECURE") == "1",
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


def _user_public(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    return {"id": int(row["id"]), "email": row["email"], "role": row["role"]}


def _row_value(row: sqlite3.Row, key: str) -> Any:
    try:
        return row[key]
    except (KeyError, IndexError):
        return None


def _parse_photo_side(side: str | None) -> Literal["obverse", "reverse"]:
    value = (side or "obverse").strip().lower()
    if value in {"obverse", "avers", "аверс"}:
        return "obverse"
    if value in {"reverse", "revers", "реверс"}:
        return "reverse"
    raise HTTPException(422, "Укажите сторону: obverse или reverse")


def _photo_column(side: Literal["obverse", "reverse"]) -> str:
    return "photo_relpath" if side == "obverse" else "photo_reverse_relpath"


def _coin_relpath(row: sqlite3.Row, side: Literal["obverse", "reverse"]) -> str | None:
    value = _row_value(row, _photo_column(side))
    return str(value) if value else None


def _photo_url(coin_id: int, side: Literal["obverse", "reverse"], token: str | None = None) -> str:
    if token:
        return f"/api/v1/shares/view/{token}/coins/{coin_id}/photo?side={side}"
    return f"/api/v1/coins/{coin_id}/photo?side={side}"


def _coin_public(row: sqlite3.Row, token: str | None = None) -> dict[str, Any]:
    coin_id = int(row["id"])
    has_obverse = bool(_coin_relpath(row, "obverse"))
    has_reverse = bool(_coin_relpath(row, "reverse"))
    image = _photo_url(coin_id, "obverse", token) if has_obverse else None
    image_reverse = _photo_url(coin_id, "reverse", token) if has_reverse else None
    return {
        "id": coin_id,
        "title": row["title"],
        "subtitle": row["subtitle"],
        "country": row["country"],
        "year": int(row["year"]),
        "metal": row["metal"],
        "grade": row["grade"],
        "value": float(row["value"]),
        "color": row["color"],
        "mark": row["mark"],
        "hasPhoto": has_obverse,
        "hasPhotoObverse": has_obverse,
        "hasPhotoReverse": has_reverse,
        "image": image,
        "imageObverse": image,
        "imageReverse": image_reverse,
    }


def _coin_shared(row: sqlite3.Row, token: str) -> dict[str, Any]:
    return _coin_public(row, token)


def _public_origin(request: Request) -> str:
    env = os.getenv("NUMISMAT_PUBLIC_URL", "").strip().rstrip("/")
    if env:
        return env
    forwarded_host = (request.headers.get("x-forwarded-host") or "").split(",")[0].strip()
    proto = (request.headers.get("x-forwarded-proto") or request.url.scheme or "https").split(",")[0].strip()
    if forwarded_host:
        return f"{proto}://{forwarded_host}"
    host = request.headers.get("host")
    if host:
        return f"{proto}://{host}"
    return str(request.base_url).rstrip("/")


def _share_coin_id(row: sqlite3.Row) -> int | None:
    try:
        value = row["coin_id"]
    except (KeyError, IndexError):
        return None
    return int(value) if value is not None else None


def _share_public(row: sqlite3.Row, request: Request, coin_title: str | None = None) -> dict[str, Any]:
    token = str(row["token"])
    invitee_id = row["invitee_user_id"]
    coin_id = _share_coin_id(row)
    title = coin_title
    if title is None:
        try:
            title = row["coin_title"]
        except (KeyError, IndexError):
            title = None
    return {
        "id": int(row["id"]),
        "token": token,
        "url": f"{_public_origin(request)}/share/{token}",
        "access": row["access"],
        "email": row["invitee_email"],
        "userId": int(invitee_id) if invitee_id is not None else None,
        "created": row["created_at"],
        "scope": "coin" if coin_id is not None else "collection",
        "coinId": coin_id,
        "coinTitle": title,
    }


def _photo_response(relpath: str) -> FileResponse:
    if not relpath:
        raise HTTPException(404, "Фото не найдено")
    path = (_uploads_dir() / relpath).resolve()
    try:
        path.relative_to(_uploads_dir().resolve())
    except ValueError:
        raise HTTPException(404, "Фото не найдено") from None
    if not path.is_file():
        raise HTTPException(404, "Фото не найдено")
    media = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}.get(path.suffix, "application/octet-stream")
    return FileResponse(path, media_type=media)


def get_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    if not token:
        token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(401, "Нужна авторизация")
    try:
        user_id, session_version = _session_from_token(token)
    except (ValueError, KeyError, TypeError):
        raise HTTPException(401, "Сессия недействительна") from None
    with db() as conn:
        row = conn.execute(
            "SELECT id, email, role, session_version FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    if not row or int(row["session_version"]) != session_version:
        raise HTTPException(401, "Сессия недействительна")
    return _user_public(row)


def require_admin(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    if user.get("role") != "admin":
        raise HTTPException(403, "Недостаточно прав")
    return user


def _get_owned_coin(conn: sqlite3.Connection, user: dict[str, Any], coin_id: int) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM coins WHERE id = ?", (coin_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Монета не найдена")
    if int(row["user_id"]) != int(user["id"]) and user["role"] != "admin":
        raise HTTPException(404, "Монета не найдена")
    return row


class AuthIn(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class PasswordResetRequestIn(BaseModel):
    email: str = Field(min_length=3, max_length=254)


class PasswordResetConfirmIn(BaseModel):
    token: str = Field(min_length=32, max_length=256)
    password: str = Field(min_length=8, max_length=128)


class CoinIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    subtitle: str = Field(default="", max_length=400)
    country: str = Field(default="", max_length=120)
    year: int = 0
    metal: str = Field(default="", max_length=80)
    grade: str = Field(default="Не указана", max_length=80)
    value: float = 0
    color: str = Field(default="silver", max_length=40)
    mark: str = Field(default="₽", max_length=8)


class CoinPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    subtitle: str | None = Field(default=None, max_length=400)
    country: str | None = Field(default=None, max_length=120)
    year: int | None = None
    metal: str | None = Field(default=None, max_length=80)
    grade: str | None = Field(default=None, max_length=80)
    value: float | None = None
    color: str | None = Field(default=None, max_length=40)
    mark: str | None = Field(default=None, max_length=8)


class ShareIn(BaseModel):
    access: Literal["read", "write"] = "read"
    email: str | None = Field(default=None, max_length=254)
    coin_id: int | None = None


router = APIRouter(tags=["cabinet"])


@router.post("/api/v1/auth/register")
def register(body: AuthIn, response: Response) -> dict[str, Any]:
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(422, "Укажите корректный email")
    _validate_password(body.password)
    init_storage()
    with db() as conn:
        exists = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if exists:
            raise HTTPException(409, "Пользователь с таким email уже зарегистрирован")
        role = _role_for_new_user(conn, email)
        cursor = conn.execute(
            "INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)",
            (email, hash_password(body.password), role, _now()),
        )
        user = {"id": int(cursor.lastrowid), "email": email, "role": role}
    token = _token_for(user["id"])
    _set_session_cookie(response, token)
    return {"token": token, "user": user}


@router.post("/api/v1/auth/login")
def login(body: AuthIn, response: Response) -> dict[str, Any]:
    email = body.email.strip().lower()
    init_storage()
    with db() as conn:
        row = conn.execute(
            "SELECT id, email, role, password_hash, session_version FROM users WHERE email = ?",
            (email,),
        ).fetchone()
        if row is not None:
            _ensure_bootstrap_admin(conn)
            row = conn.execute(
                "SELECT id, email, role, password_hash, session_version FROM users WHERE email = ?",
                (email,),
            ).fetchone()
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(401, "Неверный email или пароль")
    user = _user_public(row)
    token = _token_for(user["id"], int(row["session_version"]))
    _set_session_cookie(response, token)
    return {"token": token, "user": user}


@router.post("/api/v1/auth/password-reset/request", status_code=202)
def request_password_reset(body: PasswordResetRequestIn, request: Request) -> dict[str, str]:
    email = body.email.strip().lower()
    init_storage()
    token: str | None = None
    token_hash: str | None = None
    user_id: int | None = None
    ttl_minutes = _env_int("NUMISMAT_PASSWORD_RESET_TTL_MINUTES", PASSWORD_RESET_TTL_MINUTES)
    with db() as conn:
        allowed = _rate_limit_reset(conn, kind="request", request=request, email=email)
        row = None
        if allowed and EMAIL_RE.match(email):
            row = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if row is not None:
            user_id = int(row["id"])
            token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            now = datetime.now(timezone.utc)
            conn.execute(
                "UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL",
                (now.isoformat(), user_id),
            )
            conn.execute(
                """
                INSERT INTO password_reset_tokens
                    (user_id, token_hash, expires_at, used_at, created_at)
                VALUES (?, ?, ?, NULL, ?)
                """,
                (user_id, token_hash, (now + timedelta(minutes=ttl_minutes)).isoformat(), now.isoformat()),
            )
    if token is not None and token_hash is not None:
        try:
            _send_password_reset_email(email, _password_reset_url(request, token), ttl_minutes)
        except Exception:  # noqa: BLE001 — ответ намеренно не раскрывает состояние доставки/аккаунта
            logger.exception("Не удалось отправить письмо восстановления пароля")
            with db() as conn:
                conn.execute(
                    "UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?",
                    (_now(), token_hash),
                )
    return {"message": PASSWORD_RESET_RESPONSE}


@router.post("/api/v1/auth/password-reset/confirm")
def confirm_password_reset(body: PasswordResetConfirmIn, request: Request) -> dict[str, str]:
    _validate_password(body.password)
    init_storage()
    token_hash = hashlib.sha256(body.token.encode()).hexdigest()
    now = _now()
    with db() as conn:
        if not _rate_limit_reset(conn, kind="confirm", request=request):
            raise HTTPException(429, "Слишком много попыток. Попробуйте позже")
        row = conn.execute(
            """
            SELECT id, user_id FROM password_reset_tokens
            WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
            """,
            (token_hash, now),
        ).fetchone()
        if row is None:
            raise HTTPException(400, "Ссылка недействительна или срок её действия истёк")
        consumed = conn.execute(
            """
            UPDATE password_reset_tokens SET used_at = ?
            WHERE id = ? AND used_at IS NULL
            """,
            (now, int(row["id"])),
        )
        if consumed.rowcount != 1:
            raise HTTPException(400, "Ссылка недействительна или срок её действия истёк")
        user_id = int(row["user_id"])
        conn.execute(
            """
            UPDATE users
            SET password_hash = ?, session_version = session_version + 1
            WHERE id = ?
            """,
            (hash_password(body.password), user_id),
        )
        conn.execute(
            """
            UPDATE password_reset_tokens SET used_at = ?
            WHERE user_id = ? AND used_at IS NULL
            """,
            (now, user_id),
        )
    return {"message": "Пароль изменён. Войдите с новым паролем."}


@router.post("/api/v1/auth/logout")
def logout(response: Response) -> dict[str, str]:
    _clear_session_cookie(response)
    return {"status": "ok"}


@router.get("/api/v1/me")
def me(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return user


@router.get("/api/v1/admin/users")
def admin_list_users(_admin: dict[str, Any] = Depends(require_admin)) -> list[dict[str, Any]]:
    init_storage()
    with db() as conn:
        rows = conn.execute(
            """
            SELECT u.id, u.email, u.role, u.created_at,
                   COUNT(c.id) AS coins_count
            FROM users u
            LEFT JOIN coins c ON c.user_id = u.id
            GROUP BY u.id
            ORDER BY u.id ASC
            """
        ).fetchall()
    return [
        {
            "id": int(row["id"]),
            "email": row["email"],
            "role": row["role"],
            "coinsCount": int(row["coins_count"]),
            "created": row["created_at"],
        }
        for row in rows
    ]


@router.get("/api/v1/admin/users/{user_id}/coins")
def admin_user_coins(user_id: int, _admin: dict[str, Any] = Depends(require_admin)) -> list[dict[str, Any]]:
    init_storage()
    with db() as conn:
        owner = conn.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone()
        if owner is None:
            raise HTTPException(404, "Пользователь не найден")
        rows = conn.execute(
            "SELECT * FROM coins WHERE user_id = ? ORDER BY id DESC",
            (user_id,),
        ).fetchall()
    return [_coin_public(row) for row in rows]


@router.get("/api/v1/coins")
def list_coins(user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    init_storage()
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM coins WHERE user_id = ? ORDER BY id DESC",
            (user["id"],),
        ).fetchall()
    return [_coin_public(row) for row in rows]


@router.post("/api/v1/coins", status_code=201)
def create_coin(body: CoinIn, user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    init_storage()
    with db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO coins (
                user_id, title, subtitle, country, year, metal, grade, value, color, mark, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user["id"],
                body.title.strip(),
                body.subtitle.strip(),
                body.country.strip(),
                int(body.year),
                body.metal.strip(),
                body.grade.strip(),
                float(body.value),
                body.color.strip() or "silver",
                body.mark.strip() or "₽",
                _now(),
            ),
        )
        row = conn.execute("SELECT * FROM coins WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return _coin_public(row)


@router.get("/api/v1/coins/{coin_id}")
def get_coin(coin_id: int, user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    with db() as conn:
        row = _get_owned_coin(conn, user, coin_id)
    return _coin_public(row)


@router.patch("/api/v1/coins/{coin_id}")
def patch_coin(
    coin_id: int,
    body: CoinPatch,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        with db() as conn:
            return _coin_public(_get_owned_coin(conn, user, coin_id))
    fields: list[str] = []
    values: list[Any] = []
    for key, value in updates.items():
        if isinstance(value, str):
            value = value.strip()
        fields.append(f"{key} = ?")
        values.append(value)
    with db() as conn:
        _get_owned_coin(conn, user, coin_id)
        values.append(coin_id)
        conn.execute(f"UPDATE coins SET {', '.join(fields)} WHERE id = ?", values)
        row = conn.execute("SELECT * FROM coins WHERE id = ?", (coin_id,)).fetchone()
    return _coin_public(row)


@router.delete("/api/v1/coins/{coin_id}", status_code=204)
def delete_coin(coin_id: int, user: dict[str, Any] = Depends(get_current_user)) -> Response:
    with db() as conn:
        row = _get_owned_coin(conn, user, coin_id)
        paths = [_coin_relpath(row, "obverse"), _coin_relpath(row, "reverse")]
        conn.execute("DELETE FROM shares WHERE coin_id = ?", (coin_id,))
        conn.execute("DELETE FROM coins WHERE id = ?", (coin_id,))
    for relpath in {item for item in paths if item}:
        _unlink_photo(relpath)
    return Response(status_code=204)


@router.post("/api/v1/coins/{coin_id}/photo")
async def upload_photo(
    coin_id: int,
    file: UploadFile = File(...),
    side: str = Query(default="obverse"),
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    parsed = _parse_photo_side(side)
    content_type = (file.content_type or "").lower()
    suffix = ALLOWED_PHOTO_TYPES.get(content_type)
    if suffix is None:
        raise HTTPException(415, "Поддерживаются JPG, PNG и WEBP")
    payload = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Изображение превышает 15 МБ")
    try:
        image = Image.open(io.BytesIO(payload))
        image.verify()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(422, "Не удалось прочитать изображение") from None

    init_storage()
    relpath = f"{user['id']}/{uuid.uuid4().hex}{suffix}"
    destination = _uploads_dir() / relpath
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(payload)

    column = _photo_column(parsed)
    with db() as conn:
        row = _get_owned_coin(conn, user, coin_id)
        old = _coin_relpath(row, parsed)
        conn.execute(f"UPDATE coins SET {column} = ? WHERE id = ?", (relpath, coin_id))
        row = conn.execute("SELECT * FROM coins WHERE id = ?", (coin_id,)).fetchone()
    if old and old != relpath:
        _unlink_photo(old)
    return _coin_public(row)


@router.get("/api/v1/coins/{coin_id}/photo")
def get_photo(
    coin_id: int,
    side: str = Query(default="obverse"),
    user: dict[str, Any] = Depends(get_current_user),
) -> FileResponse:
    parsed = _parse_photo_side(side)
    with db() as conn:
        row = _get_owned_coin(conn, user, coin_id)
        relpath = _coin_relpath(row, parsed)
    return _photo_response(relpath or "")


@router.post("/api/v1/shares", status_code=201)
def create_share(
    body: ShareIn,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    email = body.email.strip().lower() if body.email else None
    if email:
        if not EMAIL_RE.match(email):
            raise HTTPException(422, "Укажите корректный email")
        if email == user["email"]:
            raise HTTPException(400, "Нельзя открыть доступ самому себе")
    init_storage()
    with db() as conn:
        coin_id = body.coin_id
        coin_title: str | None = None
        if coin_id is not None:
            owned = conn.execute(
                "SELECT * FROM coins WHERE id = ? AND user_id = ?",
                (coin_id, user["id"]),
            ).fetchone()
            if owned is None:
                raise HTTPException(404, "Монета не найдена")
            coin_title = owned["title"]
        invitee_id: int | None = None
        if email:
            found = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
            invitee_id = int(found["id"]) if found else None
            if coin_id is None:
                existing = conn.execute(
                    "SELECT * FROM shares WHERE owner_id = ? AND invitee_email = ? AND coin_id IS NULL",
                    (user["id"], email),
                ).fetchone()
            else:
                existing = conn.execute(
                    "SELECT * FROM shares WHERE owner_id = ? AND invitee_email = ? AND coin_id = ?",
                    (user["id"], email, coin_id),
                ).fetchone()
            if existing is not None:
                conn.execute(
                    "UPDATE shares SET access = ?, invitee_user_id = ? WHERE id = ?",
                    (body.access, invitee_id, int(existing["id"])),
                )
                row = conn.execute("SELECT * FROM shares WHERE id = ?", (int(existing["id"]),)).fetchone()
                return _share_public(row, request, coin_title)
        token = secrets.token_urlsafe(24)
        cursor = conn.execute(
            """
            INSERT INTO shares (owner_id, token, access, invitee_email, invitee_user_id, coin_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (user["id"], token, body.access, email, invitee_id, coin_id, _now()),
        )
        row = conn.execute("SELECT * FROM shares WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return _share_public(row, request, coin_title)


@router.get("/api/v1/shares")
def list_shares(request: Request, user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    init_storage()
    with db() as conn:
        rows = conn.execute(
            """
            SELECT s.*, c.title AS coin_title
            FROM shares s
            LEFT JOIN coins c ON c.id = s.coin_id
            WHERE s.owner_id = ?
            ORDER BY s.id DESC
            """,
            (user["id"],),
        ).fetchall()
    return [_share_public(row, request) for row in rows]


@router.get("/api/v1/shares/inbox")
def share_inbox(request: Request, user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    init_storage()
    with db() as conn:
        rows = conn.execute(
            """
            SELECT s.*, u.email AS owner_email, coin.title AS coin_title,
                   CASE
                       WHEN s.coin_id IS NOT NULL THEN 1
                       ELSE (SELECT COUNT(*) FROM coins c WHERE c.user_id = s.owner_id)
                   END AS coins_count
            FROM shares s
            JOIN users u ON u.id = s.owner_id
            LEFT JOIN coins coin ON coin.id = s.coin_id
            WHERE s.owner_id != ?
              AND (s.invitee_user_id = ? OR s.invitee_email = ?)
            ORDER BY s.id DESC
            """,
            (user["id"], user["id"], user["email"]),
        ).fetchall()
    result: list[dict[str, Any]] = []
    for row in rows:
        item = _share_public(row, request)
        item["ownerId"] = int(row["owner_id"])
        item["ownerEmail"] = row["owner_email"]
        item["coinsCount"] = int(row["coins_count"])
        result.append(item)
    return result


@router.get("/api/v1/shares/view/{token}")
def view_share(token: str) -> dict[str, Any]:
    init_storage()
    with db() as conn:
        share = conn.execute("SELECT * FROM shares WHERE token = ?", (token,)).fetchone()
        if share is None:
            raise HTTPException(404, "Ссылка недействительна или доступ отозван")
        owner = conn.execute("SELECT id, email FROM users WHERE id = ?", (int(share["owner_id"]),)).fetchone()
        coin_id = _share_coin_id(share)
        if coin_id is not None:
            rows = conn.execute(
                "SELECT * FROM coins WHERE id = ? AND user_id = ?",
                (coin_id, int(share["owner_id"])),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM coins WHERE user_id = ? ORDER BY id DESC",
                (int(share["owner_id"]),),
            ).fetchall()
    return {
        "token": token,
        "access": share["access"],
        "scope": "coin" if coin_id is not None else "collection",
        "coinId": coin_id,
        "owner": {"id": int(owner["id"]), "email": owner["email"]} if owner else None,
        "coins": [_coin_shared(row, token) for row in rows],
    }


@router.get("/api/v1/shares/view/{token}/coins/{coin_id}/photo")
def view_share_photo(
    token: str,
    coin_id: int,
    side: str = Query(default="obverse"),
) -> FileResponse:
    parsed = _parse_photo_side(side)
    init_storage()
    with db() as conn:
        share = conn.execute("SELECT * FROM shares WHERE token = ?", (token,)).fetchone()
        if share is None:
            raise HTTPException(404, "Ссылка недействительна или доступ отозван")
        share_coin_id = _share_coin_id(share)
        if share_coin_id is not None and share_coin_id != coin_id:
            raise HTTPException(404, "Монета не найдена")
        row = conn.execute(
            "SELECT * FROM coins WHERE id = ? AND user_id = ?",
            (coin_id, int(share["owner_id"])),
        ).fetchone()
        if row is None:
            raise HTTPException(404, "Монета не найдена")
        relpath = _coin_relpath(row, parsed)
    return _photo_response(relpath or "")


@router.delete("/api/v1/shares/{share_id}", status_code=204)
def revoke_share(share_id: int, user: dict[str, Any] = Depends(get_current_user)) -> Response:
    init_storage()
    with db() as conn:
        row = conn.execute("SELECT * FROM shares WHERE id = ?", (share_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "Доступ не найден")
        if int(row["owner_id"]) != int(user["id"]) and user["role"] != "admin":
            raise HTTPException(404, "Доступ не найден")
        conn.execute("DELETE FROM shares WHERE id = ?", (share_id,))
    return Response(status_code=204)


def _unlink_photo(relpath: str) -> None:
    path = (_uploads_dir() / relpath).resolve()
    try:
        path.relative_to(_uploads_dir().resolve())
    except ValueError:
        return
    if path.is_file():
        path.unlink()
