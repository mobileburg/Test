#!/usr/bin/env python3
"""Локальная проверка шаринга коллекций без загрузки CLIP."""

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
    data = Path(tempfile.mkdtemp(prefix="numismat-share-"))
    os.environ["NUMISMAT_DATA_DIR"] = str(data)
    os.environ["NUMISMAT_PUBLIC_URL"] = "https://app-66ba5c12d8dc.vibecode.bitrix24.tech"
    os.environ.pop("NUMISMAT_ADMIN_EMAIL", None)

    from ml.accounts import init_storage, router

    init_storage()
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    owner = client.post("/api/v1/auth/register", json={"email": "owner@example.com", "password": "password1"})
    assert owner.status_code == 200, owner.text
    owner_token = owner.json()["token"]
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    guest = client.post("/api/v1/auth/register", json={"email": "guest@example.com", "password": "password1"})
    assert guest.status_code == 200, guest.text
    guest_token = guest.json()["token"]
    guest_headers = {"Authorization": f"Bearer {guest_token}"}

    created = client.post(
        "/api/v1/coins",
        headers=owner_headers,
        json={"title": "Рубль", "subtitle": "Шаринг", "country": "Россия", "year": 2024, "metal": "серебро"},
    )
    assert created.status_code == 201, created.text
    coin_id = created.json()["id"]

    guest_own = client.get("/api/v1/coins", headers=guest_headers)
    assert guest_own.status_code == 200
    assert guest_own.json() == []

    guest_photo = client.get(f"/api/v1/coins/{coin_id}/photo", headers=guest_headers)
    assert guest_photo.status_code == 404, guest_photo.text

    share = client.post("/api/v1/shares", headers=owner_headers, json={"access": "read"})
    assert share.status_code == 201, share.text
    payload = share.json()
    assert payload["access"] == "read"
    assert payload["token"]
    assert payload["url"].endswith(f"/share/{payload['token']}")
    token = payload["token"]

    listed = client.get("/api/v1/shares", headers=owner_headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    guest_list = client.get("/api/v1/shares", headers=guest_headers)
    assert guest_list.status_code == 200
    assert guest_list.json() == []

    viewed = TestClient(app).get(f"/api/v1/shares/view/{token}")
    assert viewed.status_code == 200, viewed.text
    body = viewed.json()
    assert body["access"] == "read"
    assert body["scope"] == "collection"
    assert len(body["coins"]) == 1
    assert body["coins"][0]["title"] == "Рубль"
    assert body["owner"]["email"] == "owner@example.com"

    other = client.post(
        "/api/v1/coins",
        headers=owner_headers,
        json={"title": "Копейка", "subtitle": "Вторая", "country": "Россия", "year": 2023, "metal": "медь"},
    )
    assert other.status_code == 201, other.text
    other_id = other.json()["id"]

    coin_share = client.post("/api/v1/shares", headers=owner_headers, json={"access": "read", "coin_id": coin_id})
    assert coin_share.status_code == 201, coin_share.text
    coin_payload = coin_share.json()
    assert coin_payload["scope"] == "coin"
    assert coin_payload["coinId"] == coin_id
    assert coin_payload["coinTitle"] == "Рубль"
    assert coin_payload["url"].endswith(f"/share/{coin_payload['token']}")
    coin_token = coin_payload["token"]

    listed_both = client.get("/api/v1/shares", headers=owner_headers)
    assert listed_both.status_code == 200
    scopes = {item["scope"] for item in listed_both.json()}
    assert scopes == {"collection", "coin"}

    viewed_coin = TestClient(app).get(f"/api/v1/shares/view/{coin_token}")
    assert viewed_coin.status_code == 200, viewed_coin.text
    coin_view = viewed_coin.json()
    assert coin_view["scope"] == "coin"
    assert coin_view["coinId"] == coin_id
    assert len(coin_view["coins"]) == 1
    assert coin_view["coins"][0]["id"] == coin_id
    assert coin_view["coins"][0]["title"] == "Рубль"

    other_photo = TestClient(app).get(f"/api/v1/shares/view/{coin_token}/coins/{other_id}/photo")
    assert other_photo.status_code == 404

    viewed_all = TestClient(app).get(f"/api/v1/shares/view/{token}")
    assert viewed_all.status_code == 200
    assert viewed_all.json()["scope"] == "collection"
    assert len(viewed_all.json()["coins"]) == 2

    stolen = client.post("/api/v1/shares", headers=guest_headers, json={"access": "read", "coin_id": coin_id})
    assert stolen.status_code == 404

    revoked_coin = client.delete(f"/api/v1/shares/{coin_payload['id']}", headers=owner_headers)
    assert revoked_coin.status_code == 204
    gone_coin = TestClient(app).get(f"/api/v1/shares/view/{coin_token}")
    assert gone_coin.status_code == 404

    missing = TestClient(app).get("/api/v1/shares/view/not-a-real-token")
    assert missing.status_code == 404

    write_share = client.post(
        "/api/v1/shares",
        headers=owner_headers,
        json={"access": "write", "email": "guest@example.com"},
    )
    assert write_share.status_code == 201, write_share.text
    assert write_share.json()["access"] == "write"
    assert write_share.json()["email"] == "guest@example.com"

    inbox = client.get("/api/v1/shares/inbox", headers=guest_headers)
    assert inbox.status_code == 200, inbox.text
    assert len(inbox.json()) == 1
    assert inbox.json()[0]["ownerEmail"] == "owner@example.com"
    assert inbox.json()[0]["access"] == "write"
    assert inbox.json()[0]["scope"] == "collection"

    coin_invite = client.post(
        "/api/v1/shares",
        headers=owner_headers,
        json={"access": "read", "email": "guest@example.com", "coin_id": coin_id},
    )
    assert coin_invite.status_code == 201, coin_invite.text
    inbox_both = client.get("/api/v1/shares/inbox", headers=guest_headers)
    assert inbox_both.status_code == 200
    assert {item["scope"] for item in inbox_both.json()} == {"collection", "coin"}

    owner_inbox = client.get("/api/v1/shares/inbox", headers=owner_headers)
    assert owner_inbox.json() == []

    self_share = client.post(
        "/api/v1/shares",
        headers=owner_headers,
        json={"access": "read", "email": "owner@example.com"},
    )
    assert self_share.status_code == 400

    forbidden_delete = client.delete(f"/api/v1/coins/{coin_id}", headers=guest_headers)
    assert forbidden_delete.status_code == 404

    share_id = payload["id"]
    revoked = client.delete(f"/api/v1/shares/{share_id}", headers=owner_headers)
    assert revoked.status_code == 204
    gone = TestClient(app).get(f"/api/v1/shares/view/{token}")
    assert gone.status_code == 404

    guest_revoke = client.delete(f"/api/v1/shares/{write_share.json()['id']}", headers=guest_headers)
    assert guest_revoke.status_code == 404

    admin_users = client.get("/api/v1/admin/users", headers=owner_headers)
    assert admin_users.status_code == 200
    guest_id = guest.json()["user"]["id"]
    admin_coins = client.get(f"/api/v1/admin/users/{guest_id}/coins", headers=owner_headers)
    assert admin_coins.status_code == 200

    print("SHARE_API_OK", data)


if __name__ == "__main__":
    run()
