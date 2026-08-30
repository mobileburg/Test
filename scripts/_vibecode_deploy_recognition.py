#!/usr/bin/env python3
"""Деплой FastAPI распознавания на сервер «Нумизмат AI» без печати секретов."""

from __future__ import annotations

import http.client
import json
import os
import re
import ssl
import sys
import tarfile
import tempfile
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
API = "https://vibecode.bitrix24.tech"
TARGET = "71994323-56e4-4f72-afed-c461587d9be6"
EXPECTED_URL = "https://app-66ba5c12d8dc.vibecode.bitrix24.tech"
FORBIDDEN_MARKERS = ("68c14960", "app-06030a404f6d", "53037650")
ARTIFACT = ROOT / "ml" / "artifacts" / "20260826T193916Z"
OUT = Path(os.environ.get("TEMP", "/tmp"))
CTX = ssl.create_default_context()


def load_personal_key() -> str:
    text = (ROOT / ".env").read_text(encoding="utf-8-sig")
    match = re.search(r"(vibe_api_[A-Za-z0-9_]+)", text)
    if not match:
        raise SystemExit("NO_VIBE_API_KEY")
    key = match.group(1)
    print(f"loaded_prefix {key[:9]} len {len(key)}")
    return key


def api(key: str, method: str, path: str, body: bytes | None = None, content_type: str | None = None, timeout: int | None = 120) -> tuple[int, dict | str, dict[str, str]]:
    headers = {"X-Api-Key": key, "Accept": "application/json"}
    if content_type:
        headers["Content-Type"] = content_type
    req = Request(API + path, data=body, method=method, headers=headers)
    try:
        with urlopen(req, context=CTX, timeout=timeout) as resp:
            meta = {name: value for name, value in resp.headers.items()}
            op = meta.get("X-Vibe-Operation-Id") or meta.get("x-vibe-operation-id")
            if op:
                print("OPERATION_ID", op)
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else {}, meta
    except HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace")
        meta = {name: value for name, value in err.headers.items()} if err.headers else {}
        try:
            return err.code, json.loads(raw), meta
        except json.JSONDecodeError:
            return err.code, raw[:4000], meta
    except (URLError, http.client.IncompleteRead, TimeoutError, ValueError) as err:
        print("URL_ERROR", type(err).__name__, str(err)[:200])
        return 0, {"success": False, "error": {"code": "CLIENT_TIMEOUT", "message": str(err)[:300]}}, {}


def summarize_server(item: dict) -> dict:
    keys = (
        "id", "displayName", "status", "kind", "appUrl", "blackholeStatus",
        "accessPolicy", "localPort", "sleepAfterMinutes", "runtimeId", "plan",
        "activeOperation", "runtimeStatus",
    )
    return {key: item.get(key) for key in keys}


def assert_target(server: dict) -> None:
    blob = json.dumps(server, ensure_ascii=False)
    for marker in FORBIDDEN_MARKERS:
        if marker in blob:
            raise SystemExit(f"REFUSING_FOREIGN_SERVER {marker}")
    if server.get("id") != TARGET:
        raise SystemExit(f"UNEXPECTED_SERVER_ID {server.get('id')}")
    if server.get("appUrl") != EXPECTED_URL:
        raise SystemExit(f"UNEXPECTED_APP_URL {server.get('appUrl')}")


def build_archive(dest: Path) -> int:
    required = ("model_card.json", "records.json", "embeddings.npy")
    for name in required:
        path = ARTIFACT / name
        if not path.is_file():
            raise SystemExit(f"MISSING_ARTIFACT {name}")
    requirements = "\n".join([
        "numpy",
        "pillow",
        "transformers",
        "fastapi",
        "python-multipart",
        "uvicorn",
        "bcrypt",
        "",
    ])
    dist = ROOT / "dist"
    with tarfile.open(dest, "w:gz") as tar:
        tar.add(ROOT / "ml" / "__init__.py", arcname="ml/__init__.py")
        tar.add(ROOT / "ml" / "service.py", arcname="ml/service.py")
        tar.add(ROOT / "ml" / "accounts.py", arcname="ml/accounts.py")
        tar.add(ROOT / "ml" / "feedback.py", arcname="ml/feedback.py")
        for name in required:
            tar.add(ARTIFACT / name, arcname=f"ml/artifacts/20260826T193916Z/{name}")
        if (dist / "index.html").is_file():
            for path in dist.rglob("*"):
                if path.is_file():
                    tar.add(path, arcname=str(Path("dist") / path.relative_to(dist)))
        req_bytes = requirements.encode("utf-8")
        info = tarfile.TarInfo("requirements.txt")
        info.size = len(req_bytes)
        tar.addfile(info, fileobj=__import__("io").BytesIO(req_bytes))
    size = dest.stat().st_size
    print(f"ARCHIVE_BYTES {size}")
    if size > 500 * 1024 * 1024:
        raise SystemExit("ARCHIVE_TOO_LARGE")
    return size


def encode_multipart(fields: dict[str, str], filename: str, content: bytes) -> tuple[bytes, str]:
    boundary = "----VibeDeploy" + uuid.uuid4().hex
    chunks: list[bytes] = []
    for name, value in fields.items():
        chunks.append(f"--{boundary}\r\n".encode("ascii"))
        chunks.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"))
        chunks.append(value.encode("utf-8") + b"\r\n")
    chunks.append(f"--{boundary}\r\n".encode("ascii"))
    chunks.append(
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode("utf-8")
    )
    chunks.append(b"Content-Type: application/gzip\r\n\r\n")
    chunks.append(content)
    chunks.append(b"\r\n")
    chunks.append(f"--{boundary}--\r\n".encode("ascii"))
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def print_deploy_result(payload: dict | str) -> bool:
    (OUT / "vibe_deploy.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) if isinstance(payload, dict) else str(payload),
        encoding="utf-8",
    )
    if not isinstance(payload, dict):
        print("DEPLOY_NON_JSON")
        return False
    print("DEPLOY_SUCCESS", payload.get("success"))
    if payload.get("success") is False:
        err = payload.get("error") or {}
        print("DEPLOY_ERROR", err.get("code"), err.get("message"))
        return False
    data = payload.get("data") or {}
    steps = data.get("steps") or []
    health_ok = False
    for step in steps:
        if not isinstance(step, dict):
            continue
        print(
            "STEP",
            step.get("step"),
            step.get("status"),
            step.get("httpCode"),
            (step.get("error") or "")[:200],
        )
        if step.get("step") == "healthcheck" and step.get("status") == "ok":
            health_ok = True
        if step.get("step") == "tunnel_routing" and step.get("status") == "warning":
            print("TUNNEL_WARNING", (step.get("stdout") or step.get("error") or "")[:300])
    warnings = data.get("warnings") or []
    for warning in warnings:
        print("WARNING", str(warning)[:300])
    return bool(payload.get("success")) and health_ok


ICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="30" fill="#18362f"/>
  <circle cx="32" cy="32" r="22" fill="none" stroke="#d4b36a" stroke-width="3"/>
  <text x="32" y="39" text-anchor="middle" font-size="18" fill="#f7f5ef" font-family="Georgia, serif">₽</text>
</svg>
"""


def upload_icon(key: str) -> None:
    svg = ICON_SVG.encode("utf-8")
    body, content_type = encode_multipart({}, "icon.svg", svg)
    body = body.replace(b'name="file"; filename="icon.svg"', b'name="file"; filename="icon.svg"')
    body = body.replace(b"Content-Type: application/gzip", b"Content-Type: image/svg+xml")
    status, payload, _ = api(
        key,
        "POST",
        f"/v1/infra/servers/{TARGET}/icon",
        body,
        content_type,
        timeout=60,
    )
    print("ICON_HTTP", status)
    if isinstance(payload, dict):
        print("ICON_SUCCESS", payload.get("success"))


def poll_public_health(timeout_s: int = 420) -> None:
    deadline = time.time() + timeout_s
    url = EXPECTED_URL + "/api/v1/health"
    while time.time() < deadline:
        req = Request(url, headers={"Accept": "application/json"})
        try:
            with urlopen(req, context=CTX, timeout=30) as resp:
                raw = resp.read().decode("utf-8")
                payload = json.loads(raw) if raw else {}
                print("PUBLIC_HEALTH", resp.status, payload.get("status") if isinstance(payload, dict) else raw[:200])
                if resp.status == 200 and isinstance(payload, dict) and payload.get("status") == "ok":
                    return
        except HTTPError as err:
            print("PUBLIC_HEALTH_HTTP", err.code)
        except (URLError, json.JSONDecodeError, TimeoutError) as err:
            print("PUBLIC_HEALTH_WAIT", type(err).__name__)
        time.sleep(8)
    raise SystemExit("PUBLIC_HEALTH_TIMEOUT")


def poll_public_cabinets() -> None:
    me_req = Request(EXPECTED_URL + "/api/v1/me", headers={"Accept": "application/json"})
    try:
        with urlopen(me_req, context=CTX, timeout=30) as resp:
            print("PUBLIC_ME", resp.status)
            raise SystemExit("PUBLIC_ME_EXPECTED_401")
    except HTTPError as err:
        print("PUBLIC_ME", err.code)
        if err.code != 401:
            raise SystemExit(f"PUBLIC_ME_UNEXPECTED {err.code}") from None
    index_req = Request(EXPECTED_URL + "/", headers={"Accept": "text/html"})
    with urlopen(index_req, context=CTX, timeout=30) as resp:
        html = resp.read().decode("utf-8", errors="replace")
        print("PUBLIC_INDEX", resp.status)
        if resp.status != 200:
            raise SystemExit("PUBLIC_INDEX_FAILED")
        login_html = "Вход в кабинет" in html
        asset = None
        for token in html.replace("'", '"').split('"'):
            if token.startswith("/assets/") and token.endswith(".js"):
                asset = token
                break
            if token.startswith("./assets/") and token.endswith(".js"):
                asset = token[1:]
                break
            if token.startswith("assets/") and token.endswith(".js"):
                asset = "/" + token
                break
        login_js = False
        js = ""
        if asset:
            js_req = Request(EXPECTED_URL + asset, headers={"Accept": "*/*"})
            with urlopen(js_req, context=CTX, timeout=30) as js_resp:
                js = js_resp.read().decode("utf-8", errors="replace")
                login_js = "Вход в кабинет" in js
                print("PUBLIC_ASSET", js_resp.status, asset, "login" if login_js else "NO_LOGIN")
        print("PUBLIC_LOGIN_UI", login_html or login_js)
        if not (login_html or login_js):
            raise SystemExit("PUBLIC_INDEX_NO_LOGIN")
        admin_js = "Админка" in (js if asset else "") or "Админка" in html
        print("PUBLIC_ADMIN_UI", admin_js)
        share_ui = "Поделиться" in (js if asset else "") or "Мне открыли" in (js if asset else "")
        print("PUBLIC_SHARE_UI", share_ui)
        if not share_ui:
            raise SystemExit("PUBLIC_INDEX_NO_SHARE")
        feedback_ui = "Очередь обучения" in (js if asset else "") or "Попробуй распознать ещё" in (js if asset else "")
        print("PUBLIC_FEEDBACK_UI", feedback_ui)
        if not feedback_ui:
            raise SystemExit("PUBLIC_INDEX_NO_FEEDBACK")
        coin_share_ui = "Поделиться монетой" in (js if asset else "") or "Поделиться монетой" in html
        print("PUBLIC_COIN_SHARE_UI", coin_share_ui)
        if not coin_share_ui:
            raise SystemExit("PUBLIC_INDEX_NO_COIN_SHARE")
        sides_ui = ("Аверс" in (js if asset else "") or "Аверс" in html) and (
            "Реверс" in (js if asset else "") or "Реверс" in html
        )
        print("PUBLIC_SIDES_UI", sides_ui)
        if not sides_ui:
            raise SystemExit("PUBLIC_INDEX_NO_SIDES")


def poll_public_admin_guard() -> None:
    req = Request(EXPECTED_URL + "/api/v1/admin/users", headers={"Accept": "application/json"})
    try:
        with urlopen(req, context=CTX, timeout=30) as resp:
            print("PUBLIC_ADMIN", resp.status)
            raise SystemExit("PUBLIC_ADMIN_EXPECTED_401")
    except HTTPError as err:
        print("PUBLIC_ADMIN", err.code)
        if err.code not in (401, 403):
            raise SystemExit(f"PUBLIC_ADMIN_UNEXPECTED {err.code}") from None


def poll_public_feedback_guard() -> None:
    req = Request(EXPECTED_URL + "/api/v1/admin/feedback", headers={"Accept": "application/json"})
    try:
        with urlopen(req, context=CTX, timeout=30) as resp:
            print("PUBLIC_FEEDBACK", resp.status)
            raise SystemExit("PUBLIC_FEEDBACK_EXPECTED_401")
    except HTTPError as err:
        print("PUBLIC_FEEDBACK", err.code)
        if err.code not in (401, 403):
            raise SystemExit(f"PUBLIC_FEEDBACK_UNEXPECTED {err.code}") from None


def verify_persistent_clip(key: str) -> None:
    payload = exec_cmd(
        key,
        "test -f /opt/app/ml/artifacts/20260826T193916Z/embeddings.npy && echo ARTIFACT_OK || echo ARTIFACT_MISSING; "
        "test -f /opt/app/ml/accounts.py && echo ACCOUNTS_OK || echo ACCOUNTS_MISSING; "
        "test -f /opt/app/ml/feedback.py && echo FEEDBACK_OK || echo FEEDBACK_MISSING; "
        "test -d /opt/data/clip -o -d /opt/data/hf/hub/models--openai--clip-vit-base-patch32 && echo CLIP_OK || echo CLIP_MISSING; "
        "mkdir -p /opt/data/uploads && echo DATA_DIR /opt/data && ls /opt/data | head",
        timeout=30,
    )
    stdout = ""
    if isinstance(payload, dict):
        stdout = str((payload.get("data") or {}).get("stdout") or "")
    if "ARTIFACT_MISSING" in stdout or "CLIP_MISSING" in stdout or "ACCOUNTS_MISSING" in stdout or "FEEDBACK_MISSING" in stdout:
        raise SystemExit("PERSISTENT_CLIP_OR_CODE_MISSING")


def deploy_spec() -> dict:
    return {
        "install": "test -x /opt/data/venv/bin/python && /opt/data/venv/bin/python -c 'import torch,fastapi,transformers'",
        "preStart": "mkdir -p /opt/data /opt/data/uploads /opt/data/hf /opt/data/hf/hub /opt/data/hf/transformers",
        "start": "cd /opt/app && /opt/data/venv/bin/python -m uvicorn ml.service:app --host 0.0.0.0 --port $PORT",
        "port": 3000,
        "healthPath": "/api/v1/health",
        "systemd": True,
        "cleanDeploy": True,
        "serviceName": "app",
        "displayName": "Нумизмат AI",
        "description": "AI-каталог для распознавания и учёта монет",
        "dataDirs": ["/opt/data"],
        "env": {
            "NUMISMAT_MODEL_ARTIFACT": "ml/artifacts/20260826T193916Z",
            "NUMISMAT_WEB_DIST": "dist",
            "NUMISMAT_CORS_ORIGINS": "*",
            "NUMISMAT_CLIP_MODEL": "/opt/data/clip",
            "NUMISMAT_DATA_DIR": "/opt/data",
            "NUMISMAT_UPLOADS_DIR": "/opt/data/uploads",
            "NUMISMAT_COOKIE_SECURE": "1",
            "NUMISMAT_PUBLIC_URL": "https://app-66ba5c12d8dc.vibecode.bitrix24.tech",
            "HF_HOME": "/opt/data/hf",
            "HF_HUB_CACHE": "/opt/data/hf/hub",
            "TRANSFORMERS_CACHE": "/opt/data/hf/transformers",
            "HF_ENDPOINT": "https://hf-mirror.com",
        },
    }


def current_source_version(key: str) -> str | None:
    status, payload, _ = api(key, "GET", f"/v1/infra/servers/{TARGET}/sources", timeout=60)
    print("SOURCES_HTTP", status)
    if not isinstance(payload, dict) or not payload.get("success"):
        return None
    data = payload.get("data") or {}
    version = data.get("currentVersionId")
    print("SOURCE_VERSION", version, "bytes", data.get("totalSizeBytes"))
    return version if isinstance(version, str) else None


def stream_deploy(key: str, spec: dict) -> tuple[dict | str, dict[str, str]]:
    body = json.dumps(spec, ensure_ascii=False).encode("utf-8")
    headers = {
        "X-Api-Key": key,
        "Accept": "text/event-stream",
        "Content-Type": "application/json",
    }
    req = Request(
        API + f"/v1/infra/servers/{TARGET}/deploy?stream=true",
        data=body,
        method="POST",
        headers=headers,
    )
    last: dict | str = {}
    meta: dict[str, str] = {}
    print("DEPLOY_JSON_BYTES", len(body))
    print("DEPLOY_STREAM_STARTED")
    try:
        with urlopen(req, context=CTX, timeout=700) as resp:
            meta = {name: value for name, value in resp.headers.items()}
            op = meta.get("X-Vibe-Operation-Id") or meta.get("x-vibe-operation-id")
            if op:
                print("OPERATION_ID", op)
            event = "message"
            chunks: list[str] = []
            while True:
                line = resp.readline()
                if not line:
                    break
                text = line.decode("utf-8", errors="replace").rstrip("\r\n")
                if text.startswith("event:"):
                    event = text[6:].strip()
                    continue
                if text.startswith("data:"):
                    chunks.append(text[5:].lstrip())
                    continue
                if text:
                    print("SSE_RAW", text[:300])
                    continue
                if not chunks:
                    event = "message"
                    continue
                raw = "\n".join(chunks)
                chunks = []
                print("SSE", event, raw[:500])
                try:
                    parsed = json.loads(raw)
                except json.JSONDecodeError:
                    parsed = {"raw": raw[:1000]}
                last = parsed
                event = "message"
    except (URLError, http.client.IncompleteRead, TimeoutError) as err:
        print("STREAM_END", type(err).__name__, str(err)[:200])
    return last, meta


def wait_for_operation(key: str, op: str) -> bool:
    print("POLLING_OPERATION", op)
    for _ in range(40):
        time.sleep(15)
        op_status, op_payload, _ = api(key, "GET", f"/v1/infra/operations/{op}", timeout=60)
        print("OP_HTTP", op_status)
        if not isinstance(op_payload, dict):
            continue
        data = op_payload.get("data") or op_payload
        status_name = data.get("status") if isinstance(data, dict) else None
        print("OP_STATUS", status_name)
        if status_name in {"succeeded", "failed", "unknown"}:
            (OUT / "vibe_operation.json").write_text(
                json.dumps(op_payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            return status_name == "succeeded"
    return False


def exec_cmd(key: str, command: str, timeout: int = 300) -> dict | str:
    print("EXEC", command[:180], "timeout", timeout)
    status, payload, _ = api(
        key,
        "POST",
        f"/v1/infra/servers/{TARGET}/exec",
        json.dumps({"command": command, "timeout": timeout}).encode("utf-8"),
        "application/json",
        timeout=timeout + 90,
    )
    print("EXEC_HTTP", status)
    if isinstance(payload, dict):
        err = payload.get("error") or {}
        data = payload.get("data") or {}
        if err:
            print("EXEC_ERROR", err.get("code"), str(err.get("message") or "")[:300])
        if isinstance(data, dict):
            print("EXEC_EXIT", data.get("exitCode"), "dur", data.get("duration"))
            stdout = str(data.get("stdout") or "")[-800:]
            stderr = str(data.get("stderr") or "")[-800:]
            if stdout:
                print("EXEC_STDOUT", stdout.encode("utf-8", "replace").decode("ascii", "replace"))
            if stderr:
                print("EXEC_STDERR", stderr.encode("utf-8", "replace").decode("ascii", "replace"))
    else:
        print("EXEC_RAW", str(payload)[:400])
    return payload


def bootstrap_runtime(key: str) -> None:
    lock_status, lock_payload, _ = api(key, "DELETE", f"/v1/infra/servers/{TARGET}/lock")
    print("LOCK_HTTP", lock_status)
    if isinstance(lock_payload, dict):
        print("LOCK", json.dumps(lock_payload.get("data") or lock_payload, ensure_ascii=False)[:400])

    probe = exec_cmd(key, "python3 --version && python3 -m venv --help >/dev/null", timeout=30)
    need_py = True
    if isinstance(probe, dict):
        data = probe.get("data") or {}
        need_py = data.get("exitCode") not in (0, "0")
    if need_py:
        install_py = (
            "export DEBIAN_FRONTEND=noninteractive NEEDRESTART_SUSPEND=1 NEEDRESTART_MODE=a; "
            "apt-get update -y && apt-get install -y python3 python3-venv python3-pip python3-dev"
        )
        result = exec_cmd(key, install_py, timeout=600)
        if isinstance(result, dict) and (result.get("data") or {}).get("exitCode") not in (0, "0"):
            raise SystemExit("PYTHON3_INSTALL_FAILED")

    mkdir = exec_cmd(key, "mkdir -p /opt/data/venv /opt/data/hf /opt/data/hf/hub /opt/data/hf/transformers", timeout=30)
    if isinstance(mkdir, dict) and (mkdir.get("data") or {}).get("exitCode") not in (0, "0"):
        raise SystemExit("DATADIR_FAILED")

    py_ok = exec_cmd(key, "test -x /opt/data/venv/bin/python && /opt/data/venv/bin/python -c 'print(1)'", timeout=20)
    have_venv = isinstance(py_ok, dict) and (py_ok.get("data") or {}).get("exitCode") in (0, "0")
    if not have_venv:
        venv_pkg = exec_cmd(
            key,
            "export DEBIAN_FRONTEND=noninteractive; apt-get update -y && apt-get install -y python3.12-venv python3-pip",
            timeout=300,
        )
        if isinstance(venv_pkg, dict) and (venv_pkg.get("data") or {}).get("exitCode") not in (0, "0"):
            raise SystemExit("PYTHON_VENV_PKG_FAILED")
        create = exec_cmd(
            key,
            "rm -rf /opt/data/venv && python3 -m venv /opt/data/venv && /opt/data/venv/bin/pip install --upgrade pip",
            timeout=180,
        )
        if isinstance(create, dict) and (create.get("data") or {}).get("exitCode") not in (0, "0"):
            raise SystemExit("VENV_FAILED")

    venv_probe = exec_cmd(key, "/opt/data/venv/bin/python -c 'import torch,fastapi,transformers; print(\"ok\")'", timeout=30)
    need_pkgs = True
    if isinstance(venv_probe, dict):
        data = venv_probe.get("data") or {}
        need_pkgs = data.get("exitCode") not in (0, "0")
    if need_pkgs:
        start_pip = exec_cmd(
            key,
            "systemctl stop numismat-pip 2>/dev/null; systemctl reset-failed numismat-pip 2>/dev/null; "
            "systemd-run --unit=numismat-pip "
            "/opt/data/venv/bin/pip install torch numpy pillow transformers fastapi python-multipart uvicorn",
            timeout=30,
        )
        if isinstance(start_pip, dict) and start_pip.get("error"):
            raise SystemExit("PIP_BG_START_FAILED")
        deadline = time.time() + 1200
        while time.time() < deadline:
            time.sleep(20)
            active = exec_cmd(key, "systemctl is-active numismat-pip; systemctl is-failed numismat-pip", timeout=20)
            probe = exec_cmd(
                key,
                "/opt/data/venv/bin/python -c 'import torch,fastapi,transformers; print(\"ok\")'",
                timeout=30,
            )
            if isinstance(probe, dict) and (probe.get("data") or {}).get("exitCode") in (0, "0"):
                need_pkgs = False
                break
            if isinstance(active, dict):
                stdout = str((active.get("data") or {}).get("stdout") or "")
                if "failed" in stdout.split():
                    logs = exec_cmd(key, "journalctl -u numismat-pip -n 40 --no-pager", timeout=30)
                    print("PIP_UNIT_FAILED", logs)
                    raise SystemExit("PIP_BG_FAILED")
        if need_pkgs:
            raise SystemExit("PIP_BG_TIMEOUT")
    print("BOOTSTRAP_OK")


def main() -> None:
    key = load_personal_key()
    status, payload, _ = api(key, "GET", f"/v1/infra/servers/{TARGET}")
    print("TARGET_HTTP", status)
    if not isinstance(payload, dict) or not payload.get("success"):
        err = (payload or {}).get("error") if isinstance(payload, dict) else payload
        print("TARGET_ERROR", err)
        raise SystemExit("TARGET_NOT_VISIBLE")
    server = payload["data"]
    print("TARGET", json.dumps(summarize_server(server), ensure_ascii=False))
    assert_target(server)

    if server.get("status") == "sleeping":
        print("WAKING")
        wake_status, wake_payload, _ = api(key, "POST", f"/v1/infra/servers/{TARGET}/wake?wait=true", timeout=420)
        print("WAKE_HTTP", wake_status)
        print("WAKE", json.dumps(wake_payload, ensure_ascii=False)[:1000] if isinstance(wake_payload, dict) else wake_payload)
        if not isinstance(wake_payload, dict) or not wake_payload.get("success"):
            raise SystemExit("WAKE_FAILED")

    sleep_status, sleep_payload, _ = api(
        key,
        "PATCH",
        f"/v1/infra/servers/{TARGET}/sleep",
        json.dumps({"sleepAfterMinutes": None}).encode("utf-8"),
        "application/json",
    )
    print("SLEEP_HTTP", sleep_status)
    if isinstance(sleep_payload, dict):
        data = sleep_payload.get("data") or sleep_payload
        print("SLEEP", data.get("sleepAfterMinutes") if isinstance(data, dict) else sleep_payload.get("success"))

    bootstrap_runtime(key)
    exec_cmd(
        key,
        "mkdir -p /opt/data /opt/data/uploads /etc/systemd/system/app.service.d && "
        "printf '[Service]\\nEnvironment=NUMISMAT_CLIP_MODEL=/opt/data/clip\\nEnvironment=NUMISMAT_DATA_DIR=/opt/data\\nEnvironment=NUMISMAT_UPLOADS_DIR=/opt/data/uploads\\nEnvironment=NUMISMAT_COOKIE_SECURE=1\\nEnvironment=NUMISMAT_PUBLIC_URL=https://app-66ba5c12d8dc.vibecode.bitrix24.tech\\nEnvironment=HF_HUB_OFFLINE=1\\n' "
        "> /etc/systemd/system/app.service.d/clip.conf && "
        "test -f /opt/data/clip/config.json -o -d /opt/data/hf/hub/models--openai--clip-vit-base-patch32 && echo CLIP_BEFORE_OK || echo CLIP_BEFORE_MISSING; "
        "test -f /opt/app/ml/artifacts/20260826T193916Z/embeddings.npy && echo ARTIFACT_BEFORE_OK || echo ARTIFACT_BEFORE_MISSING",
        timeout=30,
    )

    spec = deploy_spec()
    force_fresh = "--reuse-source" not in sys.argv
    version = current_source_version(key)
    if version and not force_fresh:
        spec["source"] = {"versionId": version}
        print("REUSING_SOURCE", version)
        deploy_payload, deploy_meta = stream_deploy(key, spec)
        health_ok = print_deploy_result(deploy_payload) if isinstance(deploy_payload, dict) else False
    else:
        if version:
            print("UPLOADING_FRESH_ARCHIVE keeping CLIP under /opt/data")
        archive_path = Path(tempfile.gettempdir()) / "numismat-recognition.tar.gz"
        build_archive(archive_path)
        content = archive_path.read_bytes()
        fields = {
            "install": spec["install"],
            "preStart": spec["preStart"],
            "start": spec["start"],
            "port": str(spec["port"]),
            "healthPath": spec["healthPath"],
            "systemd": "true",
            "cleanDeploy": "true",
            "serviceName": spec["serviceName"],
            "displayName": spec["displayName"],
            "description": spec["description"],
            "dataDirs": json.dumps(spec["dataDirs"]),
            "env": json.dumps(spec["env"]),
        }
        body, content_type = encode_multipart(fields, "numismat-recognition.tar.gz", content)
        print("DEPLOY_BODY_BYTES", len(body))
        print("DEPLOY_STARTED")
        _status, deploy_payload, deploy_meta = api(
            key,
            "POST",
            f"/v1/infra/servers/{TARGET}/deploy?stream=false",
            body,
            content_type,
            timeout=720,
        )
        print("DEPLOY_HTTP", _status)
        health_ok = print_deploy_result(deploy_payload)
    if not health_ok:
        op = deploy_meta.get("X-Vibe-Operation-Id") or deploy_meta.get("x-vibe-operation-id")
        if op and wait_for_operation(key, op):
            health_ok = True
        if not health_ok:
            # Fallback: re-check server runtime after stream drop.
            status, payload, _ = api(key, "GET", f"/v1/infra/servers/{TARGET}")
            if isinstance(payload, dict) and payload.get("success"):
                print("AFTER_DEPLOY", json.dumps(summarize_server(payload["data"]), ensure_ascii=False))
            log_status, log_payload, _ = api(key, "GET", f"/v1/infra/servers/{TARGET}/logs?lines=80")
            if isinstance(log_payload, dict):
                lines = ((log_payload.get("data") or {}).get("logs") or [])
                for line in lines[-40:]:
                    print("LOG", line)
            raise SystemExit("DEPLOY_HEALTHCHECK_FAILED")

    policy_status, policy_payload, _ = api(
        key,
        "PATCH",
        f"/v1/infra/servers/{TARGET}/access-policy",
        json.dumps({"accessPolicy": "PUBLIC"}).encode("utf-8"),
        "application/json",
    )
    print("POLICY_HTTP", policy_status)
    if isinstance(policy_payload, dict):
        data = policy_payload.get("data") or policy_payload
        print("POLICY", data.get("accessPolicy") if isinstance(data, dict) else policy_payload.get("success"))
        (OUT / "vibe_policy.json").write_text(
            json.dumps(policy_payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    try:
        upload_icon(key)
    except Exception as exc:  # noqa: BLE001
        print("ICON_SKIP", type(exc).__name__)

    poll_public_health()
    verify_persistent_clip(key)
    poll_public_cabinets()
    poll_public_admin_guard()
    poll_public_feedback_guard()

    status, payload, _ = api(key, "GET", f"/v1/infra/servers/{TARGET}")
    if isinstance(payload, dict) and payload.get("success"):
        print("FINAL", json.dumps(summarize_server(payload["data"]), ensure_ascii=False))


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "status":
        key = load_personal_key()
        status, payload, _ = api(key, "GET", f"/v1/infra/servers/{TARGET}")
        print("TARGET_HTTP", status)
        if isinstance(payload, dict) and payload.get("success"):
            print("TARGET", json.dumps(summarize_server(payload["data"]), ensure_ascii=False))
        src_status, src_payload, _ = api(key, "GET", f"/v1/infra/servers/{TARGET}/sources")
        print("SOURCES_HTTP", src_status)
        if isinstance(src_payload, dict):
            print("SOURCES", json.dumps(src_payload.get("data"), ensure_ascii=False)[:2000])
        log_status, log_payload, _ = api(key, "GET", f"/v1/infra/servers/{TARGET}/logs?lines=60")
        if isinstance(log_payload, dict):
            for line in ((log_payload.get("data") or {}).get("logs") or [])[-40:]:
                print("LOG", line)
        rt_status, rt_payload, _ = api(key, "GET", "/v1/infra/runtimes")
        print("RUNTIMES_HTTP", rt_status)
        if isinstance(rt_payload, dict):
            data = rt_payload.get("data") or rt_payload
            items = data.get("items") if isinstance(data, dict) else data
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict) and "python" in str(item.get("id") or item.get("runtime") or "").lower():
                        print("RUNTIME", json.dumps(item, ensure_ascii=False)[:400])
            else:
                print("RUNTIMES", json.dumps(rt_payload, ensure_ascii=False)[:2500])
        raise SystemExit(0)
    if len(sys.argv) > 1 and sys.argv[1] == "repair":
        import base64
        import io
        key = load_personal_key()
        exec_cmd(
            key,
            "test -f /opt/app/ml/artifacts/20260826T193916Z/embeddings.npy && echo ARTIFACT_BEFORE_OK || echo ARTIFACT_BEFORE_MISSING; "
            "test -d /opt/data/clip -o -d /opt/data/hf/hub/models--openai--clip-vit-base-patch32 && echo CLIP_BEFORE_OK || echo CLIP_BEFORE_MISSING",
            timeout=20,
        )
        for rel in ("ml/service.py", "ml/accounts.py", "ml/feedback.py", "ml/__init__.py"):
            encoded = base64.b64encode((ROOT / rel).read_bytes()).decode("ascii")
            status, payload, _ = api(
                key,
                "POST",
                f"/v1/infra/servers/{TARGET}/upload",
                json.dumps({"path": f"/opt/app/{rel}", "content": encoded, "mode": "0644"}).encode("utf-8"),
                "application/json",
            )
            print("UPLOAD", rel, status, payload.get("success") if isinstance(payload, dict) else payload)
        dist = ROOT / "dist"
        if not (dist / "index.html").is_file():
            raise SystemExit("MISSING_DIST")
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w:gz") as tar:
            for path in dist.rglob("*"):
                if path.is_file():
                    tar.add(path, arcname=str(Path("dist") / path.relative_to(dist)))
        dist_bytes = buf.getvalue()
        print("DIST_TAR_BYTES", len(dist_bytes))
        encoded = base64.b64encode(dist_bytes).decode("ascii")
        status, payload, _ = api(
            key,
            "POST",
            f"/v1/infra/servers/{TARGET}/upload",
            json.dumps({"path": "/opt/app/_web_dist.tar.gz", "content": encoded, "mode": "0644"}).encode("utf-8"),
            "application/json",
            timeout=120,
        )
        print("UPLOAD dist", status, payload.get("success") if isinstance(payload, dict) else payload)
        exec_cmd(
            key,
            "mkdir -p /opt/data /opt/data/uploads /etc/systemd/system/app.service.d && "
            "rm -rf /opt/app/dist && tar -xzf /opt/app/_web_dist.tar.gz -C /opt/app && rm -f /opt/app/_web_dist.tar.gz && "
            "printf '[Service]\\nEnvironment=NUMISMAT_CLIP_MODEL=/opt/data/clip\\nEnvironment=NUMISMAT_DATA_DIR=/opt/data\\nEnvironment=NUMISMAT_UPLOADS_DIR=/opt/data/uploads\\nEnvironment=NUMISMAT_COOKIE_SECURE=1\\nEnvironment=NUMISMAT_PUBLIC_URL=https://app-66ba5c12d8dc.vibecode.bitrix24.tech\\nEnvironment=HF_HUB_OFFLINE=1\\n' "
            "> /etc/systemd/system/app.service.d/clip.conf && "
            "chown -R vibeapp:vibeapp /opt/data /opt/app/ml /opt/app/dist && "
            "systemctl daemon-reload && systemctl restart app && echo REPAIRED",
            timeout=45,
        )
        verify_persistent_clip(key)
        poll_public_health()
        poll_public_cabinets()
        poll_public_admin_guard()
        poll_public_feedback_guard()
        raise SystemExit(0)
    if len(sys.argv) > 1 and sys.argv[1] == "clip":
        key = load_personal_key()
        exec_cmd(
            key,
            "grep -q HF_ENDPOINT /opt/app/.env 2>/dev/null || echo HF_ENDPOINT=https://hf-mirror.com >> /opt/app/.env; "
            "grep HF_ENDPOINT /opt/app/.env || true",
            timeout=20,
        )
        exec_cmd(
            key,
            "systemctl stop numismat-clip 2>/dev/null; systemctl reset-failed numismat-clip 2>/dev/null; "
            "systemd-run --unit=numismat-clip "
            "--setenv=HF_ENDPOINT=https://hf-mirror.com "
            "--setenv=HF_HOME=/opt/data/hf "
            "--setenv=HF_HUB_CACHE=/opt/data/hf/hub "
            "--setenv=TRANSFORMERS_CACHE=/opt/data/hf/transformers "
            "/opt/data/venv/bin/python -c "
            "'from transformers import CLIPModel, CLIPProcessor; n=\"openai/clip-vit-base-patch32\"; "
            "CLIPProcessor.from_pretrained(n); CLIPModel.from_pretrained(n); print(\"clip-ready\")'",
            timeout=30,
        )
        deadline = time.time() + 900
        while time.time() < deadline:
            time.sleep(20)
            probe = exec_cmd(
                key,
                "ls /opt/data/hf/hub 2>/dev/null | head; "
                "systemctl is-active numismat-clip; "
                "test -d /opt/data/hf/hub/models--openai--clip-vit-base-patch32 && echo CLIP_DIR_OK || echo CLIP_DIR_MISSING",
                timeout=20,
            )
            stdout = ""
            if isinstance(probe, dict):
                stdout = str((probe.get("data") or {}).get("stdout") or "")
            if "CLIP_DIR_OK" in stdout:
                exec_cmd(key, "systemctl restart app", timeout=30)
                print("CLIP_READY_RESTARTED")
                raise SystemExit(0)
            if "failed" in stdout.split() or "inactive" in stdout.split():
                exec_cmd(key, "journalctl -u numismat-clip -n 30 --no-pager", timeout=20)
                # still wait a bit more if dir appeared
        raise SystemExit("CLIP_PREFETCH_TIMEOUT")
    main()
