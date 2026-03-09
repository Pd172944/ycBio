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
_MAX_POLL_ATTEMPTS = 60  # 60 * 30s = 30 min max


# ---------------------------------------------------------------------------
# Inference function
# ---------------------------------------------------------------------------


@app.function(
    image=image,
    gpu="A10G",
    timeout=2400,  # 40 min — covers 30 min poll window + overhead
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
            # Tamarind returns the presigned URL as a plain quoted string e.g. "https://..."
            candidate = result_resp.text.replace('"', '').strip()
            if candidate.startswith("https://"):
                presigned_url = candidate
                await log.ainfo("tamarind_result_ready", attempt=attempt)
                break
            # Not ready yet — keep polling

    if not presigned_url:
        raise TimeoutError(
            f"Tamarind job {tamarind_job_name!r} did not complete within "
            f"{_MAX_POLL_ATTEMPTS * _POLL_INTERVAL_SECONDS}s"
        )

    # ------------------------------------------------------------------
    # Step 3: Download zip from presigned S3 URL
    # ------------------------------------------------------------------
    import io
    import zipfile

    await log.ainfo("tamarind_download_start", url=presigned_url[:80])

    async with httpx.AsyncClient(timeout=120) as client:
        download_resp = await client.get(presigned_url)
    download_resp.raise_for_status()

    # ------------------------------------------------------------------
    # Step 4: Extract zip — store PDBs to volume, parse score files
    # ------------------------------------------------------------------
    output_dir = f"/outputs/{job_id}"
    os.makedirs(output_dir, exist_ok=True)

    # File types to skip entirely (binary/large/not useful for analysis)
    _SKIP_SUFFIXES = {".png", ".a3m", ".m8", ".parquet", ".ffdata", ".ffindex", ".cif"}
    _SKIP_NAMES = {"predicted_aligned_error_v1.json"}  # PAE matrix — too large

    pdb_files: list[str] = []
    per_model_scores: list[dict] = []
    config_data: dict = {}

    with zipfile.ZipFile(io.BytesIO(download_resp.content)) as zf:
        await log.ainfo("tamarind_zip_contents", files=zf.namelist())

        for name in zf.namelist():
            basename = os.path.basename(name)
            lower = basename.lower()

            # Skip directories and unwanted file types
            if name.endswith("/") or any(lower.endswith(s) for s in _SKIP_SUFFIXES):
                continue
            if basename in _SKIP_NAMES:
                continue

            content = zf.read(name)
            dest_path = f"{output_dir}/{basename}"

            with open(dest_path, "wb") as fh:
                fh.write(content)

            if lower == "config.json":
                try:
                    config_data = json.loads(content)
                except Exception:
                    pass

            elif "_scores_rank_" in lower and lower.endswith(".json"):
                try:
                    scores = json.loads(content)
                    # Extract rank number from filename
                    rank = int(lower.split("_scores_rank_")[1].split("_")[0])
                    plddt_arr = scores.get("plddt", [])
                    per_model_scores.append({
                        "rank": rank,
                        "plddt_mean": round(sum(plddt_arr) / len(plddt_arr), 3) if plddt_arr else None,
                        "plddt_min": round(min(plddt_arr), 3) if plddt_arr else None,
                        "plddt_max": round(max(plddt_arr), 3) if plddt_arr else None,
                        "max_pae": scores.get("max_pae"),
                        "ptm": scores.get("ptm"),
                        "iptm": scores.get("iptm"),
                    })
                except Exception:
                    pass

            elif lower.endswith(".pdb"):
                pdb_files.append(dest_path)

    await volume.commit.aio()
    per_model_scores.sort(key=lambda x: x["rank"])
    await log.ainfo("output_written", dir=output_dir, pdb_count=len(pdb_files), models=len(per_model_scores))

    # Read best-ranked PDB text into memory for inline 3D visualization
    best_pdb_content: str | None = None
    if pdb_files:
        rank1_candidates = [p for p in pdb_files if "rank_001" in p or "rank_1_" in p]
        best_pdb_path = rank1_candidates[0] if rank1_candidates else sorted(pdb_files)[0]
        try:
            with open(best_pdb_path) as fh:
                best_pdb_content = fh.read()
        except Exception:
            pass

    best = per_model_scores[0] if per_model_scores else {}
    result: dict = {
        "job_id": job_id,
        "tamarind_job_name": tamarind_job_name,
        "sequence_length": len(sequence),
        "pdb_paths": pdb_files,
        "best_pdb_content": best_pdb_content,
        "model_type": config_data.get("model_type", "alphafold2_ptm"),
        "num_models": config_data.get("num_models"),
        "num_recycles": config_data.get("num_recycles"),
        "best_plddt_mean": best.get("plddt_mean"),
        "best_plddt_min": best.get("plddt_min"),
        "best_max_pae": best.get("max_pae"),
        "best_ptm": best.get("ptm"),
        "per_model_scores": per_model_scores,
    }

    summary_path = f"{output_dir}/raw_result.json"
    with open(summary_path, "w") as fh:
        json.dump(result, fh, indent=2)

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
