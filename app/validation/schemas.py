"""
Pydantic v2 schemas for parsing and validating FASTA and PDB inputs.
These are the API-layer I/O models consumed at the ingestion boundary.
"""

from __future__ import annotations

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Standard IUPAC amino acid codes (single-letter, including ambiguous)
_AA_PATTERN = re.compile(r"^[ACDEFGHIKLMNPQRSTVWYXBZJUO*-]+$", re.IGNORECASE)

# Minimal PDB ATOM/HETATM line check
_PDB_ATOM_LINE = re.compile(r"^(ATOM|HETATM)\s+", re.MULTILINE)


class FASTASequence(BaseModel):
    model_config = ConfigDict(frozen=True)

    raw: str = Field(..., description="Raw FASTA string including header")

    @field_validator("raw")
    @classmethod
    def must_have_header_and_sequence(cls, v: str) -> str:
        lines = v.strip().splitlines()
        if not lines or not lines[0].startswith(">"):
            raise ValueError("FASTA input must begin with a '>' header line")
        seq_lines = [ln.strip() for ln in lines[1:] if ln.strip()]
        if not seq_lines:
            raise ValueError("FASTA input has no sequence data")
        sequence = "".join(seq_lines)
        if not _AA_PATTERN.match(sequence):
            raise ValueError(f"FASTA sequence contains invalid characters: {sequence[:40]!r}")
        return v

    @property
    def header(self) -> str:
        return self.raw.strip().splitlines()[0][1:].strip()

    @property
    def sequence(self) -> str:
        lines = self.raw.strip().splitlines()[1:]
        return "".join(ln.strip() for ln in lines if ln.strip())


class PDBStructure(BaseModel):
    model_config = ConfigDict(frozen=True)

    raw: str = Field(..., description="Raw PDB file content")

    @field_validator("raw")
    @classmethod
    def must_contain_atom_records(cls, v: str) -> str:
        if not _PDB_ATOM_LINE.search(v):
            raise ValueError("PDB input must contain at least one ATOM or HETATM record")
        return v


class RawSequence(BaseModel):
    model_config = ConfigDict(frozen=True)

    sequence: str = Field(..., min_length=1)

    @field_validator("sequence")
    @classmethod
    def must_be_valid_amino_acids(cls, v: str) -> str:
        clean = v.strip().upper()
        if not _AA_PATTERN.match(clean):
            raise ValueError(f"Sequence contains invalid characters: {clean[:40]!r}")
        return clean


class JobCreateRequest(BaseModel):
    """API request body for POST /jobs."""

    model_config = ConfigDict(frozen=True)

    sequence: str = Field(..., min_length=1, description="Amino acid sequence or FASTA string")
    format: str = Field(default="raw", description="'fasta', 'pdb', or 'raw'")
    pipeline_id: str = Field(
        default="default",
        description="ID of the pipeline template to execute",
    )
    metadata: dict[str, str] = Field(default_factory=dict)

    @field_validator("format")
    @classmethod
    def validate_format(cls, v: str) -> str:
        allowed = {"fasta", "pdb", "raw"}
        if v.lower() not in allowed:
            raise ValueError(f"format must be one of {allowed}")
        return v.lower()
