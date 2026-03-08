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
# App lifecycle
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[type-arg]
    await log.ainfo("biosync_startup")
    yield
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

    background_tasks.add_task(
        asyncio.create_task,
        _run_pipeline_background(job_id, initial_state),
    )

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
