from pathlib import Path
from .config import settings
from typing import Union
import os

ARTIFACTS_DIR = Path(settings.artifacts_dir)


def artifact_path(run_id: str, filename: str) -> Path:
    """Get the full path for an artifact file."""
    path = ARTIFACTS_DIR / run_id
    path.mkdir(parents=True, exist_ok=True)
    return path / filename


def write_artifact(run_id: str, filename: str, content: Union[bytes, str]) -> str:
    """Writes file, returns a relative path key for DB storage."""
    p = artifact_path(run_id, filename)
    if isinstance(content, str):
        p.write_text(content, encoding='utf-8')
    else:
        p.write_bytes(content)
    return str(p.relative_to(ARTIFACTS_DIR.parent))


def read_artifact(key: str) -> bytes:
    """Read artifact file by path key."""
    full_path = ARTIFACTS_DIR.parent / key
    if not full_path.exists():
        raise FileNotFoundError(f"Artifact not found: {key}")
    return full_path.read_bytes()


def read_artifact_text(key: str) -> str:
    """Read artifact file as text by path key."""
    full_path = ARTIFACTS_DIR.parent / key
    if not full_path.exists():
        raise FileNotFoundError(f"Artifact not found: {key}")
    return full_path.read_text(encoding='utf-8')


def artifact_exists(key: str) -> bool:
    """Check if artifact exists."""
    full_path = ARTIFACTS_DIR.parent / key
    return full_path.exists()


def get_artifact_url(run_id: str, filename: str) -> str:
    """Get the API URL for accessing an artifact."""
    return f"/api/artifacts/{run_id}/{filename}"