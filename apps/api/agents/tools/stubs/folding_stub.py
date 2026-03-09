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
        # Modal not deployed yet — return mock so UI/pipeline can be tested
        import asyncio
        import logging
        logging.getLogger(__name__).warning(
            "Modal not available (%s) — using mock folding response", exc
        )
        await asyncio.sleep(1)
        return _mock_response(model)


def _mock_response(model: str) -> dict[str, Any]:
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
        "model_version": f"{model}_mock",
        "mock": True,
    }
            "numRecycles": num_recycles,
            "useMSA": use_msa,
        },
    }

    async with httpx.AsyncClient(timeout=300) as client:
        response = await client.post(
            f"{base_url}submit-job",
            headers={"x-api-key": api_key},
            json=payload,
        )
        response.raise_for_status()
        result = response.json()

    return {
        "status": "success",
        "tamarind_job_id": result.get("jobId"),
        "pdb_content": result.get("pdbContent", ""),
        "confidence_score": result.get("confidenceScore", 0.0),
        "confidence_scores": result.get("confidenceScores", []),
        "processing_time": result.get("processingTime", 0.0),
        "model_version": f"tamarind_alphafold_{label}",
    }