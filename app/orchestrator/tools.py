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
    bound_log = log.bind(job_id=job_id)
    await bound_log.ainfo("modal_dispatch", sequence_len=len(sequence))

    try:
        import modal  # type: ignore[import-untyped]

        fn = modal.Function.lookup("biosync-orchestrator", "run_inference")
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

    statistician_result, critic_result = await asyncio.gather(
        run_statistician(raw_output),
        run_critic(raw_output),
    )

    synthesizer_result = await run_synthesizer(
        raw_output=raw_output,
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
    bound_log = log.bind(job_id=job_id)

    try:
        import modal  # type: ignore[import-untyped]

        fc = modal.FunctionCall.from_id(handle.modal_call_id)
        result: dict = await fc.get.aio(timeout=600)
    except Exception as exc:
        await bound_log.aerror("modal_poll_failed", error=str(exc))
        raise

    await store.set_modal_output(job_id, result)
    await bound_log.ainfo("modal_output_received")
    return result
