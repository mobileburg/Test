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
from pathlib import Path

BASE_URL = "https://www.cbr.ru/legacy/PhotoStore/img"
USER_AGENT = "NumismatDatasetBuilder/0.2 (source: cbr.ru)"
MAGIC = {
    b"\x89PNG\r\n\x1a\n": ".png",
    b"\xff\xd8\xff": ".jpg",
}


def read_jsonl(path: Path) -> list[dict]:
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
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Не удалось загрузить {url}")


def download_side(record: dict, side: str, image_dir: Path) -> dict | None:
    catalog_number = record["catalog_number"]
    suffix = "r" if side == "reverse" else ""
    source_url = f"{BASE_URL}/{catalog_number}{suffix}.jpg"
    try:
        payload = fetch(source_url)
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as error:
        print(f"Пропуск {catalog_number} {side}: {error}")
        return None
    extension = detect_extension(payload)
    if not extension or len(payload) < 5_000:
        print(f"Пропуск {catalog_number} {side}: неверный формат или размер")
        return None
    filename = f"{catalog_number}-{side}{extension}"
    destination = image_dir / filename
    destination.write_bytes(payload)
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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--metadata", type=Path, default=Path("ml/data/cbr/manifest.jsonl"))
    parser.add_argument("--output", type=Path, default=Path("ml/data/cbr_images"))
    parser.add_argument("--limit", type=int, default=0, help="0 — весь каталог")
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()

    records = read_jsonl(args.metadata)
    if args.limit:
        records = records[:args.limit]
    image_dir = args.output / "images"
    image_dir.mkdir(parents=True, exist_ok=True)
    jobs = [(record, side) for record in records for side in ("obverse", "reverse")]
    accepted: list[dict] = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [
            executor.submit(download_side, record, side, image_dir)
            for record, side in jobs
        ]
        for index, future in enumerate(concurrent.futures.as_completed(futures), 1):
            result = future.result()
            if result:
                accepted.append(result)
            if index % 50 == 0 or index == len(jobs):
                print(f"Проверено {index}/{len(jobs)}, принято {len(accepted)}")

    accepted.sort(key=lambda item: (item["catalog_number"], item["side"]))
    manifest_path = args.output / "manifest.jsonl"
    with manifest_path.open("w", encoding="utf-8") as target:
        for record in accepted:
            target.write(json.dumps(record, ensure_ascii=False) + "\n")
    print(f"Готово: {len(accepted)} изображений, манифест {manifest_path}")


if __name__ == "__main__":
    main()
