"""
BioSync Orchestrator — FastAPI application entry point.

Endpoints:
  POST /jobs                     Create and enqueue a new pipeline job
  GET  /jobs/{job_id}            Poll job status and retrieve results
  GET  /pipelines/tools          List available pipeline tools
  GET  /pipelines/templates      List pipeline templates
  GET  /health                   Health check
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.integrations.pipeline_registry import get_registry
from app.integrations.redis_store import RedisStore
from app.orchestrator.graph import run_pipeline
from app.orchestrator.state import SequenceInput
from app.orchestrator.tools import run_moe_analysis
from app.validation.schemas import JobCreateRequest

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logging.basicConfig(level=logging.INFO)
log = structlog.get_logger()


# ---------------------------------------------------------------------------
# App initialization and settings
# ---------------------------------------------------------------------------

from app.settings import get_settings
import os

settings = get_settings()
if settings.modal_token_id:
    os.environ["MODAL_TOKEN_ID"] = settings.modal_token_id
if settings.modal_token_secret:
    os.environ["MODAL_TOKEN_SECRET"] = settings.modal_token_secret
if settings.anthropic_api_key:
    os.environ["ANTHROPIC_API_KEY"] = settings.anthropic_api_key

# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------


_POLLER_INTERVAL_SECONDS = 30
_MODAL_POLL_TIMEOUT_SECONDS = 5


async def _modal_poller(store: RedisStore) -> None:
    """
    Background asyncio task that polls Redis every 30 seconds for jobs with
    status "running" that have a modal_call_id, then attempts a non-blocking
    Modal result fetch. On success runs MoE analysis and marks the job complete.
    """
    bound_log = log.bind(component="modal_poller")
    await bound_log.ainfo("modal_poller_started", interval=_POLLER_INTERVAL_SECONDS)

    while True:
        await asyncio.sleep(_POLLER_INTERVAL_SECONDS)

        try:
            jobs = await store.get_recent_jobs(limit=200)
        except Exception as exc:
            await bound_log.aerror("poller_redis_scan_failed", error=str(exc))
            continue

        running_jobs = [
            j for j in jobs
            if j.get("status") == "running"
            and isinstance(j.get("modal_handle"), dict)
            and j["modal_handle"].get("modal_call_id")
        ]

        for job in running_jobs:
            job_id: str = job["job_id"]
            job_log = log.bind(job_id=job_id, component="modal_poller")
            call_id: str = job["modal_handle"]["modal_call_id"]

            try:
                from app.settings import get_settings
                settings = get_settings()

                if getattr(settings, "mock_modal", False) or call_id.startswith("mock-"):
                    await job_log.awarning("poller_mock_modal_complete")
                    _mock_pdb = (
                        "HEADER    MOCK ALPHAFOLD STRUCTURE\n"
                        "ATOM      1  N   ALA A   1      1.000   1.000   1.000  1.00 50.00           N  \n"
                        "ATOM      2  CA  ALA A   1      1.537   2.326   1.000  1.00 55.00           C  \n"
                        "ATOM      3  C   ALA A   1      2.924   2.236   1.622  1.00 60.00           C  \n"
                        "ATOM      4  O   ALA A   1      3.845   3.067   1.399  1.00 65.00           O  \n"
                        "ATOM      5  CB  ALA A   1      0.613   3.393   1.543  1.00 70.00           C  \n"
                        "ATOM      6  N   GLY A   2      3.085   1.188   2.447  1.00 72.00           N  \n"
                        "ATOM      7  CA  GLY A   2      4.378   1.014   3.095  1.00 75.00           C  \n"
                        "ATOM      8  C   GLY A   2      5.396   2.126   2.810  1.00 78.00           C  \n"
                        "ATOM      9  O   GLY A   2      6.597   1.924   2.975  1.00 80.00           O  \n"
                        "TER\nEND\n"
                    )
                    raw_output: dict[str, Any] = {
                        "job_id": job_id,
                        "sequence_length": 16,
                        "best_pdb_content": _mock_pdb,
                        "confidence": 0.87,
                        "plddt_scores": [0.85, 0.88, 0.91, 0.87, 0.83],
                        "mock": True,
                    }
                else:
                    import modal  # type: ignore[import-untyped]

                    fc = modal.FunctionCall.from_id(call_id)
                    raw_output = await fc.get.aio(timeout=_MODAL_POLL_TIMEOUT_SECONDS)

                # If function finished but metrics are missing, log a warning and proceed
                # instead of looping infinitely (since fc.get() result is persistent).
                if not raw_output or ("best_plddt_mean" not in raw_output and not raw_output.get("mock")):
                    await job_log.awarning("poller_modal_result_incomplete", call_id=call_id, keys=list(raw_output.keys()) if raw_output else [])
                
                await job_log.ainfo("poller_modal_result_received")
                raw_output["job_id"] = job_id

                await store.set_modal_output(job_id, raw_output)

                report = await run_moe_analysis(raw_output)
                await store.set_moe_report(job_id, report)
                await store.update_status(job_id, "complete")

                await job_log.ainfo(
                    "poller_job_complete", confidence=report.overall_confidence
                )

            except asyncio.TimeoutError:
                await job_log.ainfo("poller_modal_still_running", call_id=call_id)

            except Exception as exc:
                # Check for Modal's own FunctionTimeoutError by name to avoid
                # a hard import-time dependency on modal.exception
                if type(exc).__name__ == "FunctionTimeoutError":
                    await job_log.ainfo("poller_modal_still_running", call_id=call_id)
                else:
                    await job_log.aerror(
                        "poller_job_failed",
                        call_id=call_id,
                        error=str(exc),
                        error_type=type(exc).__name__,
                    )
                    await store.fail_job(job_id, str(exc))


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[type-arg]
    await log.ainfo("biosync_startup")
    poller_store = get_store()
    poller_task = asyncio.create_task(_modal_poller(poller_store))
    try:
        yield
    finally:
        poller_task.cancel()
        try:
            await poller_task
        except asyncio.CancelledError:
            pass
        await poller_store.close()
        await log.ainfo("biosync_shutdown")


app = FastAPI(
    title="BioSync Orchestrator",
    description="Serverless agentic platform for Computational Biology pipelines",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Dependency helpers
# ---------------------------------------------------------------------------


def get_store() -> RedisStore:
    return RedisStore()


# ---------------------------------------------------------------------------
# Background task
# ---------------------------------------------------------------------------


async def _run_pipeline_background(job_id: str, initial_state: dict) -> None:
    store = get_store()
    try:
        await run_pipeline(initial_state, store)
    except Exception as exc:
        await log.aerror("background_pipeline_error", job_id=job_id, error=str(exc))
    finally:
        await store.close()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "biosync-orchestrator"}


@app.post("/jobs", status_code=202)
async def create_job(
    request: JobCreateRequest,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """
    Create a new pipeline job and begin async execution.

    Returns job_id immediately; poll GET /jobs/{job_id} for status.
    """
    job_id = str(uuid.uuid4())
    bound_log = log.bind(job_id=job_id)

    seq_input = SequenceInput(
        sequence=request.sequence,
        format=request.format,  # type: ignore[arg-type]
        metadata=request.metadata,
    )

    store = get_store()
    await store.create_job(job_id, seq_input, pipeline_id=request.pipeline_id)
    await store.close()

    initial_state: dict[str, Any] = {
        "job_id": job_id,
        "status": "pending",
        "sequence_input": seq_input,
        "validation_result": None,
        "audit_result": None,
        "modal_handle": None,
        "modal_output": None,
        "moe_report": None,
        "error": None,
    }

    background_tasks.add_task(_run_pipeline_background, job_id, initial_state)

    await bound_log.ainfo("job_accepted", pipeline_id=request.pipeline_id)

    return {
        "job_id": job_id,
        "status": "pending",
        "message": "Job accepted. Poll GET /jobs/{job_id} for status.",
    }


@app.get("/jobs/{job_id}")
async def get_job(job_id: str) -> dict[str, Any]:
    """
    Return the current state of a job, including results when complete.
    """
    store = get_store()
    try:
        state = await store.get_job(job_id)
    finally:
        await store.close()

    if state is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found")

    # Strip internal keys before returning
    state.pop("_store", None)
    return state


@app.get("/jobs/{job_id}/download/structure")
async def download_structure(job_id: str) -> Any:
    """
    Fetch a fresh presigned download URL from Tamarind and redirect the browser to it.
    The download is a ZIP archive containing all PDB structure files and score JSONs
    produced by AlphaFold / ESMFold / the configured model.
    """
    from fastapi.responses import RedirectResponse
    import httpx

    store = get_store()
    try:
        state = await store.get_job(job_id)
    finally:
        await store.close()

    if state is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found")

    modal_output = state.get("modal_output") or {}
    tamarind_job_name = modal_output.get("tamarind_job_name")

    if not tamarind_job_name:
        raise HTTPException(
            status_code=404,
            detail="No Tamarind job name found — structure files unavailable for this job (may be a mock run).",
        )

    _settings = get_settings()
    tamarind_key = _settings.tamarind_api_key
    tamarind_base = _settings.tamarind_api_base_url
    if not tamarind_base.endswith("/"):
        tamarind_base += "/"

    await log.ainfo("structure_download_requested", job_id=job_id, tamarind_job_name=tamarind_job_name)

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{tamarind_base}result",
                headers={"x-api-key": tamarind_key},
                json={"jobName": tamarind_job_name},
            )
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Tamarind API error: {exc}") from exc

    presigned_url = resp.text.replace('"', '').strip()
    if not presigned_url.startswith("https://"):
        raise HTTPException(
            status_code=404,
            detail="Structure files not yet available — Tamarind job may still be processing.",
        )

    # Redirect the browser directly to the S3 presigned URL (downloads zip)
    return RedirectResponse(url=presigned_url, status_code=302)


@app.get("/jobs/{job_id}/structure/pdb-content")
async def get_pdb_content(job_id: str) -> Any:
    """
    Return the best-ranked PDB structure as plain text for inline 3D visualization.
    Used by the MoleculeViewer frontend component (3Dmol.js).

    Strategy:
      1. Return cached best_pdb_content from Redis if present (fast path).
      2. Otherwise fetch the ZIP from Tamarind, extract rank-1 PDB, cache it, return it.
    """
    import io
    import zipfile
    import httpx
    from fastapi.responses import Response

    store = get_store()
    try:
        state = await store.get_job(job_id)
    finally:
        await store.close()

    if state is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found")

    modal_output = state.get("modal_output") or {}

    # Fast path — already cached from the original inference run
    cached_pdb = modal_output.get("best_pdb_content")
    if cached_pdb:
        return Response(
            content=cached_pdb,
            media_type="text/plain",
            headers={"Access-Control-Allow-Origin": "*"},
        )

    # Slow path — fetch ZIP from Tamarind and extract rank-1 PDB on the fly
    tamarind_job_name = modal_output.get("tamarind_job_name")
    if not tamarind_job_name:
        raise HTTPException(
            status_code=404,
            detail="No structure available — job may be a mock run or still processing.",
        )

    _settings = get_settings()
    tamarind_key = _settings.tamarind_api_key
    tamarind_base = _settings.tamarind_api_base_url
    if not tamarind_base.endswith("/"):
        tamarind_base += "/"

    try:
        # 1. Get presigned URL
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{tamarind_base}result",
                headers={"x-api-key": tamarind_key},
                json={"jobName": tamarind_job_name},
            )
        resp.raise_for_status()
        presigned_url = resp.text.replace('"', '').strip()
        if not presigned_url.startswith("https://"):
            raise HTTPException(status_code=404, detail="Structure files not yet available from Tamarind.")

        # 2. Download ZIP
        async with httpx.AsyncClient(timeout=120) as client:
            dl = await client.get(presigned_url)
        dl.raise_for_status()

        # 3. Extract best PDB (rank_001 preferred)
        pdb_text: str | None = None
        with zipfile.ZipFile(io.BytesIO(dl.content)) as zf:
            names = zf.namelist()
            pdb_names = [n for n in names if n.lower().endswith(".pdb")]
            # Prefer rank_001
            rank1 = [n for n in pdb_names if "rank_001" in n or "rank_1_" in n]
            chosen = rank1[0] if rank1 else (sorted(pdb_names)[0] if pdb_names else None)
            if chosen:
                pdb_text = zf.read(chosen).decode("utf-8", errors="replace")

        if not pdb_text:
            raise HTTPException(status_code=404, detail="No PDB files found in Tamarind ZIP.")

        await log.ainfo("pdb_content_fetched_from_tamarind", job_id=job_id, tamarind_job=tamarind_job_name)

        return Response(
            content=pdb_text,
            media_type="text/plain",
            headers={"Access-Control-Allow-Origin": "*"},
        )

    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Tamarind fetch error: {exc}") from exc


@app.get("/jobs/{job_id}/download/raw-output")
async def download_raw_output(job_id: str) -> Any:
    """
    Download the full raw output from the AlphaFold/Tamarind pipeline as a JSON file.
    Includes per-model pLDDT scores, PAE, PTM, and configuration metadata.
    """
    from fastapi.responses import JSONResponse

    store = get_store()
    try:
        state = await store.get_job(job_id)
    finally:
        await store.close()

    if state is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found")

    modal_output = state.get("modal_output")
    if not modal_output:
        raise HTTPException(status_code=404, detail="Raw output not yet available for this job")

    import json
    from fastapi.responses import Response
    content = json.dumps(modal_output, indent=2)
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="raw_output_{job_id[:8]}.json"'},
    )


@app.get("/jobs/{job_id}/download/moe-report")
async def download_moe_report(job_id: str) -> Any:
    """
    Download the full MoE expert analysis report as a JSON file.
    Includes statistician, critic, and synthesizer outputs.
    """
    store = get_store()
    try:
        state = await store.get_job(job_id)
    finally:
        await store.close()

    if state is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found")

    moe_report = state.get("moe_report")
    if not moe_report:
        raise HTTPException(status_code=404, detail="MoE report not yet available for this job")

    import json
    from fastapi.responses import Response
    content = json.dumps(moe_report, indent=2)
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="moe_report_{job_id[:8]}.json"'},
    )


@app.get("/pipelines/tools")
async def list_tools() -> dict[str, Any]:
    """List all registered pipeline tool definitions (for the workflow builder UI)."""
    registry = get_registry()
    tools = registry.list_tools()
    return {
        "tools": [
            {
                "name": t.name,
                "display_name": t.display_name,
                "description": t.description,
                "category": t.category,
                "input_schema": t.input_schema,
                "output_schema": t.output_schema,
            }
            for t in tools
        ]
    }


@app.get("/pipelines/templates")
async def list_templates() -> dict[str, Any]:
    """List available pipeline templates."""
    registry = get_registry()
    templates = registry.list_templates()
    return {
        "templates": [
            {
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "node_ids": t.node_ids,
            }
            for t in templates
        ]
    }
