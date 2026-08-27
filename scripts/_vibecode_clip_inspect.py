#!/usr/bin/env python3
"""Показать состав CLIP-кэша на VM без секретов."""

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
        "echo SNAP; ls -la /opt/data/hf/hub/models--openai--clip-vit-base-patch32/snapshots/3d74acf9a28c67741b2f4f2ea7635f0aaf6f0268; "
        "echo BLOBS; du -sh /opt/data/hf/hub/models--openai--clip-vit-base-patch32/*; "
        "echo FIND; find /opt/data/hf -type f \\( -name 'pytorch_model.bin' -o -name '*.safetensors' -o -name 'config.json' -o -name 'preprocessor_config.json' \\) | head -40; "
        "echo QUOTES; python3 -c 'import pathlib; p=pathlib.Path(\"/opt/app/.env\"); print(repr(p.read_text()[:800]))'",
        timeout=40,
    )


if __name__ == "__main__":
    main()
