"""
LangGraph state machine for BioSync pipeline orchestration.

Node execution order:
  validate → audit → dispatch_modal → END

After dispatch_modal the graph ends immediately. A background poller in main.py
picks up jobs with status "running" and drives them to completion via Modal.

Each node receives the full state dict and returns the full state dict with updates merged in.
"""

from __future__ import annotations

import structlog
from langgraph.graph import END, StateGraph

from app.integrations.redis_store import RedisStore
from app.orchestrator.state import SequenceInput
from app.orchestrator.tools import (
    audit_context,
    trigger_modal_job,
    validate_schema,
)

log = structlog.get_logger()


# ---------------------------------------------------------------------------
# Node functions — receive full state, return full state with changes merged
# ---------------------------------------------------------------------------


async def node_validate(state: dict) -> dict:
    """Validate the sequence input against schema rules."""
    job_id: str = state["job_id"]
    seq: SequenceInput = state["sequence_input"]
    bound_log = log.bind(job_id=job_id)

    await bound_log.ainfo("node_validate_start")

    result = await validate_schema({"sequence": seq.sequence, "format": seq.format})

    if not result.valid:
        await bound_log.aerror("validation_failed", errors=result.errors)
        return {**state, "status": "failed", "error": f"Validation failed: {result.errors}"}

    await bound_log.ainfo("node_validate_complete", length=result.length)
    return {**state, "status": "auditing", "validation_result": result}


async def node_audit(state: dict) -> dict:
    """Run LLM-based contextual audit using job history."""
    job_id: str = state["job_id"]
    seq: SequenceInput = state["sequence_input"]
    store: RedisStore = state["_store"]
    bound_log = log.bind(job_id=job_id)

    await bound_log.ainfo("node_audit_start")
    history = await store.get_recent_jobs(limit=50)

    audit_result = await audit_context(
        {
            "sequence": seq.sequence,
            "format": seq.format,
            "metadata": seq.metadata,
            "job_id": job_id,
        },
        history,
    )

    if not audit_result.approved:
        await bound_log.awarning("audit_rejected", notes=audit_result.notes)
        return {
            **state,
            "status": "failed",
            "audit_result": audit_result,
            "error": f"Audit rejected: {audit_result.notes}",
        }

    await bound_log.ainfo("node_audit_complete", approved=audit_result.approved)
    return {**state, "status": "running", "audit_result": audit_result}


async def node_dispatch_modal(state: dict) -> dict:
    """Dispatch GPU inference job via Modal."""
    job_id: str = state["job_id"]
    seq: SequenceInput = state["sequence_input"]
    store: RedisStore = state["_store"]
    bound_log = log.bind(job_id=job_id)

    await bound_log.ainfo("node_dispatch_modal_start")

    handle = await trigger_modal_job(job_id=job_id, sequence=seq.sequence)
    await store.set_modal_handle(job_id, handle)

    await bound_log.ainfo("node_dispatch_modal_complete", call_id=handle.modal_call_id)
    return {**state, "status": "running", "modal_handle": handle}


# ---------------------------------------------------------------------------
# Routing logic
# ---------------------------------------------------------------------------


def route_after_validate(state: dict) -> str:
    return "failed" if state.get("status") == "failed" else "audit"


def route_after_audit(state: dict) -> str:
    return "failed" if state.get("status") == "failed" else "dispatch_modal"


def route_after_dispatch(state: dict) -> str:
    return "failed" if state.get("status") == "failed" else END


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------


def build_graph() -> StateGraph:
    graph = StateGraph(dict)

    graph.add_node("validate", node_validate)
    graph.add_node("audit", node_audit)
    graph.add_node("dispatch_modal", node_dispatch_modal)
    graph.add_node("failed", lambda s: s)

    graph.set_entry_point("validate")

    graph.add_conditional_edges(
        "validate", route_after_validate, {"audit": "audit", "failed": END}
    )
    graph.add_conditional_edges(
        "audit", route_after_audit, {"dispatch_modal": "dispatch_modal", "failed": END}
    )
    graph.add_conditional_edges(
        "dispatch_modal", route_after_dispatch, {END: END, "failed": END}
    )

    return graph


def _make_compiled_graph():  # type: ignore[return]
    return build_graph().compile()


async def run_pipeline(initial_state: dict, store: RedisStore) -> dict:
    """
    Execute the full BioSync pipeline for a given job.

    Args:
        initial_state: Initial job state dict (must include job_id, sequence_input)
        store: RedisStore instance for state persistence

    Returns:
        Final state dict after graph execution
    """
    job_id: str = initial_state["job_id"]
    bound_log = log.bind(job_id=job_id)

    state = {**initial_state, "_store": store, "status": "validating"}
    await store.update_status(job_id, "validating")

    await bound_log.ainfo("pipeline_start")
    try:
        graph = _make_compiled_graph()
        final_state = await graph.ainvoke(state)
        await store.update_status(job_id, final_state.get("status", "complete"))
    except Exception as exc:
        await bound_log.aerror("pipeline_error", error=str(exc), exc_info=True)
        await store.fail_job(job_id, str(exc))
        raise

    await bound_log.ainfo("pipeline_complete", status=final_state.get("status"))
    return final_state
