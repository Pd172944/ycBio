"""JSON file store — local filesystem in dev, Modal Volume in production."""
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any
import os

DATA_DIR = Path(os.environ.get("DATA_DIR", "./data"))


def _path(key: str) -> Path:
    p = DATA_DIR / f"{key}.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


async def store_get(key: str) -> dict | None:
    p = DATA_DIR / f"{key}.json"
    if not p.exists():
        return None
    return json.loads(p.read_text())


async def store_set(key: str, value: dict) -> None:
    p = _path(key)
    p.write_text(json.dumps(value, default=str))


async def store_delete(key: str) -> None:
    p = DATA_DIR / f"{key}.json"
    if p.exists():
        p.unlink()


async def store_list(prefix: str) -> list[dict]:
    """Return all objects stored under a directory prefix."""
    dir_path = DATA_DIR / prefix
    if not dir_path.exists():
        return []
    results = []
    for f in sorted(dir_path.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            results.append(json.loads(f.read_text()))
        except Exception:
            pass
    return results
