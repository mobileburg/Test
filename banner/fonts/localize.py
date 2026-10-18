#!/usr/bin/env python3
"""Скачивает woff2-файлы из CSS Google Fonts и переписывает ссылки на локальные пути."""
import re
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36"

parts = []
for css_path in sorted(HERE.glob("*.css")):
    if css_path.name == "fonts.css":
        continue
    css = css_path.read_text(encoding="utf-8")
    for url in sorted(set(re.findall(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", css))):
        name = url.rsplit("/", 1)[-1]
        target = HERE / name
        if not target.exists():
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as resp:
                target.write_bytes(resp.read())
        css = css.replace(url, name)
    parts.append(css)

(HERE / "fonts.css").write_text("\n".join(parts), encoding="utf-8")
print("woff2:", len(list(HERE.glob("*.woff2"))))
