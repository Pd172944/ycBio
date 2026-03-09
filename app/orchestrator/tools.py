"""
Agent tool contracts for the BioSync orchestrator.
All tools are registered in the pipeline registry for workflow builder discovery.
"""

from __future__ import annotations

import asyncio
import uuid

import structlog

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
        call = await fn.spawn.aio(
            sequence=sequence,
            job_id=job_id,
            num_models="1",      # 1 model instead of 5 — 5x faster
            num_recycles=1,       # fewer refinement cycles
            use_msa=False,        # skip MSA — main bottleneck (~10min saved)
        )

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
    Extract key metrics from Tamarind AlphaFold output for MoE analysis.
    Only passes numerical scores and metadata to Claude — never PDB strings or large arrays.

    Tamarind output fields:
      best_plddt_mean, best_plddt_min, best_max_pae, best_ptm
      per_model_scores: [{rank, plddt_mean, plddt_min, plddt_max, max_pae, ptm}]
      model_type, num_models, num_recycles, sequence_length
    """
    # Fields to pass through directly (all are small scalars or short lists)
    scalar_keys = (
        "job_id", "tamarind_job_name", "sequence_length",
        "model_type", "num_models", "num_recycles",
        "best_plddt_mean", "best_plddt_min", "best_plddt_max",
        "best_max_pae", "best_ptm", "best_iptm",
        # mock / docking fields
        "confidence", "binding_affinity", "docking_score", "mock",
    )

    summary: dict = {k: raw_output[k] for k in scalar_keys if k in raw_output}

    # Per-model scores — already aggregated scalars, safe to include
    if "per_model_scores" in raw_output:
        summary["per_model_scores"] = raw_output["per_model_scores"]

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

