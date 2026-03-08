"""
Agent tool contracts for the BioSync orchestrator.
All tools are registered in the pipeline registry for workflow builder discovery.
"""

from __future__ import annotations

import asyncio
import uuid

import structlog

from app.integrations.redis_store import RedisStore
from app.moe.critic import run_critic
from app.moe.statistician import run_statistician
from app.moe.synthesizer import run_synthesizer
from app.orchestrator.state import (
    AuditResult,
    MoEReport,
    ModalJobHandle,
    SequenceInput,
    ValidationResult,
)
from app.validation.auditor import audit_context as _llm_audit
from app.validation.schemas import FASTASequence, PDBStructure, RawSequence

log = structlog.get_logger()


# ---------------------------------------------------------------------------
# Tool 1: Schema Validation
# ---------------------------------------------------------------------------


async def validate_schema(input: dict) -> ValidationResult:  # noqa: A002
    """
    Parse FASTA/PDB headers and sequences against the Pydantic schema.

    Args:
        input: dict with keys 'sequence' (str), 'format' (str)

    Returns:
        ValidationResult
    """
    sequence: str = input.get("sequence", "")
    fmt: str = input.get("format", "raw")

    warnings: list[str] = []
    errors: list[str] = []
    length = 0

    try:
        if fmt == "fasta":
            parsed = FASTASequence(raw=sequence)
            seq = parsed.sequence
            length = len(seq)
            if length < 10:
                warnings.append("Sequence is unusually short (< 10 aa)")
        elif fmt == "pdb":
            PDBStructure(raw=sequence)
            length = sequence.count("ATOM")
        else:
            parsed_raw = RawSequence(sequence=sequence)
            seq = parsed_raw.sequence
            length = len(seq)
            if length < 10:
                warnings.append("Sequence is unusually short (< 10 aa)")

        return ValidationResult(valid=True, length=length, warnings=warnings, errors=errors)

    except ValueError as exc:
        errors.append(str(exc))
        return ValidationResult(valid=False, length=0, warnings=warnings, errors=errors)


# ---------------------------------------------------------------------------
# Tool 2: Agentic Audit
# ---------------------------------------------------------------------------


async def audit_context(input: dict, history: list[dict]) -> AuditResult:  # noqa: A002
    """
    LLM-based contextual validation using Claude + Redis job history.

    Args:
        input: dict with 'sequence', 'format', 'metadata'
        history: list of recent job state dicts

    Returns:
        AuditResult
    """
    seq_input = SequenceInput(
        sequence=input.get("sequence", ""),
        format=input.get("format", "raw"),  # type: ignore[arg-type]
        metadata=input.get("metadata", {}),
    )
    job_id = input.get("job_id", str(uuid.uuid4()))

    return await _llm_audit(seq_input, history, job_id=job_id)


# ---------------------------------------------------------------------------
# Tool 3: Modal Dispatch
# ---------------------------------------------------------------------------


async def trigger_modal_job(job_id: str, sequence: str) -> ModalJobHandle:
    """
    Dispatch a GPU inference job via Modal + Tamarind Bio API.

    Args:
        job_id: Current job UUID
        sequence: Amino acid sequence

    Returns:
        ModalJobHandle with call_id and volume path
    """
    from app.settings import get_settings

    bound_log = log.bind(job_id=job_id)
    await bound_log.ainfo("modal_dispatch", sequence_len=len(sequence))

    settings = get_settings()
    if getattr(settings, "mock_modal", False):
        await bound_log.awarning("modal_mock_mode", job_id=job_id)
        return ModalJobHandle(
            modal_call_id=f"mock-{job_id}",
            volume_path=f"/outputs/{job_id}/raw_result.json",
            status="submitted",
        )

    try:
        import modal  # type: ignore[import-untyped]

        fn = modal.Function.from_name("biosync-orchestrator", "run_inference")
        call = await fn.spawn.aio(sequence=sequence, job_id=job_id)

        handle = ModalJobHandle(
            modal_call_id=call.object_id,
            volume_path=f"/outputs/{job_id}/raw_result.json",
            status="submitted",
        )
    except Exception as exc:
        await bound_log.aerror("modal_dispatch_failed", error=str(exc))
        raise

    await bound_log.ainfo("modal_dispatched", call_id=handle.modal_call_id)
    return handle


# ---------------------------------------------------------------------------
# Tool 4: MoE Analysis
# ---------------------------------------------------------------------------


def _summarize_for_moe(raw_output: dict) -> dict:
    """
    Extract key metrics from raw Tamarind output for MoE analysis.
    Strips large fields (PDB strings, MSA data) that would exceed Claude's context.
    """
    summary: dict = {}

    # Always keep metadata
    for key in ("job_id", "tamarind_job_name", "sequence_length", "mock"):
        if key in raw_output:
            summary[key] = raw_output[key]

    # Confidence / pLDDT scores
    for key in ("confidence", "plddt_scores", "plddt_mean", "pae", "ptm", "iptm"):
        if key in raw_output:
            val = raw_output[key]
            # Truncate large score arrays to first 100 values
            if isinstance(val, list) and len(val) > 100:
                summary[key] = val[:100]
                summary[f"{key}_truncated"] = True
            else:
                summary[key] = val

    # Binding affinity / docking scores
    for key in ("binding_affinity", "docking_score", "rmsd"):
        if key in raw_output:
            summary[key] = raw_output[key]

    # Job status / error info
    for key in ("status", "error", "warnings", "jobId"):
        if key in raw_output:
            summary[key] = raw_output[key]

    # Truncate any remaining string fields (e.g. PDB) to avoid token overflow
    for key, val in raw_output.items():
        if key not in summary:
            if isinstance(val, str) and len(val) > 500:
                summary[key] = val[:500] + "... [truncated]"
            elif not isinstance(val, (dict, list)):
                summary[key] = val

    return summary


async def run_moe_analysis(raw_output: dict) -> MoEReport:
    """
    Run three expert agents in parallel (statistician, critic, synthesizer).

    Args:
        raw_output: The raw inference output dict from Modal/Tamarind

    Returns:
        MoEReport with all three expert analyses aggregated
    """
    job_id = raw_output.get("job_id", "unknown")
    bound_log = log.bind(job_id=job_id)
    await bound_log.ainfo("moe_start")

    summarized = _summarize_for_moe(raw_output)
    await bound_log.ainfo("moe_summary_keys", keys=list(summarized.keys()))

    statistician_result, critic_result = await asyncio.gather(
        run_statistician(summarized),
        run_critic(summarized),
    )

    synthesizer_result = await run_synthesizer(
        raw_output=summarized,
        statistician=statistician_result,
        critic=critic_result,
    )

    report = MoEReport(
        statistician=statistician_result,
        critic=critic_result,
        synthesizer=synthesizer_result,
        overall_confidence=statistician_result.confidence_score,
    )

    await bound_log.ainfo(
        "moe_complete",
        confidence=report.overall_confidence,
        has_concerns=critic_result.has_concerns,
    )
    return report


# ---------------------------------------------------------------------------
# Convenience: poll Modal job and fetch output
# ---------------------------------------------------------------------------


async def await_modal_output(handle: ModalJobHandle, store: RedisStore, job_id: str) -> dict:
    """
    Poll Modal for the completed inference result and return the raw output dict.
    Writes the output to Redis via the store.
    """
    from app.settings import get_settings

    bound_log = log.bind(job_id=job_id)
    settings = get_settings()

    if getattr(settings, "mock_modal", False) or handle.modal_call_id.startswith("mock-"):
        await bound_log.awarning("modal_mock_output", job_id=job_id)
        result = {
            "job_id": job_id,
            "sequence_length": 16,
            "pdb_string": "MOCK_PDB_DATA",
            "confidence": 0.87,
            "plddt_scores": [0.85, 0.88, 0.91, 0.87, 0.83],
            "mock": True,
        }
        await store.set_modal_output(job_id, result)
        return result

    try:
        import modal  # type: ignore[import-untyped]

        fc = modal.FunctionCall.from_id(handle.modal_call_id)
        result = await fc.get.aio(timeout=600)
    except Exception as exc:
        await bound_log.aerror("modal_poll_failed", error=str(exc))
        raise

    await store.set_modal_output(job_id, result)
    await bound_log.ainfo("modal_output_received")
    return result
