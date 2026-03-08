"""
Modal serverless GPU worker for BioSync inference.

Deploy:    modal deploy app/workers/modal_runner.py
Run once:  modal run app/workers/modal_runner.py::run_inference --sequence "MKTAY..."
"""

from __future__ import annotations

import json
import os

import modal

# ---------------------------------------------------------------------------
# Modal App configuration
# ---------------------------------------------------------------------------

APP_NAME = os.environ.get("MODAL_APP_NAME", "biosync-orchestrator")

app = modal.App(APP_NAME)

# Persistent volume for job outputs
volume = modal.Volume.from_name("biosync-outputs", create_if_missing=True)

# Container image with required Python packages
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "httpx>=0.27.0",
        "structlog>=24.2.0",
        "pydantic>=2.7.0",
    )
)


# ---------------------------------------------------------------------------
# Inference function
# ---------------------------------------------------------------------------


@app.function(
    image=image,
    gpu="A10G",
    timeout=600,
    volumes={"/outputs": volume},
    secrets=[modal.Secret.from_name("biosync-secrets")],
)
async def run_inference(
    sequence: str,
    job_id: str = "local",
    job_name: str = "",
    num_models: str = "5",
    num_recycles: int = 3,
    use_msa: bool = True,
) -> dict:
    """
    Run protein structure prediction via Tamarind Bio AlphaFold API.

    Args:
        sequence: Amino acid sequence string (use ':' to separate chains for multimers)
        job_id: Caller-assigned job ID for output path and logging
        job_name: Name for the Tamarind job (defaults to job_id)
        num_models: Number of AlphaFold models to run ("1"-"5")
        num_recycles: Number of recycling iterations for refined results
        use_msa: Whether to use Multiple Sequence Alignment

    Returns:
        dict with Tamarind job submission response and metadata
    """
    import httpx
    import structlog

    log = structlog.get_logger().bind(job_id=job_id)

    tamarind_key = os.environ["TAMARIND_API_KEY"]
    tamarind_base = os.environ.get(
        "TAMARIND_API_BASE_URL", "https://app.tamarind.bio/api/"
    )
    # Ensure base URL ends with /
    if not tamarind_base.endswith("/"):
        tamarind_base += "/"

    await log.ainfo("tamarind_request_start", sequence_len=len(sequence))

    payload = {
        "jobName": job_name or f"biosync-{job_id}",
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
            f"{tamarind_base}submit-job",
            headers={"x-api-key": tamarind_key},
            json=payload,
        )
        response.raise_for_status()
        result: dict = response.json()

    await log.ainfo(
        "tamarind_request_complete",
        tamarind_job_id=result.get("jobId"),
    )

    # Augment result with job metadata
    result["job_id"] = job_id
    result["sequence_length"] = len(sequence)

    # Write to Modal Volume
    output_path = f"/outputs/{job_id}/raw_result.json"
    os.makedirs(f"/outputs/{job_id}", exist_ok=True)
    with open(output_path, "w") as fh:
        json.dump(result, fh, indent=2)

    volume.commit()
    await log.ainfo("output_written", path=output_path)

    return result


# ---------------------------------------------------------------------------
# Local entrypoint for testing
# ---------------------------------------------------------------------------


@app.local_entrypoint()
def main(sequence: str = "", job_id: str = "local-test") -> None:
    if not sequence:
        # Default test sequence (Barnase)
        sequence = (
            "MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKRQTL"
            "GQHDFSAGEGLYTHMKALRPDEDRLSPLHSVYVDQWDWERVMGDGERQFSTLKSTVEAIWAGIKATEAAVSEEFGLAPFLP"
            "DQIHFVHSQELLSRYPDLDAKGRERAIAKDLGAVFLVGIGGKLSDGHRHDVRAPDYDDWSTPSELGHAGLNGDILVWNPSV"
            "NMRFSHFNHDVITQQHTEKPLIINGEGLQR"
        )

    result = run_inference.remote(sequence=sequence, job_id=job_id)
    print(json.dumps(result, indent=2))
