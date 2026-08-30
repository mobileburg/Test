#!/usr/bin/env python3
"""Проверка личного vibe_api_ без печати секретов."""

from __future__ import annotations

import json
import os
import re
import ssl
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get("TEMP", "/tmp"))
API = "https://vibecode.bitrix24.tech"
TARGET = "71994323-56e4-4f72-afed-c461587d9be6"
FORBIDDEN = "68c14960"


def load_personal_key() -> str:
    text = (ROOT / ".env").read_text(encoding="utf-8-sig")
    match = re.search(r"(vibe_api_[A-Za-z0-9_]+)", text)
    if not match:
        raise SystemExit("NO_VIBE_API_KEY")
    key = match.group(1)
    print(f"loaded_prefix {key[:9]} len {len(key)}")
    return key


def request(path: str, key: str, method: str = "GET", body: bytes | None = None) -> tuple[int, dict | str]:
    req = urllib.request.Request(
        API + path,
        data=body,
        method=method,
        headers={"X-Api-Key": key, "Accept": "application/json"},
    )
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, context=ssl.create_default_context(), timeout=120) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw)
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace")
        try:
            return err.code, json.loads(raw)
        except json.JSONDecodeError:
            return err.code, raw[:2000]


def summarize_server(item: dict) -> dict:
    keys = (
        "id",
        "name",
        "displayName",
        "description",
        "status",
        "kind",
        "mode",
        "plan",
        "appUrl",
        "subdomain",
        "blackholeStatus",
        "accessPolicy",
        "localPort",
        "sleepAfterMinutes",
        "runtimeId",
        "createdVia",
    )
    return {key: item.get(key) for key in keys}


def main() -> None:
    key = load_personal_key()
    status, payload = request("/v1/infra/servers", key)
    (OUT / "vibe_servers.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) if isinstance(payload, dict) else str(payload),
        encoding="utf-8",
    )
    print("LIST_HTTP", status)
    if isinstance(payload, dict):
        items = payload.get("data")
        if isinstance(items, dict) and "items" in items:
            items = items["items"]
        if isinstance(items, list):
            print("LIST_COUNT", len(items))
            for item in items:
                if not isinstance(item, dict):
                    continue
                summary = summarize_server(item)
                print("SERVER", json.dumps(summary, ensure_ascii=False))
                if FORBIDDEN in str(item.get("id") or "") or "06030a404f6d" in str(item.get("appUrl") or ""):
                    print("FOREIGN_SERVER_SEEN_SKIP_DEPLOY")

    status, payload = request(f"/v1/infra/servers/{TARGET}", key)
    (OUT / "vibe_target_server.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) if isinstance(payload, dict) else str(payload),
        encoding="utf-8",
    )
    print("TARGET_HTTP", status)
    if isinstance(payload, dict):
        data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
        if payload.get("success") is False or "error" in payload:
            err = payload.get("error") or {}
            print("TARGET_ERROR", err.get("code"), err.get("message"))
        elif isinstance(data, dict) and data.get("id"):
            print("TARGET", json.dumps(summarize_server(data), ensure_ascii=False))


if __name__ == "__main__":
    main()
