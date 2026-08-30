#!/usr/bin/env python3
"""Перевести CLIP в offline-режим на VM. Секреты не печатает."""

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
    mod.exec_cmd(
        key,
        "echo STRUCT; ls -la /opt/data/hf/hub; "
        "ls -la /opt/data/hf/hub/models--openai--clip-vit-base-patch32; "
        "ls /opt/data/hf/hub/models--openai--clip-vit-base-patch32/snapshots 2>/dev/null; "
        "ls /opt/data/hf/hub/models--openai--clip-vit-base-patch32/refs 2>/dev/null; "
        "echo ENV; grep -E 'HF_|TRANSFORMERS' /opt/app/.env || true",
        timeout=30,
    )
    mod.exec_cmd(
        key,
        "sed -i '/^HF_ENDPOINT=/d' /opt/app/.env; "
        "grep -q '^HF_HUB_OFFLINE=' /opt/app/.env || echo HF_HUB_OFFLINE=1 >> /opt/app/.env; "
        "sed -i 's/^HF_HUB_OFFLINE=.*/HF_HUB_OFFLINE=1/' /opt/app/.env; "
        "echo ENV2; grep -E 'HF_|TRANSFORMERS' /opt/app/.env || true; "
        "systemctl restart app; echo APP=$(systemctl is-active app)",
        timeout=40,
    )


if __name__ == "__main__":
    main()
