#!/usr/bin/env python3
"""Личные кабинеты: регистрация, сессии и коллекция на сервере."""

from __future__ import annotations

import base64
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterator

from fastapi import APIRouter, Depends, File, Header, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
COOKIE_NAME = "numismat_session"
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
ALLOWED_PHOTO_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
PBKDF2_ITERATIONS = 210_000

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


def _token_for(user_id: int) -> str:
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = _b64url(json.dumps({
        "sub": str(user_id),
        "exp": int((datetime.now(timezone.utc) + timedelta(days=7)).timestamp()),
    }, separators=(",", ":")).encode())
    signing = f"{header}.{payload}".encode()
    signature = hmac.new(_secret_key().encode(), signing, hashlib.sha256).digest()
    return f"{header}.{payload}.{_b64url(signature)}"


def _user_id_from_token(token: str) -> int:
    _header_b64, payload_b64, signature_b64 = token.split(".")
    signing = f"{_header_b64}.{payload_b64}".encode()
    expected = _b64url(hmac.new(_secret_key().encode(), signing, hashlib.sha256).digest())
    if not hmac.compare_digest(expected, signature_b64):
        raise ValueError("bad signature")
    payload = json.loads(_b64url_decode(payload_b64))
    if int(payload.get("exp", 0)) < int(datetime.now(timezone.utc).timestamp()):
        raise ValueError("expired")
    return int(payload["sub"])


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
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            CREATE INDEX IF NOT EXISTS idx_coins_user ON coins(user_id);
            """
        )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


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


def _coin_public(row: sqlite3.Row) -> dict[str, Any]:
    has_photo = bool(row["photo_relpath"])
    coin_id = int(row["id"])
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
        "hasPhoto": has_photo,
        "image": f"/api/v1/coins/{coin_id}/photo" if has_photo else None,
    }


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
        user_id = _user_id_from_token(token)
    except (ValueError, KeyError, TypeError):
        raise HTTPException(401, "Сессия недействительна") from None
    with db() as conn:
        row = conn.execute("SELECT id, email, role FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        raise HTTPException(401, "Сессия недействительна")
    return _user_public(row)


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


router = APIRouter(tags=["cabinet"])


@router.post("/api/v1/auth/register")
def register(body: AuthIn, response: Response) -> dict[str, Any]:
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(422, "Укажите корректный email")
    init_storage()
    with db() as conn:
        exists = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if exists:
            raise HTTPException(409, "Пользователь с таким email уже зарегистрирован")
        cursor = conn.execute(
            "INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, 'user', ?)",
            (email, hash_password(body.password), _now()),
        )
        user = {"id": int(cursor.lastrowid), "email": email, "role": "user"}
    token = _token_for(user["id"])
    _set_session_cookie(response, token)
    return {"token": token, "user": user}


@router.post("/api/v1/auth/login")
def login(body: AuthIn, response: Response) -> dict[str, Any]:
    email = body.email.strip().lower()
    init_storage()
    with db() as conn:
        row = conn.execute(
            "SELECT id, email, role, password_hash FROM users WHERE email = ?",
            (email,),
        ).fetchone()
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(401, "Неверный email или пароль")
    user = _user_public(row)
    token = _token_for(user["id"])
    _set_session_cookie(response, token)
    return {"token": token, "user": user}


@router.post("/api/v1/auth/logout")
def logout(response: Response) -> dict[str, str]:
    _clear_session_cookie(response)
    return {"status": "ok"}


@router.get("/api/v1/me")
def me(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return user


@router.get("/api/v1/coins")
def list_coins(user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    init_storage()
    with db() as conn:
        if user["role"] == "admin":
            rows = conn.execute("SELECT * FROM coins ORDER BY id DESC").fetchall()
        else:
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
        relpath = row["photo_relpath"]
        conn.execute("DELETE FROM coins WHERE id = ?", (coin_id,))
    if relpath:
        _unlink_photo(relpath)
    return Response(status_code=204)


@router.post("/api/v1/coins/{coin_id}/photo")
async def upload_photo(
    coin_id: int,
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
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

    with db() as conn:
        row = _get_owned_coin(conn, user, coin_id)
        old = row["photo_relpath"]
        conn.execute("UPDATE coins SET photo_relpath = ? WHERE id = ?", (relpath, coin_id))
        row = conn.execute("SELECT * FROM coins WHERE id = ?", (coin_id,)).fetchone()
    if old:
        _unlink_photo(old)
    return _coin_public(row)


@router.get("/api/v1/coins/{coin_id}/photo")
def get_photo(coin_id: int, user: dict[str, Any] = Depends(get_current_user)) -> FileResponse:
    with db() as conn:
        row = _get_owned_coin(conn, user, coin_id)
        relpath = row["photo_relpath"]
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


def _unlink_photo(relpath: str) -> None:
    path = (_uploads_dir() / relpath).resolve()
    try:
        path.relative_to(_uploads_dir().resolve())
    except ValueError:
        return
    if path.is_file():
        path.unlink()
