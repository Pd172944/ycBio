"""
Modal serverless GPU worker for BioOS protein structure prediction.

Deploy:    modal deploy apps/api/workers/modal_runner.py
Run once:  modal run apps/api/workers/modal_runner.py::run_inference --sequence "MKTAY..."
"""

from __future__ import annotations

import json
import os

import modal

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


@app.function(
    image=image,
    gpu="A10G",
    timeout=600,
    volumes={"/outputs": volume},
    secrets=[modal.Secret.from_name("biosync-secrets")],
)
async def run_inference(sequence: str, job_id: str = "local", model: str = "esmfold") -> dict:
    """
    Run protein structure prediction via Tamarind Bio API.

    Args:
        sequence: Amino acid sequence string
        job_id: Caller-assigned job ID for output path and logging
        model: Model to use — "esmfold" or "alphafold3"

    Returns:
        dict with inference results (pdb_content, confidence_score, etc.)
    """
    import httpx
    import structlog

    log = structlog.get_logger().bind(job_id=job_id, model=model)

    tamarind_key = os.environ["TAMARIND_API_KEY"]
    tamarind_base = os.environ.get("TAMARIND_API_BASE_URL", "https://api.tamarind.bio/v1")

    await log.ainfo("tamarind_request_start", sequence_len=len(sequence))

    async with httpx.AsyncClient(timeout=300) as client:
        response = await client.post(
            f"{tamarind_base}/predict/structure",
            headers={"Authorization": f"Bearer {tamarind_key}"},
            json={"sequence": sequence, "model": model},
        )
        response.raise_for_status()
        result: dict = response.json()

    await log.ainfo("tamarind_request_complete", confidence=result.get("confidence_score"))

    result["job_id"] = job_id
    result["sequence_length"] = len(sequence)
    result["model_used"] = model

    # Write to Modal Volume
    output_path = f"/outputs/{job_id}/raw_result.json"
    os.makedirs(f"/outputs/{job_id}", exist_ok=True)
    with open(output_path, "w") as fh:
        json.dump(result, fh, indent=2)

    volume.commit()
    await log.ainfo("output_written", path=output_path)

@app.function(
    image=image,
    gpu="A10G",
    timeout=600,
    volumes={"/outputs": volume},
    secrets=[modal.Secret.from_name("biosync-secrets")],
)
async def run_docking(receptor_pdb: str, ligand_smiles: list[str], job_id: str = "local") -> dict:
    """
    Run molecular docking via Tamarind Bio API.

    Args:
        receptor_pdb: PDB content of the receptor protein
        ligand_smiles: List of ligand SMILES strings
        job_id: Caller-assigned job ID

    Returns:
        dict with docking results
    """
    import httpx
    import structlog

    log = structlog.get_logger().bind(job_id=job_id)

    tamarind_key = os.environ["TAMARIND_API_KEY"]
    tamarind_base = os.environ.get("TAMARIND_API_BASE_URL", "https://api.tamarind.bio/v1")

    await log.ainfo("tamarind_docking_start", num_ligands=len(ligand_smiles))

    results = []
    async with httpx.AsyncClient(timeout=300) as client:
        # Currently Tamarind might handle one ligand at a time or batch,
        # following the agent_docs/tamarind_api.md spec:
        for smiles in ligand_smiles:
            response = await client.post(
                f"{tamarind_base}/dock",
                headers={"Authorization": f"Bearer {tamarind_key}"},
                json={"receptor_pdb": receptor_pdb, "ligand_smiles": smiles},
            )
            response.raise_for_status()
            results.append(response.json())

    await log.ainfo("tamarind_docking_complete", count=len(results))

    final_result = {
        "status": "success",
        "results": results,
        "job_id": job_id,
        "total_poses": len(results)
    }

    # Write to Modal Volume
    output_path = f"/outputs/{job_id}/docking_result.json"
    os.makedirs(f"/outputs/{job_id}", exist_ok=True)
    with open(output_path, "w") as fh:
        json.dump(final_result, fh, indent=2)

    volume.commit()
    return final_result


@app.local_entrypoint()
def main(sequence: str = "", job_id: str = "local-test", model: str = "esmfold") -> None:
    if not sequence:
        sequence = (
            "MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKRQTL"
        )

    result = run_inference.remote(sequence=sequence, job_id=job_id, model=model)
    print(json.dumps(result, indent=2))
