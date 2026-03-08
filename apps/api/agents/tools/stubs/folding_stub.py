import os
import httpx
from typing import Dict, Any


async def call_esmfold_api(sequence: str) -> Dict[str, Any]:
    \"\"\"Submit AlphaFold job via Tamarind Bio API (single-model, fast).\"\"\"
    return await _submit_tamarind_alphafold(
        sequence=sequence,
        num_models="1",
        num_recycles=3,
        use_msa=True,
        label="esmfold",
    )


async def call_alphafold3_api(sequence: str) -> Dict[str, Any]:
    \"\"\"Submit AlphaFold job via Tamarind Bio API (5-model, full).\"\"\"
    return await _submit_tamarind_alphafold(
        sequence=sequence,
        num_models="5",
        num_recycles=3,
        use_msa=True,
        label="alphafold3",
    )


async def _submit_tamarind_alphafold(
    sequence: str,
    num_models: str,
    num_recycles: int,
    use_msa: bool,
    label: str,
) -> Dict[str, Any]:
    \"\"\"Internal helper to submit an AlphaFold job to Tamarind Bio.\"\"\"
    api_key = os.environ.get("TAMARIND_API_KEY", "")
    base_url = os.environ.get("TAMARIND_API_BASE_URL", "https://app.tamarind.bio/api/")
    if not base_url.endswith("/"):
        base_url += "/"

    payload = {
        "jobName": f"biosync-{label}-{hash(sequence) % 100000}",
        "type": "alphafold",
        "settings": {
            "sequence": sequence,
            "numModels": num_models,
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