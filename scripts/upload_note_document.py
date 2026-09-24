#!/usr/bin/env python3
"""Загрузка Markdown в документ База знаний 2.0 Битрикс24 (note.document.update)."""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_DOC_ID = 18
DEFAULT_TITLE = "План питания для снижения веса (сидячая работа)"
DEFAULT_MD = Path(__file__).resolve().parents[1] / "docs" / "plan-pitaniya-sidachaya-rabota.md"

ENV_KEYS = (
    "BITRIX24_WEBHOOK",
    "BITRIX24_WEBHOOK_URL",
    "B24_WEBHOOK",
    "B24_WEBHOOK_URL",
    "BITRIX_WEBHOOK",
    "WEBHOOK_BITRIX24",
    "INCOMING_WEBHOOK",
)


def get_webhook_base() -> str:
    for key in ENV_KEYS:
        value = os.environ.get(key, "").strip()
        if value:
            return normalize_webhook(value)
    raise SystemExit(
        "Не найден вебхук в env. Задайте одну из переменных: "
        + ", ".join(ENV_KEYS)
    )


def normalize_webhook(raw: str) -> str:
    url = raw.rstrip("/")
    # Полный URL вида https://portal.bitrix24.ru/rest/1/xxx/
    if "/rest/" in url:
        if url.endswith(".json"):
            url = url[: -len(".json")]
        return url + "/"
    # Только код — собираем URL портала из BITRIX24_DOMAIN или дефолта
    domain = os.environ.get("BITRIX24_DOMAIN", "gorshechnikov.bitrix24.ru").strip()
    user_id = os.environ.get("BITRIX24_USER_ID", "1").strip()
    return f"https://{domain}/rest/{user_id}/{url}/"


def strip_admin_block(markdown: str) -> str:
    marker = "## Примечание для администратора Битрикс24"
    if marker in markdown:
        markdown = markdown.split(marker, 1)[0].rstrip()
    return markdown + "\n"


def build_api_url(webhook_base: str) -> str:
    # REST 3.0 для note.*
    base = webhook_base.rstrip("/")
    base = re.sub(r"/rest/\d+/[^/]+$", lambda m: m.group(0), base)
    # /rest/1/CODE/ -> /rest/api/1/CODE/note.document.update
    match = re.match(r"^(https?://[^/]+)/rest/(\d+)/([^/]+)/?$", base)
    if not match:
        raise SystemExit(f"Некорректный формат вебхука: {webhook_base}")
    host, user_id, code = match.groups()
    return f"{host}/rest/api/{user_id}/{code}/note.document.update"


def upload_document(
    *,
    doc_id: int,
    title: str,
    markdown: str,
    overwrite: bool = True,
) -> dict:
    webhook_base = get_webhook_base()
    api_url = build_api_url(webhook_base)
    payload = {
        "id": doc_id,
        "fields": {
            "title": title,
            "markdown": markdown,
        },
        "overwrite": overwrite,
    }
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        api_url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"HTTP {exc.code}: {err_body}") from exc


def main() -> None:
    doc_id = int(os.environ.get("BITRIX24_DOCUMENT_ID", DEFAULT_DOC_ID))
    title = os.environ.get("BITRIX24_DOCUMENT_TITLE", DEFAULT_TITLE)
    md_path = Path(os.environ.get("BITRIX24_MD_PATH", str(DEFAULT_MD)))
    overwrite = os.environ.get("BITRIX24_OVERWRITE", "true").lower() in ("1", "true", "yes")

    if not md_path.is_file():
        raise SystemExit(f"Файл не найден: {md_path}")

    markdown = strip_admin_block(md_path.read_text(encoding="utf-8"))
    size = len(markdown.encode("utf-8"))
    if size > 1_048_576:
        raise SystemExit(f"Markdown слишком большой: {size} байт (лимит 1 048 576)")

    print(f"Документ ID: {doc_id}")
    print(f"Размер markdown: {size} байт")
    result = upload_document(
        doc_id=doc_id,
        title=title,
        markdown=markdown,
        overwrite=overwrite,
    )
    item = result.get("result", {}).get("item", {})
    print("OK — документ обновлён")
    print(f"  id: {item.get('id')}")
    print(f"  title: {item.get('title')}")
    print(f"  updatedAt: {item.get('updatedAt')}")


if __name__ == "__main__":
    main()
