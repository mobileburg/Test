#!/usr/bin/env python3
"""Очередь фидбека распознавания: карантин пользователей и истина администратора."""

from __future__ import annotations

import io
import json
import shutil
import uuid
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field
from starlette.datastructures import UploadFile as StarletteUploadFile

from ml.accounts import (
    ALLOWED_PHOTO_TYPES,
    MAX_UPLOAD_BYTES,
    _get_owned_coin,
    _now,
    _photo_response,
    _uploads_dir,
    db,
    get_current_user,
    init_storage,
    require_admin,
)

router = APIRouter(tags=["feedback"])


def init_feedback_storage() -> None:
    init_storage()
    _uploads_dir().mkdir(parents=True, exist_ok=True)
    (_uploads_dir() / "feedback").mkdir(parents=True, exist_ok=True)
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS recognition_feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                coin_id INTEGER,
                photo_relpath TEXT,
                predicted_catalog TEXT NOT NULL,
                predicted_title TEXT NOT NULL DEFAULT '',
                predicted_json TEXT NOT NULL DEFAULT '{}',
                verdict TEXT NOT NULL,
                comment TEXT NOT NULL DEFAULT '',
                retry INTEGER NOT NULL DEFAULT 0,
                review_status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL,
                reviewed_at TEXT,
                reviewed_by INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            CREATE INDEX IF NOT EXISTS idx_feedback_status ON recognition_feedback(review_status);
            CREATE INDEX IF NOT EXISTS idx_feedback_user ON recognition_feedback(user_id);
            """
        )


def parse_exclude_list(value: str | None) -> list[str]:
    if not value:
        return []
    text = value.strip()
    if not text:
        return []
    if text.startswith("["):
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            parsed = None
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    return [item.strip() for item in text.split(",") if item.strip()]


def catalogs_for_exclude_ids(exclude_ids: str | None) -> set[str]:
    catalogs: set[str] = set()
    for raw in parse_exclude_list(exclude_ids):
        if not raw.isdigit():
            continue
        with db() as conn:
            row = conn.execute(
                "SELECT predicted_catalog FROM recognition_feedback WHERE id = ?",
                (int(raw),),
            ).fetchone()
        if row and row["predicted_catalog"]:
            catalogs.add(str(row["predicted_catalog"]))
    return catalogs


def resolve_excluded_catalogs(
    exclude_catalogs: str | None = None,
    exclude_ids: str | None = None,
) -> set[str]:
    return set(parse_exclude_list(exclude_catalogs)) | catalogs_for_exclude_ids(exclude_ids)


def _status_for_user(user: dict[str, Any]) -> str:
    return "approved" if user.get("role") == "admin" else "pending"


def _feedback_public(row: Any, user_email: str | None = None) -> dict[str, Any]:
    feedback_id = int(row["id"])
    has_photo = bool(row["photo_relpath"])
    try:
        predicted = json.loads(row["predicted_json"] or "{}")
    except json.JSONDecodeError:
        predicted = {}
    return {
        "id": feedback_id,
        "userId": int(row["user_id"]),
        "userEmail": user_email or "",
        "coinId": int(row["coin_id"]) if row["coin_id"] is not None else None,
        "predictedCatalog": row["predicted_catalog"],
        "predictedTitle": row["predicted_title"],
        "predicted": predicted if isinstance(predicted, dict) else {},
        "verdict": row["verdict"],
        "comment": row["comment"] or "",
        "retry": bool(row["retry"]),
        "reviewStatus": row["review_status"],
        "createdAt": row["created_at"],
        "reviewedAt": row["reviewed_at"],
        "hasPhoto": has_photo,
        "photo": f"/api/v1/admin/feedback/{feedback_id}/photo" if has_photo else None,
    }


def _save_photo(user_id: int, payload: bytes, suffix: str) -> str:
    relpath = f"feedback/{user_id}/{uuid.uuid4().hex}{suffix}"
    destination = _uploads_dir() / relpath
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(payload)
    return relpath


def _copy_coin_photo(conn: Any, user: dict[str, Any], coin_id: int) -> str | None:
    row = _get_owned_coin(conn, user, coin_id)
    relpath = row["photo_relpath"]
    if not relpath:
        return None
    source = (_uploads_dir() / relpath).resolve()
    try:
        source.relative_to(_uploads_dir().resolve())
    except ValueError:
        return None
    if not source.is_file():
        return None
    dest_rel = f"feedback/{user['id']}/{uuid.uuid4().hex}{source.suffix or '.jpg'}"
    destination = _uploads_dir() / dest_rel
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return dest_rel


def _read_upload(upload: UploadFile) -> tuple[bytes, str]:
    content_type = (upload.content_type or "").lower()
    suffix = ALLOWED_PHOTO_TYPES.get(content_type)
    if suffix is None:
        raise HTTPException(415, "Поддерживаются JPG, PNG и WEBP")
    payload = upload.file.read(MAX_UPLOAD_BYTES + 1)
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Изображение превышает 15 МБ")
    try:
        image = Image.open(io.BytesIO(payload))
        image.verify()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(422, "Не удалось прочитать изображение") from None
    return payload, suffix


def _insert_feedback(
    user: dict[str, Any],
    *,
    coin_id: int | None,
    predicted_catalog: str,
    predicted_title: str,
    predicted_json: str,
    verdict: str,
    comment: str,
    retry: bool,
    photo_relpath: str | None,
) -> dict[str, Any]:
    catalog = predicted_catalog.strip()
    if not catalog:
        raise HTTPException(422, "Укажите предсказанный каталожный номер")
    if verdict not in {"correct", "incorrect"}:
        raise HTTPException(422, "Вердикт должен быть correct или incorrect")
    status = _status_for_user(user)
    now = _now()
    init_feedback_storage()
    with db() as conn:
        if coin_id is not None:
            _get_owned_coin(conn, user, coin_id)
            if photo_relpath is None:
                photo_relpath = _copy_coin_photo(conn, user, coin_id)
        cursor = conn.execute(
            """
            INSERT INTO recognition_feedback (
                user_id, coin_id, photo_relpath, predicted_catalog, predicted_title,
                predicted_json, verdict, comment, retry, review_status, created_at,
                reviewed_at, reviewed_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user["id"],
                coin_id,
                photo_relpath,
                catalog,
                (predicted_title or "").strip()[:200],
                predicted_json or "{}",
                verdict,
                (comment or "").strip()[:2000],
                1 if retry else 0,
                status,
                now,
                now if status == "approved" else None,
                user["id"] if status == "approved" else None,
            ),
        )
        row = conn.execute(
            """
            SELECT f.*, u.email AS user_email
            FROM recognition_feedback f
            JOIN users u ON u.id = f.user_id
            WHERE f.id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
    return _feedback_public(row, row["user_email"])


class FeedbackIn(BaseModel):
    coin_id: int | None = None
    predicted_catalog: str = Field(min_length=1, max_length=80)
    predicted_title: str = Field(default="", max_length=200)
    predicted: dict[str, Any] | None = None
    verdict: Literal["correct", "incorrect"]
    comment: str = Field(default="", max_length=2000)
    retry: bool = False


def _as_bool(value: Any) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _as_optional_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        raise HTTPException(422, "coin_id должен быть числом") from None


@router.post("/api/v1/feedback", status_code=201)
async def create_feedback(
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    content_type = (request.headers.get("content-type") or "").lower()
    if "application/json" in content_type:
        body = FeedbackIn.model_validate(await request.json())
        snapshot = json.dumps(body.predicted or {}, ensure_ascii=False)
        return _insert_feedback(
            user,
            coin_id=body.coin_id,
            predicted_catalog=body.predicted_catalog,
            predicted_title=body.predicted_title,
            predicted_json=snapshot,
            verdict=body.verdict,
            comment=body.comment,
            retry=body.retry,
            photo_relpath=None,
        )

    if "multipart/form-data" not in content_type:
        raise HTTPException(415, "Ожидается JSON или multipart/form-data")

    form = await request.form()
    predicted_catalog = str(form.get("predicted_catalog") or "")
    verdict = str(form.get("verdict") or "")
    if not predicted_catalog or not verdict:
        raise HTTPException(422, "Укажите predicted_catalog и verdict")

    photo_relpath: str | None = None
    upload = form.get("photo") or form.get("file")
    if isinstance(upload, (UploadFile, StarletteUploadFile)) and upload.filename:
        payload, suffix = _read_upload(upload)
        photo_relpath = _save_photo(int(user["id"]), payload, suffix)

    snapshot = str(form.get("predicted_json") or "").strip() or "{}"
    if snapshot != "{}":
        try:
            parsed = json.loads(snapshot)
            if not isinstance(parsed, dict):
                snapshot = "{}"
        except json.JSONDecodeError:
            snapshot = "{}"

    return _insert_feedback(
        user,
        coin_id=_as_optional_int(form.get("coin_id")),
        predicted_catalog=predicted_catalog,
        predicted_title=str(form.get("predicted_title") or ""),
        predicted_json=snapshot,
        verdict=verdict,
        comment=str(form.get("comment") or ""),
        retry=_as_bool(form.get("retry")),
        photo_relpath=photo_relpath,
    )


@router.get("/api/v1/admin/feedback")
def admin_list_feedback(
    status: str = "pending",
    _admin: dict[str, Any] = Depends(require_admin),
) -> list[dict[str, Any]]:
    init_feedback_storage()
    allowed = {"pending", "approved", "rejected", "all"}
    if status not in allowed:
        raise HTTPException(422, "status: pending, approved, rejected или all")
    with db() as conn:
        if status == "all":
            rows = conn.execute(
                """
                SELECT f.*, u.email AS user_email
                FROM recognition_feedback f
                JOIN users u ON u.id = f.user_id
                ORDER BY f.id DESC
                """
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT f.*, u.email AS user_email
                FROM recognition_feedback f
                JOIN users u ON u.id = f.user_id
                WHERE f.review_status = ?
                ORDER BY f.id DESC
                """,
                (status,),
            ).fetchall()
    return [_feedback_public(row, row["user_email"]) for row in rows]


@router.get("/api/v1/admin/feedback/{feedback_id}/photo")
def admin_feedback_photo(
    feedback_id: int,
    _admin: dict[str, Any] = Depends(require_admin),
) -> FileResponse:
    init_feedback_storage()
    with db() as conn:
        row = conn.execute(
            "SELECT photo_relpath FROM recognition_feedback WHERE id = ?",
            (feedback_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(404, "Запись не найдена")
    return _photo_response(row["photo_relpath"] or "")


def _set_review(feedback_id: int, status: str, admin: dict[str, Any]) -> dict[str, Any]:
    init_feedback_storage()
    with db() as conn:
        row = conn.execute(
            "SELECT id FROM recognition_feedback WHERE id = ?",
            (feedback_id,),
        ).fetchone()
        if row is None:
            raise HTTPException(404, "Запись не найдена")
        conn.execute(
            """
            UPDATE recognition_feedback
            SET review_status = ?, reviewed_at = ?, reviewed_by = ?
            WHERE id = ?
            """,
            (status, _now(), admin["id"], feedback_id),
        )
        row = conn.execute(
            """
            SELECT f.*, u.email AS user_email
            FROM recognition_feedback f
            JOIN users u ON u.id = f.user_id
            WHERE f.id = ?
            """,
            (feedback_id,),
        ).fetchone()
    return _feedback_public(row, row["user_email"])


@router.post("/api/v1/admin/feedback/{feedback_id}/approve")
def admin_approve_feedback(
    feedback_id: int,
    admin: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    return _set_review(feedback_id, "approved", admin)


@router.post("/api/v1/admin/feedback/{feedback_id}/reject")
def admin_reject_feedback(
    feedback_id: int,
    admin: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    return _set_review(feedback_id, "rejected", admin)


def approved_training_rows() -> list[dict[str, Any]]:
    """Одобренные верные оценки с фото — для build_dataset / train."""
    init_feedback_storage()
    rows: list[dict[str, Any]] = []
    with db() as conn:
        records = conn.execute(
            """
            SELECT * FROM recognition_feedback
            WHERE review_status = 'approved' AND verdict = 'correct' AND photo_relpath IS NOT NULL
            ORDER BY id ASC
            """
        ).fetchall()
    uploads = _uploads_dir()
    for row in records:
        path = uploads / str(row["photo_relpath"])
        if not path.is_file():
            continue
        try:
            predicted = json.loads(row["predicted_json"] or "{}")
        except json.JSONDecodeError:
            predicted = {}
        if not isinstance(predicted, dict):
            predicted = {}
        year = predicted.get("year") or 0
        rows.append({
            "id": f"user-feedback:{row['id']}",
            "catalog_number": row["predicted_catalog"],
            "title_ru": str(predicted.get("subtitle") or row["predicted_title"] or ""),
            "nominal_ru": str(predicted.get("title") or row["predicted_title"] or ""),
            "metal_ru": str(predicted.get("metal") or ""),
            "release_date": f"{int(year) if str(year).isdigit() else 0}-01-01",
            "country_ru": str(predicted.get("country") or "Россия"),
            "image": str(path),
            "side": "unknown",
            "review_status": "approved",
            "trusted": False,
            "source": "Пользователь Нумизмата",
            "source_url": predicted.get("sourceUrl") or "",
        })
    return rows


def export_approved_manifest(dest: Path) -> int:
    dest.parent.mkdir(parents=True, exist_ok=True)
    rows = approved_training_rows()
    with dest.open("w", encoding="utf-8") as target:
        for row in rows:
            target.write(json.dumps(row, ensure_ascii=False) + "\n")
    return len(rows)
