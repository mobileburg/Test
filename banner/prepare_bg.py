#!/usr/bin/env python3
"""Кадрирует и увеличивает фотоподложку до размера баннера 2400x1600 (3:2)."""
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

HERE = Path(__file__).resolve().parent
SRC = Path("/opt/cursor/artifacts/assets/autoschool-plate.jpg")
DST = HERE / "assets" / "bg.jpg"

TARGET = (2400, 1600)
CROP = (0, 96, 1152, 864)  # отрезаем верх, чтобы получить ровные 3:2


def main() -> None:
    im = Image.open(SRC).convert("RGB").crop(CROP)
    im = im.resize(TARGET, Image.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=2.2, percent=115, threshold=2))
    im = ImageEnhance.Color(im).enhance(1.12)
    im = ImageEnhance.Contrast(im).enhance(1.06)
    im = ImageEnhance.Brightness(im).enhance(1.06)
    DST.parent.mkdir(parents=True, exist_ok=True)
    im.save(DST, quality=95, subsampling=0)
    print(f"saved {DST} {im.size}")


if __name__ == "__main__":
    main()
