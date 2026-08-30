#!/usr/bin/env python3
"""Загрузка локального кэша CLIP на VM через VibeCode Storage, без печати секретов."""

from __future__ import annotations

import base64
import json
import os
import re
import ssl
import sys
import tarfile
import tempfile
import time
from pathlib import Path
import urllib.request
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
API = "https://vibecode.bitrix24.tech"
TARGET = "71994323-56e4-4f72-afed-c461587d9be6"
CACHE = Path.home() / ".cache" / "huggingface" / "hub" / "models--openai--clip-vit-base-patch32"
REV = "3d74acf9a28c67741b2f4f2ea7635f0aaf6f0268"
CTX = ssl.create_default_context()
STORAGE_KEY = "numismat/clip-vit-base-patch32.tar.gz"


def load_personal_key() -> str:
    text = (ROOT / ".env").read_text(encoding="utf-8-sig")
    match = re.search(r"(vibe_api_[A-Za-z0-9_]+)", text)
    if not match:
        raise SystemExit("NO_VIBE_API_KEY")
    key = match.group(1)
    print(f"loaded_prefix {key[:9]} len {len(key)}")
    return key


def api(key: str, method: str, path: str, body: bytes | None = None, content_type: str | None = None, timeout: int = 120):
    headers = {"X-Api-Key": key, "Accept": "application/json"}
    if content_type:
        headers["Content-Type"] = content_type
    req = Request(API + path, data=body, method=method, headers=headers)
    try:
        with urlopen(req, context=CTX, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else {}
    except HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace")
        try:
            return err.code, json.loads(raw)
        except json.JSONDecodeError:
            return err.code, raw[:2000]


def exec_cmd(key: str, command: str, timeout: int = 300):
    print("EXEC", command[:160], "timeout", timeout)
    status, payload = api(
        key,
        "POST",
        f"/v1/infra/servers/{TARGET}/exec",
        json.dumps({"command": command, "timeout": timeout}).encode("utf-8"),
        "application/json",
        timeout + 90,
    )
    print("EXEC_HTTP", status)
    if isinstance(payload, dict):
        err = payload.get("error") or {}
        data = payload.get("data") or {}
        if err:
            print("EXEC_ERROR", err.get("code"), str(err.get("message") or "")[:240])
        if isinstance(data, dict):
            print("EXEC_EXIT", data.get("exitCode"))
            stdout = str(data.get("stdout") or "")[-400:]
            stderr = str(data.get("stderr") or "")[-400:]
            if stdout:
                print("EXEC_STDOUT", stdout.encode("utf-8", "replace").decode("ascii", "replace"))
            if stderr:
                print("EXEC_STDERR", stderr.encode("utf-8", "replace").decode("ascii", "replace"))
    return payload


def build_archive() -> Path:
    snap = CACHE / "snapshots" / REV
    if not snap.is_dir():
        raise SystemExit("MISSING_LOCAL_CLIP_CACHE")
    dest = Path(tempfile.gettempdir()) / f"clip-hf-cache-{os.getpid()}.tar.gz"
    print("PACKING", snap)
    with tarfile.open(dest, "w:gz") as tar:
        info = tarfile.TarInfo("models--openai--clip-vit-base-patch32/refs/main")
        payload = (REV + "\n").encode("utf-8")
        info.size = len(payload)
        tar.addfile(info, fileobj=__import__("io").BytesIO(payload))
        for path in snap.iterdir():
            if path.is_file():
                arc = f"models--openai--clip-vit-base-patch32/snapshots/{REV}/{path.name}"
                tar.add(path, arcname=arc)
    print("ARCHIVE_BYTES", dest.stat().st_size)
    return dest


def put_file(url: str, path: Path, content_type: str) -> int:
    data = path.read_bytes()
    req = Request(url, data=data, method="PUT", headers={"Content-Type": content_type})
    with urlopen(req, context=CTX, timeout=1800) as resp:
        resp.read()
        return resp.status


def download_url(key: str) -> str:
    encoded = quote(STORAGE_KEY, safe="")

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    opener = urllib.request.build_opener(NoRedirect, urllib.request.HTTPSHandler(context=CTX))
    req = Request(
        API + f"/v1/storage/objects/{encoded}",
        method="GET",
        headers={"X-Api-Key": key, "Accept": "application/json"},
    )
    try:
        with opener.open(req, timeout=60) as resp:
            location = resp.headers.get("Location")
            if location:
                return location
            raw = resp.read()
            try:
                payload = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                raise SystemExit("DOWNLOAD_URL_NOT_JSON")
    except HTTPError as err:
        location = err.headers.get("Location") if err.headers else None
        if location:
            return location
        raw = err.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            raise SystemExit(f"DOWNLOAD_URL_HTTP_{err.code}")
    data = payload.get("data") or payload.get("object") or payload
    url = data.get("downloadUrl") or data.get("url") if isinstance(data, dict) else None
    if not url:
        print("DOWNLOAD_PAYLOAD_KEYS", list(payload)[:20] if isinstance(payload, dict) else type(payload))
        raise SystemExit("NO_DOWNLOAD_URL")
    return url


def main() -> None:
    key = load_personal_key()
    url = None
    try:
        url = download_url(key)
        print("REUSING_STORAGE_OBJECT")
    except SystemExit:
        url = None
    if not url:
        archive = build_archive()
        status, created = api(
            key,
            "POST",
            "/v1/storage/objects",
            json.dumps({
                "key": STORAGE_KEY,
                "contentType": "application/gzip",
                "sizeBytes": archive.stat().st_size,
                "ttlSeconds": 86400,
            }).encode("utf-8"),
            "application/json",
        )
        print("STORAGE_CREATE", status)
        if not isinstance(created, dict):
            raise SystemExit("STORAGE_CREATE_FAILED")
        if created.get("error", {}).get("code") == "STORAGE_KEY_EXISTS":
            print("STORAGE_KEY_EXISTS_REUSING")
        elif created.get("success") is False:
            print("CREATE_ERROR", created.get("error"))
            raise SystemExit("STORAGE_CREATE_FAILED")
        else:
            data = created.get("data") or created
            upload_url = data.get("uploadUrl")
            object_id = data.get("objectId") or (data.get("object") or {}).get("id")
            if not upload_url or not object_id:
                print("CREATE_KEYS", list(data)[:30] if isinstance(data, dict) else created)
                raise SystemExit("STORAGE_CREATE_SHAPE")
            print("PUT_STARTED", archive.stat().st_size)
            put_status = put_file(upload_url, archive, "application/gzip")
            print("PUT_HTTP", put_status)
            complete_status, complete = api(
                key,
                "POST",
                "/v1/storage/objects/complete",
                json.dumps({"objectId": object_id}).encode("utf-8"),
                "application/json",
            )
            print("COMPLETE_HTTP", complete_status)
            if isinstance(complete, dict) and complete.get("success") is False:
                print("COMPLETE_ERROR", complete.get("error"))
                raise SystemExit("STORAGE_COMPLETE_FAILED")
        url = download_url(key)
    print("DOWNLOAD_URL_LEN", len(url), "host", url.split("/")[2] if "://" in url else "unknown")
    quoted = url.replace("'", "'\\''")
    exec_cmd(key, "mkdir -p /opt/data/hf/hub /tmp && rm -rf /opt/data/hf/hub/models--openai--clip-vit-base-patch32 /opt/data/hf/hub/.locks", 30)
    pull = exec_cmd(
        key,
        f"curl -fsSL -o /tmp/clip-hf-cache.tar.gz '{quoted}' && "
        "tar -tzf /tmp/clip-hf-cache.tar.gz | head && "
        "tar -xzf /tmp/clip-hf-cache.tar.gz -C /opt/data/hf/hub && "
        "rm -f /tmp/clip-hf-cache.tar.gz && "
        "chown -R vibeapp:vibeapp /opt/data && "
        "printf '\\nHF_HUB_OFFLINE=1\\n' >> /opt/app/.env && "
        "systemctl restart app && echo CLIP_INSTALLED",
        600,
    )
    if isinstance(pull, dict) and (pull.get("data") or {}).get("exitCode") not in (0, "0"):
        raise SystemExit("CLIP_INSTALL_FAILED")
    deadline = time.time() + 180
    while time.time() < deadline:
        req = Request("https://app-66ba5c12d8dc.vibecode.bitrix24.tech/api/v1/health", headers={"Accept": "application/json"})
        try:
            with urlopen(req, context=CTX, timeout=30) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
                print("PUBLIC_HEALTH", resp.status, payload)
                if payload.get("status") == "ok":
                    return
        except HTTPError as err:
            print("PUBLIC_HEALTH_HTTP", err.code, err.read()[:300])
        except Exception as exc:  # noqa: BLE001
            print("PUBLIC_HEALTH_WAIT", type(exc).__name__)
        time.sleep(8)
    raise SystemExit("HEALTH_STILL_NOT_OK")


def activate_local_clip() -> None:
    key = load_personal_key()
    for rel in ("ml/service.py", "ml/accounts.py"):
        content = (ROOT / rel).read_bytes()
        encoded = base64.b64encode(content).decode("ascii")
        status, payload = api(
            key,
            "POST",
            f"/v1/infra/servers/{TARGET}/upload",
            json.dumps({"path": f"/opt/app/{rel}", "content": encoded, "mode": "0644"}).encode("utf-8"),
            "application/json",
        )
        print("UPLOAD", rel, status)
        if isinstance(payload, dict) and payload.get("success") is False:
            print("UPLOAD_ERROR", payload.get("error"))
            raise SystemExit("UPLOAD_FAILED")
    env_text = """NUMISMAT_MODEL_ARTIFACT=ml/artifacts/20260826T193916Z
NUMISMAT_WEB_DIST=dist
NUMISMAT_CORS_ORIGINS=*
NUMISMAT_CLIP_MODEL=/opt/data/clip
NUMISMAT_DATA_DIR=/opt/data/state
HF_HOME=/opt/data/hf
HF_HUB_CACHE=/opt/data/hf/hub
TRANSFORMERS_CACHE=/opt/data/hf/transformers
HF_HUB_OFFLINE=1
"""
    env_b64 = base64.b64encode(env_text.encode("utf-8")).decode("ascii")
    api(
        key,
        "POST",
        f"/v1/infra/servers/{TARGET}/upload",
        json.dumps({"path": "/opt/app/.env", "content": env_b64, "mode": "0644"}).encode("utf-8"),
        "application/json",
    )
    result = exec_cmd(
        key,
        "SNAP=/opt/data/hf/hub/models--openai--clip-vit-base-patch32/snapshots/" + REV + "; "
        "mkdir -p /opt/data/clip /opt/data/state && cp -a $SNAP/. /opt/data/clip/ && "
        "mkdir -p /etc/systemd/system/app.service.d && "
        "printf '[Service]\\nEnvironment=NUMISMAT_CLIP_MODEL=/opt/data/clip\\nEnvironment=NUMISMAT_DATA_DIR=/opt/data/state\\nEnvironment=HF_HUB_OFFLINE=1\\n' > /etc/systemd/system/app.service.d/clip.conf && "
        "chown -R vibeapp:vibeapp /opt/data /opt/app/ml && "
        "systemctl daemon-reload && systemctl restart app && echo ACTIVATED",
        60,
    )
    if isinstance(result, dict) and (result.get("data") or {}).get("exitCode") not in (0, "0"):
        raise SystemExit("ACTIVATE_FAILED")
    deadline = time.time() + 180
    while time.time() < deadline:
        req = Request("https://app-66ba5c12d8dc.vibecode.bitrix24.tech/api/v1/health", headers={"Accept": "application/json"})
        try:
            with urlopen(req, context=CTX, timeout=30) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
                print("PUBLIC_HEALTH", resp.status, payload)
                if payload.get("status") == "ok":
                    return
        except HTTPError as err:
            print("PUBLIC_HEALTH_HTTP", err.code, err.read()[:400])
        except Exception as exc:  # noqa: BLE001
            print("PUBLIC_HEALTH_WAIT", type(exc).__name__)
        time.sleep(8)
    raise SystemExit("HEALTH_STILL_NOT_OK")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "activate":
        activate_local_clip()
    else:
        main()
