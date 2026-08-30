#!/usr/bin/env python3
"""Ищет ближайшие монеты в построенном CLIP-индексе."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor


def extract_image_features(model: CLIPModel, inputs: dict) -> torch.Tensor:
    features = model.get_image_features(**inputs)
    return features.pooler_output if hasattr(features, "pooler_output") else features


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("image", type=Path)
    parser.add_argument("--artifact", type=Path, required=True)
    parser.add_argument("--top-k", type=int, default=5)
    args = parser.parse_args()

    card = json.loads((args.artifact / "model_card.json").read_text(encoding="utf-8"))
    records = json.loads((args.artifact / "records.json").read_text(encoding="utf-8"))
    index = np.load(args.artifact / "embeddings.npy")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = CLIPModel.from_pretrained(card["model"]).to(device).eval()
    processor = CLIPProcessor.from_pretrained(card["model"])
    inputs = processor(images=Image.open(args.image).convert("RGB"), return_tensors="pt")
    with torch.inference_mode():
        query = extract_image_features(
            model, {key: value.to(device) for key, value in inputs.items()}
        )
        query = (query / query.norm(dim=-1, keepdim=True)).cpu().numpy()[0]
    scores = index @ query
    best = np.argsort(scores)[::-1][:args.top_k]
    result = [
        {
            "confidence": round(float(scores[index_id]), 4),
            "catalog_number": records[index_id]["catalog_number"],
            "title_ru": records[index_id]["title_ru"],
            "nominal_ru": records[index_id]["nominal_ru"],
            "metal_ru": records[index_id]["metal_ru"],
            "source_url": records[index_id]["source_url"],
        }
        for index_id in best
    ]
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
