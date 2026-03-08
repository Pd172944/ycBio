"""
Modal serverless GPU worker for BioSync inference.

Deploy:    modal deploy app/workers/modal_runner.py
Run once:  modal run app/workers/modal_runner.py::run_inference --sequence "MKTAY..."

Tamarind API flow:
  1. POST /submit-job   → submit job, get jobName confirmation
  2. Poll POST /result  → returns presigned URL when job is complete
  3. GET presigned URL  → download result files
"""

from __future__ import annotations

import asyncio
import json
import os

import modal

# ---------------------------------------------------------------------------
# Modal App configuration
# ---------------------------------------------------------------------------

APP_NAME = os.environ.get("MODAL_APP_NAME", "biosync-orchestrator")

app = modal.App(APP_NAME)

volume = modal.Volume.from_name("biosync-outputs", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "httpx>=0.27.0",
        "structlog>=24.2.0",
        "pydantic>=2.7.0",
    )
)

# Polling config
_POLL_INTERVAL_SECONDS = 30
_MAX_POLL_ATTEMPTS = 20  # 20 * 30s = 10 min max


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

    Flow:
      1. POST /submit-job   — submit job
      2. Poll POST /result  — wait for presigned URL
      3. GET presigned URL  — download results

    Args:
        sequence: Amino acid sequence (use ':' to separate chains for multimers)
        job_id: Caller-assigned job ID for output path and logging
        job_name: Tamarind job name (defaults to biosync-{job_id})
        num_models: Number of AlphaFold models ("1"–"5")
        num_recycles: Recycling iterations for refinement
        use_msa: Whether to use Multiple Sequence Alignment

    Returns:
        dict with inference results and metadata
    """
    import httpx
    import structlog

    log = structlog.get_logger().bind(job_id=job_id)

    tamarind_key = os.environ["TAMARIND_API_KEY"]
    tamarind_base = os.environ.get("TAMARIND_API_BASE_URL", "https://app.tamarind.bio/api/")
    if not tamarind_base.endswith("/"):
        tamarind_base += "/"

    tamarind_job_name = job_name or f"biosync-{job_id}"

    # ------------------------------------------------------------------
    # Step 1: Submit job
    # ------------------------------------------------------------------
    submit_payload = {
        "jobName": tamarind_job_name,
        "type": "alphafold",
        "settings": {
            "sequence": sequence,
            "numModels": num_models,
            "numRecycles": num_recycles,
            "useMSA": use_msa,
        },
    }

    await log.ainfo("tamarind_submit_start", job_name=tamarind_job_name, sequence_len=len(sequence))

    async with httpx.AsyncClient(timeout=60) as client:
        submit_resp = await client.post(
            f"{tamarind_base}submit-job",
            headers={"x-api-key": tamarind_key},
            json=submit_payload,
        )

    await log.ainfo(
        "tamarind_submit_response",
        status_code=submit_resp.status_code,
        body=submit_resp.text[:500],
    )
    submit_resp.raise_for_status()

    # ------------------------------------------------------------------
    # Step 2: Poll POST /result until presigned URL is ready
    # ------------------------------------------------------------------
    result_payload = {"jobName": tamarind_job_name}
    presigned_url: str | None = None

    for attempt in range(1, _MAX_POLL_ATTEMPTS + 1):
        await asyncio.sleep(_POLL_INTERVAL_SECONDS)
        await log.ainfo("tamarind_poll_attempt", attempt=attempt, job_name=tamarind_job_name)

        async with httpx.AsyncClient(timeout=30) as client:
            result_resp = await client.post(
                f"{tamarind_base}result",
                headers={"x-api-key": tamarind_key},
                json=result_payload,
            )

        await log.ainfo(
            "tamarind_poll_response",
            attempt=attempt,
            status_code=result_resp.status_code,
            body=result_resp.text[:500],
        )

        if result_resp.status_code == 200 and result_resp.text.strip():
            try:
                result_data = result_resp.json()
                # Tamarind returns a presigned URL — could be at top level or nested
                presigned_url = (
                    result_data
                    if isinstance(result_data, str)
                    else result_data.get("url") or result_data.get("presignedUrl")
                )
                if presigned_url:
                    await log.ainfo("tamarind_result_ready", attempt=attempt)
                    break
            except Exception:
                pass  # Not ready yet, keep polling

    if not presigned_url:
        raise TimeoutError(
            f"Tamarind job {tamarind_job_name!r} did not complete within "
            f"{_MAX_POLL_ATTEMPTS * _POLL_INTERVAL_SECONDS}s"
        )

    # ------------------------------------------------------------------
    # Step 3: Download results from presigned URL
    # ------------------------------------------------------------------
    await log.ainfo("tamarind_download_start", url=presigned_url[:80])

    async with httpx.AsyncClient(timeout=120) as client:
        download_resp = await client.get(presigned_url)
    download_resp.raise_for_status()

    # Results may be JSON or raw file content depending on what Tamarind returns
    try:
        result: dict = download_resp.json()
    except Exception:
        result = {"raw_content": download_resp.text}

    result["job_id"] = job_id
    result["tamarind_job_name"] = tamarind_job_name
    result["sequence_length"] = len(sequence)

    # ------------------------------------------------------------------
    # Write to Modal Volume
    # ------------------------------------------------------------------
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
        sequence = (
            "MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKRQTL"
            "GQHDFSAGEGLYTHMKALRPDEDRLSPLHSVYVDQWDWERVMGDGERQFSTLKSTVEAIWAGIKATEAAVSEEFGLAPFLP"
            "DQIHFVHSQELLSRYPDLDAKGRERAIAKDLGAVFLVGIGGKLSDGHRHDVRAPDYDDWSTPSELGHAGLNGDILVWNPSV"
            "NMRFSHFNHDVITQQHTEKPLIINGEGLQR"
        )

    result = run_inference.remote(sequence=sequence, job_id=job_id)
    print(json.dumps(result, indent=2))
