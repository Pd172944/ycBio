"""Unit tests for orchestrator tools (external deps mocked)."""

from __future__ import annotations

import pytest

from app.orchestrator.tools import validate_schema


class TestValidateSchema:
    @pytest.mark.asyncio
    async def test_valid_raw_sequence(self) -> None:
        result = await validate_schema({"sequence": "MKTAYIAKQRQISFVK", "format": "raw"})
        assert result.valid is True
        assert result.length == 16
        assert result.errors == []

    @pytest.mark.asyncio
    async def test_valid_fasta(self) -> None:
        fasta = ">sp|P00533\nMKTAYIAKQRQISFVK"
        result = await validate_schema({"sequence": fasta, "format": "fasta"})
        assert result.valid is True
        assert result.length == 16

    @pytest.mark.asyncio
    async def test_invalid_raw_sequence(self) -> None:
        result = await validate_schema({"sequence": "MKT123!!!", "format": "raw"})
        assert result.valid is False
        assert len(result.errors) > 0

    @pytest.mark.asyncio
    async def test_short_sequence_warns(self) -> None:
        result = await validate_schema({"sequence": "MKTAY", "format": "raw"})
        assert result.valid is True
        assert any("short" in w for w in result.warnings)
