"""
Folding API calls via Modal → Tamarind Bio.

When Modal is not yet deployed, falls back to a mock response so the rest
of the pipeline can be tested end-to-end.
"""

from __future__ import annotations

import os
from typing import Any


async def call_esmfold_api(sequence: str) -> dict[str, Any]:
    """Call ESMFold via Modal → Tamarind Bio API."""
    return await _call_modal(sequence, model="esmfold")


async def call_alphafold3_api(sequence: str) -> dict[str, Any]:
    """Call AlphaFold3 via Modal → Tamarind Bio API."""
    return await _call_modal(sequence, model="alphafold3")


async def _call_modal(sequence: str, model: str) -> dict[str, Any]:
    """
    Dispatch inference to Modal. Falls back to mock data if Modal is not
    configured (no MODAL_APP_NAME env var or modal not authenticated).
    """
    import uuid
    job_id = str(uuid.uuid4())

    try:
        import modal  # type: ignore[import-untyped]

        app_name = os.environ.get("MODAL_APP_NAME", "biosync-orchestrator")
        fn = modal.Function.lookup(app_name, "run_inference")
        result: dict = await fn.remote.aio(sequence=sequence, job_id=job_id, model=model)
        result["status"] = "success"
        return result

    except Exception as exc:
        import logging
        logging.getLogger(__name__).error(
            "Modal inference failed: %s", exc
        )
        raise Exception(f"Modal inference failed: {str(exc)}")
