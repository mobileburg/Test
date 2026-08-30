#!/usr/bin/env python3
"""Локальная проверка очереди обучения без загрузки CLIP."""

from __future__ import annotations

import io
import os
import sys
import tempfile
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def _jpeg() -> tuple[str, io.BytesIO, str]:
    buf = io.BytesIO()
    Image.new("RGB", (16, 16), (110, 80, 40)).save(buf, format="JPEG")
    buf.seek(0)
    return "coin.jpg", buf, "image/jpeg"


def run() -> None:
    data = Path(tempfile.mkdtemp(prefix="numismat-feedback-"))
    os.environ["NUMISMAT_DATA_DIR"] = str(data)
    os.environ["NUMISMAT_UPLOADS_DIR"] = str(data / "uploads")
    os.environ.pop("NUMISMAT_ADMIN_EMAIL", None)

    from ml.accounts import init_storage, router as accounts_router
    from ml.feedback import (
        init_feedback_storage,
        parse_exclude_list,
        resolve_excluded_catalogs,
        router as feedback_router,
    )

    assert parse_exclude_list("5111-0001, 5111-0002") == ["5111-0001", "5111-0002"]
    assert parse_exclude_list('["A","B"]') == ["A", "B"]

    init_storage()
    init_feedback_storage()
    app = FastAPI()
    app.include_router(accounts_router)
    app.include_router(feedback_router)
    client = TestClient(app)

    admin = client.post("/api/v1/auth/register", json={"email": "admin@example.com", "password": "password1"})
    assert admin.status_code == 200, admin.text
    admin_token = admin.json()["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    user = client.post("/api/v1/auth/register", json={"email": "user@example.com", "password": "password1"})
    assert user.status_code == 200, user.text
    user_token = user.json()["token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    forbidden = client.get("/api/v1/admin/feedback", headers=user_headers)
    assert forbidden.status_code == 403, forbidden.text
    anon = TestClient(app).get("/api/v1/admin/feedback")
    assert anon.status_code == 401, anon.text

    user_item = client.post(
        "/api/v1/feedback",
        headers=user_headers,
        data={
            "predicted_catalog": "5111-0001",
            "predicted_title": "5 рублей",
            "verdict": "incorrect",
            "comment": "Это не юбилейные 5 рублей",
            "retry": "true",
        },
        files={"photo": _jpeg()},
    )
    assert user_item.status_code == 201, user_item.text
    user_payload = user_item.json()
    assert user_payload["reviewStatus"] == "pending"
    assert user_payload["verdict"] == "incorrect"
    assert user_payload["retry"] is True
    assert user_payload["hasPhoto"] is True

    admin_item = client.post(
        "/api/v1/feedback",
        headers=admin_headers,
        json={
            "predicted_catalog": "5111-0099",
            "predicted_title": "10 рублей",
            "verdict": "correct",
            "comment": "Совпадает с эталоном",
        },
    )
    assert admin_item.status_code == 201, admin_item.text
    admin_payload = admin_item.json()
    assert admin_payload["reviewStatus"] == "approved", admin_payload
    assert admin_payload["verdict"] == "correct"

    pending = client.get("/api/v1/admin/feedback", headers=admin_headers)
    assert pending.status_code == 200, pending.text
    pending_ids = {item["id"] for item in pending.json()}
    assert user_payload["id"] in pending_ids
    assert admin_payload["id"] not in pending_ids

    approved = client.get("/api/v1/admin/feedback?status=approved", headers=admin_headers)
    assert approved.status_code == 200
    assert {item["id"] for item in approved.json()} == {admin_payload["id"]}

    user_approve = client.post(
        f"/api/v1/admin/feedback/{user_payload['id']}/approve",
        headers=user_headers,
    )
    assert user_approve.status_code == 403, user_approve.text

    decided = client.post(
        f"/api/v1/admin/feedback/{user_payload['id']}/approve",
        headers=admin_headers,
    )
    assert decided.status_code == 200, decided.text
    assert decided.json()["reviewStatus"] == "approved"

    rejected = client.post(
        "/api/v1/feedback",
        headers=user_headers,
        json={"predicted_catalog": "5216-0066", "verdict": "incorrect"},
    )
    assert rejected.status_code == 201
    reject_id = rejected.json()["id"]
    reject = client.post(f"/api/v1/admin/feedback/{reject_id}/reject", headers=admin_headers)
    assert reject.status_code == 200
    assert reject.json()["reviewStatus"] == "rejected"

    excluded = resolve_excluded_catalogs("5111-0001", str(user_payload["id"]))
    assert "5111-0001" in excluded

    photo = client.get(f"/api/v1/admin/feedback/{user_payload['id']}/photo", headers=admin_headers)
    assert photo.status_code == 200, photo.text
    print("FEEDBACK_API_OK", data)


if __name__ == "__main__":
    run()
