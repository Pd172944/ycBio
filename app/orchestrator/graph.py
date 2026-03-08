"""
LangGraph state machine for BioSync pipeline orchestration.

Node execution order:
  validate → audit → run_pipeline → dispatch_modal → await_modal → analyze_moe → complete

Each node is a pure async function: (state) -> dict (partial state update).
"""

from __future__ import annotations

import structlog
from langgraph.graph import END, StateGraph

from app.integrations.redis_store import RedisStore
from app.orchestrator.state import SequenceInput
from app.orchestrator.tools import (
    audit_context,
    await_modal_output,
    run_moe_analysis,
    trigger_modal_job,
    validate_schema,
)

log = structlog.get_logger()


# ---------------------------------------------------------------------------
# Node functions (pure: take state dict, return partial update dict)
# ---------------------------------------------------------------------------


async def node_validate(state: dict) -> dict:
    """Validate the sequence input against schema rules."""
    job_id: str = state["job_id"]
    seq: SequenceInput = state["sequence_input"]
    bound_log = log.bind(job_id=job_id)

    await bound_log.ainfo("node_validate_start")

    result = await validate_schema(
        {"sequence": seq.sequence, "format": seq.format}
    )

    if not result.valid:
        await bound_log.aerror("validation_failed", errors=result.errors)
        return {"status": "failed", "error": f"Validation failed: {result.errors}"}

    await bound_log.ainfo("node_validate_complete", length=result.length)
    return {"status": "auditing", "validation_result": result}


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
            "status": "failed",
            "audit_result": audit_result,
            "error": f"Audit rejected: {audit_result.notes}",
        }

    await bound_log.ainfo("node_audit_complete", approved=audit_result.approved)
    return {"status": "running", "audit_result": audit_result}


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
    return {"modal_handle": handle}


async def node_await_modal(state: dict) -> dict:
    """Poll Modal for inference completion and retrieve output."""
    job_id: str = state["job_id"]
    handle = state["modal_handle"]
    store: RedisStore = state["_store"]
    bound_log = log.bind(job_id=job_id)

    await bound_log.ainfo("node_await_modal_start")
    output = await await_modal_output(handle, store, job_id)

    await bound_log.ainfo("node_await_modal_complete")
    return {"status": "analyzing", "modal_output": output}


async def node_moe_analysis(state: dict) -> dict:
    """Run parallel MoE expert analysis on inference output."""
    job_id: str = state["job_id"]
    raw_output: dict = state["modal_output"] or {}
    store: RedisStore = state["_store"]
    bound_log = log.bind(job_id=job_id)

    await bound_log.ainfo("node_moe_start")
    raw_output["job_id"] = job_id  # inject for logging in sub-experts

    report = await run_moe_analysis(raw_output)
    await store.set_moe_report(job_id, report)

    await bound_log.ainfo("node_moe_complete", confidence=report.overall_confidence)
    return {"status": "complete", "moe_report": report}


# ---------------------------------------------------------------------------
# Routing logic
# ---------------------------------------------------------------------------


def route_after_validate(state: dict) -> str:
    if state.get("status") == "failed":
        return "failed"
    return "audit"


def route_after_audit(state: dict) -> str:
    if state.get("status") == "failed":
        return "failed"
    return "dispatch_modal"


def route_after_dispatch(state: dict) -> str:
    if state.get("status") == "failed":
        return "failed"
    return "await_modal"


def route_after_await(state: dict) -> str:
    if state.get("status") == "failed":
        return "failed"
    return "moe_analysis"


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------


def build_graph() -> StateGraph:
    """Build and compile the BioSync LangGraph state machine."""

    graph = StateGraph(dict)

    graph.add_node("validate", node_validate)
    graph.add_node("audit", node_audit)
    graph.add_node("dispatch_modal", node_dispatch_modal)
    graph.add_node("await_modal", node_await_modal)
    graph.add_node("moe_analysis", node_moe_analysis)
    graph.add_node("failed", lambda s: s)  # terminal failure node

    graph.set_entry_point("validate")

    graph.add_conditional_edges("validate", route_after_validate, {"audit": "audit", "failed": END})
    graph.add_conditional_edges(
        "audit", route_after_audit, {"dispatch_modal": "dispatch_modal", "failed": END}
    )
    graph.add_conditional_edges(
        "dispatch_modal",
        route_after_dispatch,
        {"await_modal": "await_modal", "failed": END},
    )
    graph.add_conditional_edges(
        "await_modal",
        route_after_await,
        {"moe_analysis": "moe_analysis", "failed": END},
    )
    graph.add_edge("moe_analysis", END)

    return graph


# Compiled graph singleton (used by the API)
compiled_graph = build_graph().compile()


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

    # Inject store as private key (not persisted to Redis)
    state = {**initial_state, "_store": store, "status": "validating"}
    await store.update_status(job_id, "validating")

    await bound_log.ainfo("pipeline_start")
    try:
        final_state = await compiled_graph.ainvoke(state)
        await store.update_status(job_id, final_state.get("status", "complete"))
    except Exception as exc:
        await bound_log.aerror("pipeline_error", error=str(exc), exc_info=True)
        await store.fail_job(job_id, str(exc))
        raise

    await bound_log.ainfo("pipeline_complete", status=final_state.get("status"))
    return final_state
