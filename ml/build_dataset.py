#!/usr/bin/env python3
"""Объединяет изображения Commons с официальной разметкой Банка России."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as source:
        return [json.loads(line) for line in source if line.strip()]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--images", type=Path, default=Path("ml/data/wikimedia/manifest.jsonl"))
    parser.add_argument("--cbr-images", type=Path, default=Path("ml/data/cbr_images/manifest.jsonl"))
    parser.add_argument("--metadata", type=Path, default=Path("ml/data/cbr/manifest.jsonl"))
    parser.add_argument("--feedback", type=Path, default=Path("ml/data/feedback/manifest.jsonl"))
    parser.add_argument("--output", type=Path, default=Path("ml/data/processed/dataset.jsonl"))
    args = parser.parse_args()

    metadata = {item["catalog_number"]: item for item in read_jsonl(args.metadata)}
    rows = []
    unmatched = 0
    for image in read_jsonl(args.cbr_images):
        rows.append({
            **image,
            "image": str(args.cbr_images.parent / image["image"]),
        })

    for image in read_jsonl(args.images):
        catalog_number = image.get("catalog_number")
        coin = metadata.get(catalog_number)
        if not coin:
            unmatched += 1
            continue
        rows.append({
            **coin,
            "image": str(args.images.parent / image["image"]),
            "side": image["side"],
            "image_source_url": image["source_url"],
            "image_author": image["author"],
            "image_license": image["license"],
            "image_license_url": image["license_url"],
        })

    seen_feedback: set[str] = set()
    try:
        from ml.feedback import approved_training_rows

        for feedback in approved_training_rows():
            key = str(feedback.get("id") or feedback.get("image") or "")
            if key:
                seen_feedback.add(key)
            rows.append({**feedback, "source": "Пользователь Нумизмата"})
    except Exception as error:  # noqa: BLE001 — офлайн-сборка без серверной БД
        print(f"Серверная очередь фидбека пропущена: {error}")

    for feedback in read_jsonl(args.feedback):
        if feedback.get("review_status") != "approved":
            continue
        key = str(feedback.get("id") or feedback.get("image") or "")
        if key and key in seen_feedback:
            continue
        rows.append({**feedback, "source": "Пользователь Нумизмата"})

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as target:
        for row in rows:
            target.write(json.dumps(row, ensure_ascii=False) + "\n")
    trusted = sum(1 for row in rows if row.get("trusted"))
    print(f"Готово: {len(rows)} примеров; доверенных ЦБ: {trusted}; без разметки ЦБ: {unmatched}")


if __name__ == "__main__":
    main()
