"""
Job state definitions for the BioSync orchestrator.
All types are used as the canonical state shape in Redis and LangGraph.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SequenceInput(BaseModel):
    model_config = ConfigDict(frozen=True)

    sequence: str = Field(..., min_length=1, description="Amino acid or nucleotide sequence")
    format: Literal["fasta", "pdb", "raw"] = Field(
        default="raw", description="Input format identifier"
    )
    header: str | None = Field(default=None, description="FASTA header or PDB metadata")
    metadata: dict[str, str] = Field(default_factory=dict)


class ValidationResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    valid: bool
    length: int
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class AuditResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    approved: bool
    redundant: bool = False
    anomalies: list[str] = Field(default_factory=list)
    conflicting_job_ids: list[str] = Field(default_factory=list)
    notes: str = ""


class StatisticianOutput(BaseModel):
    model_config = ConfigDict(frozen=True)

    confidence_score: float = Field(..., ge=0.0, le=1.0)
    metrics: dict[str, float | None] = Field(default_factory=dict)
    interpretation: str


class CriticOutput(BaseModel):
    model_config = ConfigDict(frozen=True)

    has_concerns: bool
    concerns: list[str] = Field(default_factory=list)
    recommend_rerun: bool = False
    severity: Literal["low", "medium", "high"] = "low"


class SynthesizerOutput(BaseModel):
    model_config = ConfigDict(frozen=True)

    executive_summary: str
    key_findings: list[str] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)
    caveats: list[str] = Field(default_factory=list)


class MoEReport(BaseModel):
    model_config = ConfigDict(frozen=True)

    statistician: StatisticianOutput
    critic: CriticOutput
    synthesizer: SynthesizerOutput
    overall_confidence: float = Field(..., ge=0.0, le=1.0)


class ModalJobHandle(BaseModel):
    model_config = ConfigDict(frozen=True)

    modal_call_id: str
    volume_path: str
    status: Literal["submitted", "running", "complete", "failed"] = "submitted"


# Canonical LangGraph / Redis job state
JobStatus = Literal[
    "pending",
    "validating",
    "auditing",
    "running",
    "analyzing",
    "complete",
    "failed",
]


class ComparatorOutput(BaseModel):
    model_config = ConfigDict(frozen=True)

    summary: str
    rankings: list[dict] = Field(default_factory=list)
    recommendation: str
    caveats: list[str] = Field(default_factory=list)


class MutationVariant(BaseModel):
    label: str
    sequence: str
    job_id: str | None = None
    status: str = "pending"
    moe_report: MoEReport | None = None


class BatchState(BaseModel):
    batch_id: str
    wildtype_sequence: str
    variants: list[MutationVariant]
    status: Literal["pending", "running", "complete", "failed"] = "pending"
    comparator_report: dict | None = None
    created_at: str


class JobState(dict):  # TypedDict-compatible for LangGraph
    """
    Mutable job state persisted in Redis and threaded through LangGraph nodes.
    Using a plain TypedDict-style dict so LangGraph can merge partial updates.
    """

    job_id: str
    status: JobStatus
    sequence_input: SequenceInput
    validation_result: ValidationResult | None
    audit_result: AuditResult | None
    modal_handle: ModalJobHandle | None
    modal_output: dict | None
    moe_report: MoEReport | None
    error: str | None
