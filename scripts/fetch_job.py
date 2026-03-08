"""
Fetch a completed Tamarind job and run MoE analysis.
Usage: python scripts/fetch_job.py
"""

import asyncio
import io
import json
import zipfile

import httpx

JOB_ID = "24d6710b-0d5e-427f-a617-a5b01dc8be5e"
JOB_NAME = "biosync-24d6710b-0d5e-427f-a617-a5b01dc8be5e"
API_KEY = "ad165a1e-3366-4d8a-b116-28ab8e694f06"
SEQUENCE_LENGTH = 273


async def main() -> None:
    from app.orchestrator.tools import run_moe_analysis

    # Step 1: Get presigned URL from Tamarind
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://app.tamarind.bio/api/result",
            headers={"x-api-key": API_KEY},
            json={"jobName": JOB_NAME},
        )
    print(f"Status: {r.status_code}  Body: {r.text[:200]}")

    url = r.text.replace('"', "").strip()
    if not url.startswith("https://"):
        print("Job not ready yet — try again later.")
        return

    # Step 2: Download zip
    print("Downloading results zip...")
    async with httpx.AsyncClient(timeout=120) as client:
        zip_resp = await client.get(url)
    zip_resp.raise_for_status()

    # Step 3: Extract scores
    SKIP_SUFFIXES = {".png", ".a3m", ".m8", ".parquet", ".ffdata", ".ffindex", ".cif"}
    per_model_scores = []

    with zipfile.ZipFile(io.BytesIO(zip_resp.content)) as zf:
        print("Zip contents:", zf.namelist())
        for name in zf.namelist():
            lower = name.lower()
            if any(lower.endswith(s) for s in SKIP_SUFFIXES):
                continue
            if "_scores_rank_" in lower and lower.endswith(".json"):
                scores = json.loads(zf.read(name))
                rank = int(lower.split("_scores_rank_")[1].split("_")[0])
                arr = scores.get("plddt", [])
                per_model_scores.append({
                    "rank": rank,
                    "plddt_mean": round(sum(arr) / len(arr), 3) if arr else None,
                    "plddt_min": round(min(arr), 3) if arr else None,
                    "plddt_max": round(max(arr), 3) if arr else None,
                    "max_pae": scores.get("max_pae"),
                    "ptm": scores.get("ptm"),
                })

    per_model_scores.sort(key=lambda x: x["rank"])
    best = per_model_scores[0] if per_model_scores else {}
    print("\nPer-model scores:")
    print(json.dumps(per_model_scores, indent=2))

    raw = {
        "job_id": JOB_ID,
        "tamarind_job_name": JOB_NAME,
        "sequence_length": SEQUENCE_LENGTH,
        "model_type": "alphafold2_ptm",
        "num_models": 5,
        "best_plddt_mean": best.get("plddt_mean"),
        "best_plddt_min": best.get("plddt_min"),
        "best_max_pae": best.get("max_pae"),
        "per_model_scores": per_model_scores,
    }

    # Step 4: Run MoE
    print("\nRunning MoE analysis...")
    report = await run_moe_analysis(raw)
    print("\n=== MoE Report ===")
    print(report.model_dump_json(indent=2))


if __name__ == "__main__":
    asyncio.run(main())
