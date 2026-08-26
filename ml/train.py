#!/usr/bin/env python3
"""Строит версионированный CLIP-индекс для few-shot распознавания монет."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", type=Path, default=Path("ml/data/processed/dataset.jsonl"))
    parser.add_argument("--output", type=Path, default=Path("ml/artifacts"))
    parser.add_argument("--model", default="openai/clip-vit-base-patch32")
    parser.add_argument("--batch-size", type=int, default=16)
    args = parser.parse_args()

    with args.dataset.open(encoding="utf-8") as source:
        rows = [json.loads(line) for line in source if line.strip()]
    if not rows:
        raise SystemExit("Датасет пуст. Сначала запустите сбор и build_dataset.py")

    version = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    output = args.output / version
    output.mkdir(parents=True, exist_ok=False)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = CLIPModel.from_pretrained(args.model).to(device).eval()
    processor = CLIPProcessor.from_pretrained(args.model)
    embeddings: list[np.ndarray] = []
    valid_rows = []

    for offset in range(0, len(rows), args.batch_size):
        batch_rows = rows[offset:offset + args.batch_size]
        images = []
        accepted = []
        for row in batch_rows:
            try:
                images.append(Image.open(row["image"]).convert("RGB"))
                accepted.append(row)
            except (OSError, ValueError) as error:
                print(f"Пропуск {row['image']}: {error}")
        if not images:
            continue
        inputs = processor(images=images, return_tensors="pt")
        with torch.inference_mode():
            features = model.get_image_features(**{key: value.to(device) for key, value in inputs.items()})
            features = features / features.norm(dim=-1, keepdim=True)
        embeddings.append(features.cpu().numpy().astype("float32"))
        valid_rows.extend(accepted)
        print(f"Обработано {min(offset + args.batch_size, len(rows))}/{len(rows)}")

    matrix = np.concatenate(embeddings)
    np.save(output / "embeddings.npy", matrix)
    (output / "records.json").write_text(
        json.dumps(valid_rows, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    dataset_hash = hashlib.sha256(args.dataset.read_bytes()).hexdigest()
    metadata = {
        "version": version,
        "created_at": datetime.now(UTC).isoformat(),
        "model": args.model,
        "strategy": "clip_cosine_nearest_neighbors",
        "dataset_sha256": dataset_hash,
        "samples": len(valid_rows),
        "classes": len({row["catalog_number"] for row in valid_rows}),
        "device": device,
        "publication_status": "candidate",
        "quality_gate": "manual_review_required",
    }
    (output / "model_card.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Кандидат модели сохранён в {output}")


if __name__ == "__main__":
    main()
