#!/usr/bin/env python3
"""HTTP API распознавания по последней одобренной версии индекса."""

from __future__ import annotations

import io
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
from transformers import CLIPModel, CLIPProcessor

MAX_UPLOAD_BYTES = 15 * 1024 * 1024


class Recognizer:
    def __init__(self, artifact: Path) -> None:
        self.card = json.loads((artifact / "model_card.json").read_text(encoding="utf-8"))
        self.records = json.loads((artifact / "records.json").read_text(encoding="utf-8"))
        self.index = np.load(artifact / "embeddings.npy")
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = CLIPModel.from_pretrained(self.card["model"]).to(self.device).eval()
        self.processor = CLIPProcessor.from_pretrained(self.card["model"])

    def predict(self, image: Image.Image, top_k: int = 5) -> list[dict]:
        inputs = self.processor(images=image.convert("RGB"), return_tensors="pt")
        with torch.inference_mode():
            query = self.model.get_image_features(
                **{key: value.to(self.device) for key, value in inputs.items()}
            )
            query = (query / query.norm(dim=-1, keepdim=True)).cpu().numpy()[0]
        scores = self.index @ query
        ordered = np.argsort(scores)[::-1]
        results = []
        seen: set[str] = set()
        for index_id in ordered:
            record = self.records[int(index_id)]
            catalog_number = record["catalog_number"]
            if catalog_number in seen:
                continue
            seen.add(catalog_number)
            results.append({
                "confidence": round(float(scores[index_id]), 4),
                "catalogNumber": catalog_number,
                "title": record["nominal_ru"],
                "subtitle": record["title_ru"],
                "country": record["country_ru"],
                "year": int(record["release_date"][:4]),
                "metal": record["metal_ru"].strip(),
                "source": record["source"],
                "sourceUrl": record["source_url"],
            })
            if len(results) >= top_k:
                break
        return results


def latest_artifact(root: Path) -> Path:
    candidates = sorted(path for path in root.iterdir() if path.is_dir())
    if not candidates:
        raise RuntimeError(f"В {root} нет собранной модели")
    return candidates[-1]


@asynccontextmanager
async def lifespan(app: FastAPI):
    artifact_env = os.getenv("NUMISMAT_MODEL_ARTIFACT")
    artifact = Path(artifact_env) if artifact_env else latest_artifact(Path("ml/artifacts"))
    app.state.recognizer = Recognizer(artifact)
    yield


app = FastAPI(title="Нумизмат — распознавание", version="1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("NUMISMAT_CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)


@app.get("/api/v1/health")
def health() -> dict:
    recognizer: Recognizer = app.state.recognizer
    return {
        "status": "ok",
        "modelVersion": recognizer.card["version"],
        "samples": recognizer.card["samples"],
        "classes": recognizer.card["classes"],
    }


@app.post("/api/v1/recognize")
async def recognize(file: UploadFile = File(...)) -> dict:
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(415, "Поддерживаются JPG, PNG и WEBP")
    payload = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Изображение превышает 15 МБ")
    try:
        image = Image.open(io.BytesIO(payload))
        image.verify()
        image = Image.open(io.BytesIO(payload))
    except (UnidentifiedImageError, OSError):
        raise HTTPException(422, "Не удалось прочитать изображение") from None
    recognizer: Recognizer = app.state.recognizer
    return {
        "modelVersion": recognizer.card["version"],
        "results": recognizer.predict(image),
        "attribution": "Источник каталожных данных и эталонных изображений: Банк России",
    }
