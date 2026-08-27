#!/usr/bin/env python3
"""Назначить role=admin существующему пользователю.

Пример:
  python scripts/promote_admin.py you@example.com
  NUMISMAT_ADMIN_EMAIL=you@example.com python scripts/promote_admin.py

Файл БД: $NUMISMAT_DATA_DIR/app.db (локально по умолчанию ml/data/app.db).
Эквивалент SQL:
  UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
"""

from __future__ import annotations

import os
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ml.accounts import _admin_email, _data_dir, init_storage  # noqa: E402


def main() -> None:
    email = (sys.argv[1] if len(sys.argv) > 1 else _admin_email()).strip().lower()
    if not email:
        raise SystemExit("Укажите email аргументом или NUMISMAT_ADMIN_EMAIL")
    init_storage()
    db_path = _data_dir() / "app.db"
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute("SELECT id, email, role FROM users WHERE email = ?", (email,)).fetchone()
        if row is None:
            raise SystemExit(f"Пользователь {email} не найден в {db_path}")
        conn.execute("UPDATE users SET role = 'admin' WHERE email = ?", (email,))
        conn.commit()
        print(f"OK id={row['id']} email={email} role=admin db={db_path}")
    finally:
        conn.close()


if __name__ == "__main__":
    os.environ.setdefault("NUMISMAT_DATA_DIR", str(ROOT / "ml" / "data"))
    main()
