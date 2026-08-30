#!/usr/bin/env python3
"""Загружает доверенные эталонные изображения монет Банка России."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterable

BASE_URL = "https://www.cbr.ru/legacy/PhotoStore/img"
USER_AGENT = "NumismatDatasetBuilder/0.2 (source: cbr.ru)"
MAGIC = {
    b"\x89PNG\r\n\x1a\n": ".png",
    b"\xff\xd8\xff": ".jpg",
}


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as source:
        return [json.loads(line) for line in source if line.strip()]


def detect_extension(payload: bytes) -> str | None:
    for signature, extension in MAGIC.items():
        if payload.startswith(signature):
            return extension
    return None


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if 400 <= error.code < 500 or attempt == 3:
                raise
            time.sleep(2 ** attempt)
        except (urllib.error.URLError, TimeoutError):
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Не удалось загрузить {url}")


def build_manifest_record(
    record: dict, side: str, filename: str, payload: bytes, source_url: str
) -> dict:
    return {
        **record,
        "image": f"images/{filename}",
        "side": side,
        "image_source_url": source_url,
        "image_sha256": hashlib.sha256(payload).hexdigest(),
        "image_bytes": len(payload),
        "image_license": "Материалы сайта Банка России; ссылка на первоисточник обязательна",
        "trusted": True,
        "review_status": "approved",
    }


def valid_payload(payload: bytes) -> str | None:
    extension = detect_extension(payload)
    return extension if extension and len(payload) >= 5_000 else None


def existing_side(record: dict, side: str, image_dir: Path) -> dict | None:
    catalog_number = record["catalog_number"]
    suffix = "r" if side == "reverse" else ""
    source_url = f"{BASE_URL}/{catalog_number}{suffix}.jpg"
    stem = f"{catalog_number}-{side}"
    for extension in MAGIC.values():
        path = image_dir / f"{stem}{extension}"
        if not path.is_file():
            continue
        payload = path.read_bytes()
        if valid_payload(payload) == extension:
            return build_manifest_record(record, side, path.name, payload, source_url)
        print(f"Повторная загрузка {catalog_number} {side}: локальный файл повреждён")
    return None


def unavailable_record(record: dict, side: str, reason: str, source_url: str) -> dict:
    return {
        "catalog_number": record["catalog_number"],
        "side": side,
        "image_source_url": source_url,
        "reason": reason,
        "checked_at": datetime.now(UTC).isoformat(),
    }


def download_side(
    record: dict, side: str, image_dir: Path
) -> tuple[dict | None, dict | None]:
    existing = existing_side(record, side, image_dir)
    if existing:
        return existing, None
    catalog_number = record["catalog_number"]
    suffix = "r" if side == "reverse" else ""
    source_url = f"{BASE_URL}/{catalog_number}{suffix}.jpg"
    try:
        payload = fetch(source_url)
    except urllib.error.HTTPError as error:
        print(f"Пропуск {catalog_number} {side}: {error}")
        failure = unavailable_record(record, side, f"http_{error.code}", source_url)
        return None, failure
    except (urllib.error.URLError, TimeoutError) as error:
        print(f"Временная ошибка {catalog_number} {side}: {error}")
        return None, None
    extension = valid_payload(payload)
    if not extension:
        print(f"Пропуск {catalog_number} {side}: неверный формат или размер")
        failure = unavailable_record(record, side, "invalid_payload", source_url)
        return None, failure
    filename = f"{catalog_number}-{side}{extension}"
    destination = image_dir / filename
    temporary = destination.with_suffix(destination.suffix + ".part")
    temporary.write_bytes(payload)
    temporary.replace(destination)
    return build_manifest_record(record, side, filename, payload, source_url), None


def write_jsonl(path: Path, records: Iterable[dict]) -> None:
    temporary = path.with_suffix(path.suffix + ".part")
    with temporary.open("w", encoding="utf-8") as target:
        for record in sorted(records, key=lambda item: (item["catalog_number"], item["side"])):
            target.write(json.dumps(record, ensure_ascii=False) + "\n")
    temporary.replace(path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--metadata", type=Path, default=Path("ml/data/cbr/manifest.jsonl"))
    parser.add_argument("--output", type=Path, default=Path("ml/data/cbr_images"))
    parser.add_argument("--limit", type=int, default=0, help="0 — весь каталог")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument(
        "--retry-unavailable",
        action="store_true",
        help="повторно проверить URL из failures.jsonl",
    )
    args = parser.parse_args()
    if args.workers < 1:
        parser.error("--workers должен быть не меньше 1")

    records = read_jsonl(args.metadata)
    if args.limit:
        records = records[:args.limit]
    image_dir = args.output / "images"
    image_dir.mkdir(parents=True, exist_ok=True)
    accepted: dict[tuple[str, str], dict] = {}
    manifest_path = args.output / "manifest.jsonl"
    failure_path = args.output / "failures.jsonl"
    failures = {
        (item["catalog_number"], item["side"]): item
        for item in read_jsonl(failure_path)
    }
    jobs = [
        (record, side)
        for record in records
        for side in ("obverse", "reverse")
        if args.retry_unavailable or (record["catalog_number"], side) not in failures
    ]
    skipped = len(records) * 2 - len(jobs)
    if skipped:
        print(f"Пропущено ранее недоступных URL: {skipped}")

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [
            executor.submit(download_side, record, side, image_dir)
            for record, side in jobs
        ]
        for index, future in enumerate(concurrent.futures.as_completed(futures), 1):
            result, failure = future.result()
            if result:
                key = (result["catalog_number"], result["side"])
                accepted[key] = result
                failures.pop(key, None)
            if failure:
                failures[(failure["catalog_number"], failure["side"])] = failure
            if index % 50 == 0 or index == len(jobs):
                write_jsonl(manifest_path, accepted.values())
                write_jsonl(failure_path, failures.values())
                print(f"Проверено {index}/{len(jobs)}, принято {len(accepted)}")

    write_jsonl(manifest_path, accepted.values())
    write_jsonl(failure_path, failures.values())
    print(f"Готово: {len(accepted)} изображений, манифест {manifest_path}")


if __name__ == "__main__":
    main()
