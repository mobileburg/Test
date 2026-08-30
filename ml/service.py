#!/usr/bin/env python3
"""HTTP API распознавания по последней одобренной версии индекса."""

from __future__ import annotations

import io
import json
import os
import threading
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError
from transformers import CLIPModel, CLIPProcessor

from ml.accounts import init_storage, router as accounts_router
from ml.feedback import init_feedback_storage, resolve_excluded_catalogs, router as feedback_router

MAX_UPLOAD_BYTES = 15 * 1024 * 1024


def extract_image_features(model: CLIPModel, inputs: dict) -> torch.Tensor:
    features = model.get_image_features(**inputs)
    return features.pooler_output if hasattr(features, "pooler_output") else features


class Recognizer:
    def __init__(self, artifact: Path) -> None:
        self.card = json.loads((artifact / "model_card.json").read_text(encoding="utf-8"))
        self.records = json.loads((artifact / "records.json").read_text(encoding="utf-8"))
        self.index = np.load(artifact / "embeddings.npy")
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        clip_source = os.getenv("NUMISMAT_CLIP_MODEL") or self.card["model"]
        self.model = CLIPModel.from_pretrained(clip_source, local_files_only=Path(clip_source).is_dir()).to(self.device).eval()
        self.processor = CLIPProcessor.from_pretrained(clip_source, local_files_only=Path(clip_source).is_dir())

    def predict(
        self,
        image: Image.Image,
        top_k: int = 5,
        exclude_catalogs: set[str] | None = None,
    ) -> list[dict]:
        excluded = {item.strip() for item in (exclude_catalogs or set()) if item and str(item).strip()}
        inputs = self.processor(images=image.convert("RGB"), return_tensors="pt")
        with torch.inference_mode():
            query = extract_image_features(
                self.model,
                {key: value.to(self.device) for key, value in inputs.items()},
            )
            query = (query / query.norm(dim=-1, keepdim=True)).cpu().numpy()[0]
        scores = self.index @ query
        ordered = np.argsort(scores)[::-1]
        results = []
        seen: set[str] = set()
        for index_id in ordered:
            record = self.records[int(index_id)]
            catalog_number = record["catalog_number"]
            if catalog_number in seen or catalog_number in excluded:
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
    required_files = ("model_card.json", "records.json", "embeddings.npy")
    candidates = sorted(
        path
        for path in root.iterdir()
        if path.is_dir() and all((path / filename).is_file() for filename in required_files)
    )
    if not candidates:
        raise RuntimeError(f"В {root} нет собранной модели")
    return candidates[-1]


def _load_recognizer(app: FastAPI, artifact: Path) -> None:
    try:
        app.state.recognizer = Recognizer(artifact)
        app.state.recognizer_error = None
    except Exception as exc:  # noqa: BLE001 — ошибка уходит в health/recognize
        app.state.recognizer_error = str(exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_storage()
    init_feedback_storage()
    artifact_env = os.getenv("NUMISMAT_MODEL_ARTIFACT")
    artifact = Path(artifact_env) if artifact_env else latest_artifact(Path("ml/artifacts"))
    app.state.recognizer = None
    app.state.recognizer_error = None
    thread = threading.Thread(target=_load_recognizer, args=(app, artifact), daemon=True)
    thread.start()
    yield


WEB_DIST = Path(os.getenv("NUMISMAT_WEB_DIST", "dist"))
CORS_ORIGINS = [item.strip() for item in os.getenv("NUMISMAT_CORS_ORIGINS", "http://localhost:5173").split(",") if item.strip()]

app = FastAPI(title="Нумизмат — распознавание", version="1.0", lifespan=lifespan)
_cors_wildcard = CORS_ORIGINS == ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=not _cors_wildcard,
)
app.include_router(accounts_router)
app.include_router(feedback_router)


def _ready_recognizer() -> Recognizer:
    error = getattr(app.state, "recognizer_error", None)
    if error:
        raise HTTPException(500, error)
    recognizer = getattr(app.state, "recognizer", None)
    if recognizer is None:
        raise HTTPException(503, "Модель ещё загружается")
    return recognizer


def _web_index() -> Path | None:
    index = WEB_DIST / "index.html"
    return index if index.is_file() else None


@app.get("/")
def root():
    index = _web_index()
    if index is not None:
        return FileResponse(index)
    return {"status": "ok", "service": "numismat-recognition"}


@app.get("/api/v1/health")
def health() -> dict:
    error = getattr(app.state, "recognizer_error", None)
    if error:
        raise HTTPException(500, error)
    recognizer = getattr(app.state, "recognizer", None)
    if recognizer is None:
        return {"status": "starting"}
    return {
        "status": "ok",
        "modelVersion": recognizer.card["version"],
        "samples": recognizer.card["samples"],
        "classes": recognizer.card["classes"],
    }


@app.post("/api/v1/recognize")
async def recognize(
    file: UploadFile = File(...),
    exclude_catalogs: str | None = Form(default=None),
    exclude_ids: str | None = Form(default=None),
) -> dict:
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
    recognizer = _ready_recognizer()
    excluded = resolve_excluded_catalogs(exclude_catalogs, exclude_ids)
    return {
        "modelVersion": recognizer.card["version"],
        "results": recognizer.predict(image, exclude_catalogs=excluded),
        "excludedCatalogs": sorted(excluded),
        "attribution": "Источник каталожных данных и эталонных изображений: Банк России",
    }


@app.get("/{full_path:path}")
def spa(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(404, "Not Found")
    index = _web_index()
    if index is None:
        raise HTTPException(404, "Not Found")
    dist_root = WEB_DIST.resolve()
    candidate = (WEB_DIST / full_path).resolve()
    try:
        candidate.relative_to(dist_root)
    except ValueError:
        return FileResponse(index)
    if candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(index)
