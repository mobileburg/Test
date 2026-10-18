#!/usr/bin/env python3
"""Рендерит баннер автошколы в PNG 2400x1600 через headless Chrome."""
import shutil
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
OUT = HERE / "out" / "banner-avtoshkola.png"
ARTIFACTS = Path("/opt/cursor/artifacts/screenshots")
CHROME = "/usr/local/bin/google-chrome"

W, H = 2400, 1600


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME,
            args=["--no-sandbox", "--force-color-profile=srgb", "--font-render-hinting=none"],
        )
        page = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
        page.goto((HERE / "index.html").as_uri(), wait_until="networkidle")
        page.wait_for_function("document.documentElement.dataset.ready === '1'", timeout=20000)
        page.wait_for_timeout(500)
        page.locator(".poster").screenshot(path=str(OUT), type="png")
        browser.close()

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    shutil.copy(OUT, ARTIFACTS / OUT.name)
    print(f"saved {OUT}")


if __name__ == "__main__":
    main()
