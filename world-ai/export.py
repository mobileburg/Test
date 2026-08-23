#!/usr/bin/env python3
"""Экспорт скриншотов и PDF презентации «Обзор мировых ИИ»."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
SHOTS = ROOT / "screenshots"
ARTIFACTS = Path("/opt/cursor/artifacts/screenshots")
PDF_PATH = ROOT / "Obzor_mirovyh_II.pdf"
URL = "http://127.0.0.1:8766/slides.html"

SLIDES = [f"s{i}" for i in range(1, 10)]


def main() -> None:
    SHOTS.mkdir(parents=True, exist_ok=True)
    ARTIFACTS.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1600, "height": 900}, device_scale_factor=2)
        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(1500)

        for idx, slide_id in enumerate(SLIDES, start=1):
            locator = page.locator(f"#{slide_id}")
            locator.scroll_into_view_if_needed()
            page.wait_for_timeout(250)
            out = SHOTS / f"{idx:02d}-{slide_id}.png"
            locator.screenshot(path=str(out), type="png")
            locator.screenshot(path=str(ARTIFACTS / f"ai-slide-{idx:02d}.png"), type="png")
            print(f"saved {out.name}")

        page.screenshot(path=str(SHOTS / "overview.png"), full_page=True, type="png")
        page.screenshot(path=str(ARTIFACTS / "ai-overview.png"), full_page=True, type="png")
        print("saved overview.png")

        pdf_page = browser.new_page(viewport={"width": 1600, "height": 900})
        pdf_page.goto("http://127.0.0.1:8766/print.html", wait_until="networkidle")
        pdf_page.wait_for_timeout(1500)
        pdf_page.pdf(
            path=str(PDF_PATH),
            width="1600px",
            height="900px",
            print_background=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
        )
        print(f"saved {PDF_PATH}")
        browser.close()


if __name__ == "__main__":
    main()
