#!/usr/bin/env python3
"""Локальная проверка кабинетов и админ-API без загрузки CLIP."""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def run() -> None:
    data = Path(tempfile.mkdtemp(prefix="numismat-admin-"))
    os.environ["NUMISMAT_DATA_DIR"] = str(data)
    os.environ.pop("NUMISMAT_ADMIN_EMAIL", None)

    from ml.accounts import init_storage, router

    init_storage()
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    first = client.post("/api/v1/auth/register", json={"email": "admin@example.com", "password": "password1"})
    assert first.status_code == 200, first.text
    assert first.json()["user"]["role"] == "admin", first.json()
    admin_token = first.json()["token"]

    second = client.post("/api/v1/auth/register", json={"email": "user@example.com", "password": "password1"})
    assert second.status_code == 200, second.text
    assert second.json()["user"]["role"] == "user", second.json()
    user_token = second.json()["token"]
    user_id = second.json()["user"]["id"]

    forbidden = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {user_token}"})
    assert forbidden.status_code == 403, forbidden.text

    anon = TestClient(app).get("/api/v1/admin/users")
    assert anon.status_code == 401, anon.text

    users = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert users.status_code == 200, users.text
    payload = users.json()
    assert {item["email"] for item in payload} == {"admin@example.com", "user@example.com"}
    assert all({"id", "email", "role", "coinsCount", "created"} <= set(item) for item in payload)

    created = client.post(
        "/api/v1/coins",
        headers={"Authorization": f"Bearer {user_token}"},
        json={"title": "5 рублей", "subtitle": "Тест", "country": "Россия", "year": 2024, "metal": "сталь"},
    )
    assert created.status_code == 201, created.text

    own = client.get("/api/v1/coins", headers={"Authorization": f"Bearer {admin_token}"})
    assert own.status_code == 200
    assert own.json() == []

    collection = client.get(
        f"/api/v1/admin/users/{user_id}/coins",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert collection.status_code == 200, collection.text
    coins = collection.json()
    assert len(coins) == 1
    assert coins[0]["title"] == "5 рублей"
    assert coins[0]["image"] is None

    user_forbidden = client.get(
        f"/api/v1/admin/users/{user_id}/coins",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert user_forbidden.status_code == 403, user_forbidden.text

    missing = client.get(
        "/api/v1/admin/users/99999/coins",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert missing.status_code == 404, missing.text

    os.environ["NUMISMAT_ADMIN_EMAIL"] = "promo@example.com"
    promo = client.post("/api/v1/auth/register", json={"email": "promo@example.com", "password": "password1"})
    assert promo.status_code == 200, promo.text
    assert promo.json()["user"]["role"] == "admin", promo.json()
    print("ADMIN_API_OK", data)


if __name__ == "__main__":
    run()
