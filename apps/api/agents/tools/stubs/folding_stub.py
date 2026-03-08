"""
Folding API calls via Modal → Tamarind Bio.

Dispatches to the deployed Modal `run_inference` function which calls
the Tamarind /submit-job endpoint with AlphaFold settings.
"""

from __future__ import annotations

import os
from typing import Any


async def call_esmfold_api(sequence: str) -> dict[str, Any]:
    """Fast fold: 1 model via Modal → Tamarind AlphaFold."""
    return await _call_modal(sequence, num_models="1")


async def call_alphafold3_api(sequence: str) -> dict[str, Any]:
    """Full fold: 5 models via Modal → Tamarind AlphaFold."""
    return await _call_modal(sequence, num_models="5")


async def _call_modal(sequence: str, num_models: str = "5") -> dict[str, Any]:
    """
    Dispatch inference to the deployed Modal run_inference function.

    Raises on failure — no silent fallback to mock data.
    """
    import uuid

    job_id = str(uuid.uuid4())

    try:
        import modal  # type: ignore[import-untyped]

        app_name = os.environ.get("MODAL_APP_NAME", "biosync-orchestrator")
        fn = modal.Function.lookup(app_name, "run_inference")
        result: dict = await fn.remote.aio(
            sequence=sequence,
            job_id=job_id,
            num_models=num_models,
        )
        result["status"] = "success"
        return result

    except Exception as exc:
        import logging

        logging.getLogger(__name__).error(
            "Modal inference failed: %s", exc
        )
        raise Exception(f"Modal inference failed: {str(exc)}")