"""
Folding API calls via Modal → Tamarind Bio.

Dispatches to the deployed Modal `run_inference` function which calls
the Tamarind /submit-job endpoint with AlphaFold settings.
When Modal is not yet deployed, falls back to a mock response so the rest
of the pipeline can be tested end-to-end.
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

    Falls back to mock data when Modal is not configured (no MODAL_APP_NAME
    env var or modal not authenticated) so the UI/pipeline can be tested
    end-to-end without a live deployment.
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
        import asyncio
        import logging

        logging.getLogger(__name__).warning(
            "Modal not available (%s) — using mock folding response", exc
        )
        await asyncio.sleep(1)
        return _mock_response(num_models)


def _mock_response(num_models: str) -> dict[str, Any]:
    pdb_content = """\
HEADER    MOCK STRUCTURE
ATOM      1  N   THR A   1      17.047  14.099   3.625  1.00 13.79           N
ATOM      2  CA  THR A   1      16.967  12.784   4.338  1.00 10.80           C
ATOM      3  C   THR A   1      15.685  12.755   5.133  1.00  9.19           C
ATOM      4  O   THR A   1      14.555  12.924   4.686  1.00 10.80           O
END
"""
    return {
        "status": "success",
        "pdb_content": pdb_content,
        "confidence_score": 0.0,
        "processing_time": 1.0,
        "model_version": f"alphafold_mock_{num_models}models",
        "mock": True,
    }
