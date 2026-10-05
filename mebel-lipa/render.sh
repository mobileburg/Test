#!/usr/bin/env bash
# Рендер набора ракурсов в PNG через headless Chrome (без GPU — SwiftShader).
# Использование: ./render.sh [порт]   (ожидается запущенный `python3 -m http.server <порт>` в этой папке)
set -euo pipefail
PORT="${1:-8766}"
OUT="$(dirname "$0")/renders"
mkdir -p "$OUT"
BASE="http://127.0.0.1:${PORT}/?ui=0"

render() { # имя, query — последовательно, со своим профилем (параллельные экземпляры с общим профилем «слипаются»)
  local name="$1" query="$2"
  local prof; prof="$(mktemp -d)"
  echo "render $name"
  timeout 180 google-chrome --headless=new --no-sandbox --disable-gpu-sandbox \
    --user-data-dir="$prof" \
    --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist \
    --hide-scrollbars --window-size=1600,1000 --virtual-time-budget=8000 \
    --screenshot="$OUT/$name.png" "${BASE}&${query}" >/dev/null 2>&1 || true
  rm -rf "$prof"
}

render 01-polki-3-iso        "variant=shelves&shelves=3&view=iso"
render 02-polki-3-front      "variant=shelves&shelves=3&view=front"
render 03-polki-2-iso        "variant=shelves&shelves=2&view=iso"
render 04-komod-closed-iso   "variant=cabinet&shelves=3&doors=0&view=iso"
render 05-komod-open-iso     "variant=cabinet&shelves=3&doors=0.75&view=iso"
render 06-komod-closed-front "variant=cabinet&shelves=3&doors=0&view=front"
render 07-komod-2-open-iso   "variant=cabinet&shelves=2&doors=0.75&view=iso"
render 08-side-skos          "variant=shelves&shelves=3&view=side"
ls -la "$OUT"
