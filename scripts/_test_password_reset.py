#!/usr/bin/env python3
"""End-to-end smoke-тест backend восстановления пароля без отправки почты."""

from __future__ import annotations

import hashlib
import os
import sys
import tempfile
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def run() -> None:
    data = Path(tempfile.mkdtemp(prefix="numismat-password-reset-"))
    os.environ["NUMISMAT_DATA_DIR"] = str(data)
    os.environ["NUMISMAT_SECRET_KEY"] = "test-only-secret"
    os.environ["NUMISMAT_RESET_REQUESTS_PER_EMAIL"] = "1"
    os.environ["NUMISMAT_RESET_REQUESTS_PER_IP"] = "20"

    import ml.accounts as accounts

    sent: list[tuple[str, str, int]] = []
    real_send = accounts._send_password_reset_email
    accounts._send_password_reset_email = (  # type: ignore[assignment]
        lambda email, url, ttl: sent.append((email, url, ttl))
    )
    app = FastAPI()
    app.include_router(accounts.router)
    client = TestClient(app)

    registered = client.post(
        "/api/v1/auth/register",
        json={"email": "owner@example.com", "password": "password1"},
    )
    assert registered.status_code == 200, registered.text
    old_session = registered.json()["token"]

    known = client.post(
        "/api/v1/auth/password-reset/request",
        json={"email": "owner@example.com"},
    )
    unknown = client.post(
        "/api/v1/auth/password-reset/request",
        json={"email": "missing@example.com"},
    )
    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    assert len(sent) == 1

    raw_token = parse_qs(urlparse(sent[0][1]).query)["token"][0]
    with accounts.db() as conn:
        stored = conn.execute(
            "SELECT token_hash, used_at FROM password_reset_tokens"
        ).fetchone()
    assert stored["token_hash"] == hashlib.sha256(raw_token.encode()).hexdigest()
    assert raw_token not in stored["token_hash"]
    assert stored["used_at"] is None

    limited = client.post(
        "/api/v1/auth/password-reset/request",
        json={"email": "owner@example.com"},
    )
    assert limited.status_code == 202
    assert limited.json() == known.json()
    assert len(sent) == 1

    mismatch_policy = client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": raw_token, "password": "onlyletters"},
    )
    assert mismatch_policy.status_code == 422, mismatch_policy.text

    confirmed = client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": raw_token, "password": "newpassword2"},
    )
    assert confirmed.status_code == 200, confirmed.text

    reused = client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": raw_token, "password": "newpassword2"},
    )
    assert reused.status_code == 400, reused.text

    invalidated = client.get(
        "/api/v1/me",
        headers={"Authorization": f"Bearer {old_session}"},
    )
    assert invalidated.status_code == 401, invalidated.text
    old_login = client.post(
        "/api/v1/auth/login",
        json={"email": "owner@example.com", "password": "password1"},
    )
    assert old_login.status_code == 401
    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": "owner@example.com", "password": "newpassword2"},
    )
    assert new_login.status_code == 200, new_login.text

    os.environ["NUMISMAT_ENV"] = "production"
    os.environ["NUMISMAT_EMAIL_MODE"] = "console"
    try:
        real_send("owner@example.com", "https://example.com/reset-password?token=secret", 30)
        raise AssertionError("console email mode должен быть запрещён в production")
    except RuntimeError:
        pass

    print("PASSWORD_RESET_OK", data)


if __name__ == "__main__":
    run()
