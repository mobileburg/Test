#!/usr/bin/env python3
"""Убрать кавычки из путей HF в .env и перезапустить API."""

from __future__ import annotations

import importlib.util
from pathlib import Path

SCRIPT = Path(__file__).with_name("_vibecode_deploy_recognition.py")


def load_mod():
    spec = importlib.util.spec_from_file_location("deploy", SCRIPT)
    if spec is None or spec.loader is None:
        raise SystemExit("NO_DEPLOY_SCRIPT")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main() -> None:
    mod = load_mod()
    key = mod.load_personal_key()
    command = r"""
python3 - <<'PY'
from pathlib import Path
path = Path('/opt/app/.env')
text = path.read_text(encoding='utf-8')
lines = []
wanted = {
    'HF_HOME': '/opt/data/hf',
    'HF_HUB_CACHE': '/opt/data/hf/hub',
    'TRANSFORMERS_CACHE': '/opt/data/hf/transformers',
    'HF_HUB_OFFLINE': '1',
    'TRANSFORMERS_OFFLINE': '1',
    'NUMISMAT_CORS_ORIGINS': '*',
}
seen = set()
for raw in text.splitlines():
    if not raw.strip() or raw.strip().startswith('#') or '=' not in raw:
        lines.append(raw)
        continue
    key, _, value = raw.partition('=')
    key = key.strip()
    if key in wanted:
        lines.append(f'{key}={wanted[key]}')
        seen.add(key)
    else:
        value = value.strip().strip('"').strip("'")
        lines.append(f'{key}={value}')
for key, value in wanted.items():
    if key not in seen:
        lines.append(f'{key}={value}')
path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(path.read_text(encoding='utf-8'))
PY
systemctl restart app
echo APP=$(systemctl is-active app)
"""
    mod.exec_cmd(key, command.strip(), timeout=50)


if __name__ == "__main__":
    main()
