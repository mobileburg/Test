#!/usr/bin/env python3
"""Собирает свободно лицензированные изображения российских монет."""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Iterator

API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "NumismatDatasetBuilder/0.1 (research; source attribution preserved)"
FREE_LICENSE_MARKERS = ("cc by", "cc-by", "cc0", "public domain", "pd-")
CATALOG_RE = re.compile(r"\b(?:RR)?(?P<number>5\d{3}-\d{4})(?P<reverse>R)?\b", re.I)


def api_request(params: dict[str, Any]) -> dict[str, Any]:
    query = urllib.parse.urlencode({"format": "json", "formatversion": 2, **params})
    request = urllib.request.Request(f"{API}?{query}", headers={"User-Agent": USER_AGENT})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == 3:
                raise
            time.sleep(2 ** (attempt + 1))
    raise RuntimeError("Не удалось получить ответ MediaWiki")


def category_files(category: str, depth: int = 1) -> Iterator[str]:
    queue = [(category, 0)]
    visited: set[str] = set()
    while queue:
        current, level = queue.pop(0)
        if current in visited:
            continue
        visited.add(current)
        continuation: str | None = None
        while True:
            params: dict[str, Any] = {
                "action": "query",
                "list": "categorymembers",
                "cmtitle": current,
                "cmlimit": "500",
                "cmtype": "file|subcat",
            }
            if continuation:
                params["cmcontinue"] = continuation
            payload = api_request(params)
            for member in payload["query"]["categorymembers"]:
                title = member["title"]
                if member["ns"] == 6:
                    yield title
                elif member["ns"] == 14 and level < depth:
                    queue.append((title, level + 1))
            continuation = payload.get("continue", {}).get("cmcontinue")
            if not continuation:
                break


def image_info(title: str) -> dict[str, Any] | None:
    payload = api_request({
        "action": "query",
        "prop": "imageinfo",
        "titles": title,
        "iiprop": "url|mime|size|extmetadata",
        "iiurlwidth": 768,
    })
    page = payload["query"]["pages"][0]
    info = page.get("imageinfo")
    return info[0] if info else None


def plain(metadata: dict[str, Any], key: str) -> str:
    value = metadata.get(key, {}).get("value", "")
    return re.sub(r"<[^>]+>", "", value).strip()


def is_free(metadata: dict[str, Any]) -> bool:
    license_text = " ".join([
        plain(metadata, "LicenseShortName"),
        plain(metadata, "UsageTerms"),
        plain(metadata, "Copyrighted"),
    ]).lower()
    return any(marker in license_text for marker in FREE_LICENSE_MARKERS)


def download(url: str, destination: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        destination.write_bytes(response.read())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--category", default="Category:Coins of the Russian Federation")
    parser.add_argument("--output", type=Path, default=Path("ml/data/wikimedia"))
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--depth", type=int, default=2)
    parser.add_argument("--delay", type=float, default=0.2)
    args = parser.parse_args()

    image_dir = args.output / "images"
    image_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = args.output / "manifest.jsonl"
    accepted = 0
    seen: set[str] = set()

    with manifest_path.open("w", encoding="utf-8") as manifest:
        for title in category_files(args.category, args.depth):
            if accepted >= args.limit:
                break
            if title in seen:
                continue
            seen.add(title)
            info = image_info(title)
            if not info or not info.get("mime", "").startswith("image/"):
                continue
            metadata = info.get("extmetadata", {})
            if not is_free(metadata):
                continue

            source_url = info.get("descriptionurl", "")
            image_url = info.get("thumburl") or info["url"]
            extension = Path(urllib.parse.urlparse(image_url).path).suffix.lower() or ".jpg"
            filename = f"{accepted:06d}{extension}"
            match = CATALOG_RE.search(title)
            record = {
                "id": f"commons:{info.get('sha1', filename)}",
                "image": f"images/{filename}",
                "title_ru": title.removeprefix("File:"),
                "catalog_number": match.group("number") if match else None,
                "side": "reverse" if match and match.group("reverse") else "obverse_or_unknown",
                "source": "Wikimedia Commons",
                "source_url": source_url,
                "author": plain(metadata, "Artist"),
                "license": plain(metadata, "LicenseShortName"),
                "license_url": plain(metadata, "LicenseUrl"),
                "attribution": plain(metadata, "Attribution"),
            }
            try:
                download(image_url, image_dir / filename)
            except (OSError, TimeoutError) as error:
                print(f"Пропуск {title}: {error}")
                continue
            manifest.write(json.dumps(record, ensure_ascii=False) + "\n")
            accepted += 1
            print(f"[{accepted}/{args.limit}] {title}")
            time.sleep(args.delay)

    print(f"Готово: {accepted} изображений, манифест {manifest_path}")


if __name__ == "__main__":
    main()
