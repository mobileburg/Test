#!/usr/bin/env python3
"""Локальная проверка аверса и реверса без загрузки CLIP."""

from __future__ import annotations

import io
import os
import sqlite3
import sys
import tempfile
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def _jpeg(color: tuple[int, int, int]) -> tuple[str, io.BytesIO, str]:
    buf = io.BytesIO()
    Image.new("RGB", (16, 16), color).save(buf, format="JPEG")
    buf.seek(0)
    return "coin.jpg", buf, "image/jpeg"


def run() -> None:
    data = Path(tempfile.mkdtemp(prefix="numismat-sides-"))
    os.environ["NUMISMAT_DATA_DIR"] = str(data)
    os.environ["NUMISMAT_UPLOADS_DIR"] = str(data / "uploads")
    os.environ["NUMISMAT_PUBLIC_URL"] = "https://app-66ba5c12d8dc.vibecode.bitrix24.tech"
    os.environ.pop("NUMISMAT_ADMIN_EMAIL", None)

    from ml.accounts import init_storage, router

    init_storage()
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    owner = client.post("/api/v1/auth/register", json={"email": "owner@example.com", "password": "password1"})
    assert owner.status_code == 200, owner.text
    headers = {"Authorization": f"Bearer {owner.json()['token']}"}

    created = client.post(
        "/api/v1/coins",
        headers=headers,
        json={"title": "Рубль", "subtitle": "Две стороны", "country": "Россия", "year": 2024, "metal": "серебро"},
    )
    assert created.status_code == 201, created.text
    coin_id = created.json()["id"]
    body = created.json()
    assert body["hasPhoto"] is False
    assert body["hasPhotoObverse"] is False
    assert body["hasPhotoReverse"] is False
    assert body["image"] is None
    assert body["imageReverse"] is None

    bad_side = client.post(
        f"/api/v1/coins/{coin_id}/photo?side=edge",
        headers=headers,
        files={"file": _jpeg((10, 20, 30))},
    )
    assert bad_side.status_code == 422, bad_side.text

    uploaded = client.post(
        f"/api/v1/coins/{coin_id}/photo",
        headers=headers,
        files={"file": _jpeg((180, 40, 40))},
    )
    assert uploaded.status_code == 200, uploaded.text
    payload = uploaded.json()
    assert payload["hasPhoto"] is True
    assert payload["hasPhotoObverse"] is True
    assert payload["hasPhotoReverse"] is False
    assert payload["image"].endswith(f"/api/v1/coins/{coin_id}/photo?side=obverse")
    assert payload["imageObverse"] == payload["image"]
    assert payload["imageReverse"] is None

    obverse = client.get(f"/api/v1/coins/{coin_id}/photo", headers=headers)
    assert obverse.status_code == 200, obverse.text
    default_side = client.get(f"/api/v1/coins/{coin_id}/photo?side=obverse", headers=headers)
    assert default_side.status_code == 200
    missing_reverse = client.get(f"/api/v1/coins/{coin_id}/photo?side=reverse", headers=headers)
    assert missing_reverse.status_code == 404

    reverse = client.post(
        f"/api/v1/coins/{coin_id}/photo?side=reverse",
        headers=headers,
        files={"file": _jpeg((40, 80, 180))},
    )
    assert reverse.status_code == 200, reverse.text
    both = reverse.json()
    assert both["hasPhotoObverse"] is True
    assert both["hasPhotoReverse"] is True
    assert both["imageReverse"].endswith(f"/api/v1/coins/{coin_id}/photo?side=reverse")

    reverse_get = client.get(f"/api/v1/coins/{coin_id}/photo?side=reverse", headers=headers)
    assert reverse_get.status_code == 200
    assert reverse_get.content != obverse.content

    listed = client.get("/api/v1/coins", headers=headers)
    assert listed.status_code == 200
    assert listed.json()[0]["imageReverse"].endswith("side=reverse")

    share = client.post("/api/v1/shares", headers=headers, json={"access": "read", "coin_id": coin_id})
    assert share.status_code == 201, share.text
    token = share.json()["token"]
    viewed = TestClient(app).get(f"/api/v1/shares/view/{token}")
    assert viewed.status_code == 200, viewed.text
    shared_coin = viewed.json()["coins"][0]
    assert shared_coin["hasPhotoObverse"] is True
    assert shared_coin["hasPhotoReverse"] is True
    assert f"/shares/view/{token}/coins/{coin_id}/photo?side=obverse" in shared_coin["image"]
    assert f"/shares/view/{token}/coins/{coin_id}/photo?side=reverse" in shared_coin["imageReverse"]

    share_obverse = TestClient(app).get(f"/api/v1/shares/view/{token}/coins/{coin_id}/photo")
    assert share_obverse.status_code == 200
    share_reverse = TestClient(app).get(f"/api/v1/shares/view/{token}/coins/{coin_id}/photo?side=reverse")
    assert share_reverse.status_code == 200
    assert share_reverse.content != share_obverse.content

    db = sqlite3.connect(data / "app.db")
    db.row_factory = sqlite3.Row
    row = db.execute("SELECT photo_relpath, photo_reverse_relpath FROM coins WHERE id = ?", (coin_id,)).fetchone()
    assert row["photo_relpath"]
    assert row["photo_reverse_relpath"]
    assert row["photo_relpath"] != row["photo_reverse_relpath"]
    db.close()

    print("COIN_SIDES_OK", data)


if __name__ == "__main__":
    run()
