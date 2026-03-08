"""Unit tests for schema validation."""

from __future__ import annotations

import pytest

from app.validation.schemas import FASTASequence, JobCreateRequest, PDBStructure, RawSequence


class TestFASTASequence:
    def test_valid_fasta(self) -> None:
        fasta = FASTASequence(raw=">sp|P00533|EGFR_HUMAN\nMKTAYIAKQRQISFVK")
        assert fasta.header == "sp|P00533|EGFR_HUMAN"
        assert fasta.sequence == "MKTAYIAKQRQISFVK"

    def test_missing_header_raises(self) -> None:
        with pytest.raises(ValueError, match="header"):
            FASTASequence(raw="MKTAYIAKQRQISFVK")

    def test_invalid_characters_raises(self) -> None:
        with pytest.raises(ValueError, match="invalid characters"):
            FASTASequence(raw=">test\n123MKTAY!!!")

    def test_empty_sequence_raises(self) -> None:
        with pytest.raises(ValueError, match="no sequence data"):
            FASTASequence(raw=">header\n")


class TestPDBStructure:
    def test_valid_pdb(self) -> None:
        pdb_content = "ATOM      1  N   MET A   1       1.000   2.000   3.000\n"
        struct = PDBStructure(raw=pdb_content)
        assert struct.raw == pdb_content

    def test_missing_atom_record_raises(self) -> None:
        with pytest.raises(ValueError, match="ATOM or HETATM"):
            PDBStructure(raw="HEADER    SOME PROTEIN\nREMARK nothing useful\n")


class TestRawSequence:
    def test_valid_raw(self) -> None:
        seq = RawSequence(sequence="MKTAYIAKQRQISFVK")
        assert seq.sequence == "MKTAYIAKQRQISFVK"

    def test_lowercased_and_stripped(self) -> None:
        seq = RawSequence(sequence="  mktayiakqr  ")
        assert seq.sequence == "MKTAYIAKQR"

    def test_invalid_characters_raises(self) -> None:
        with pytest.raises(ValueError, match="invalid characters"):
            RawSequence(sequence="MKT123AY!!!")


class TestJobCreateRequest:
    def test_valid_request(self) -> None:
        req = JobCreateRequest(sequence="MKTAYIAKQRQISFVK", format="raw")
        assert req.format == "raw"

    def test_format_normalized_to_lowercase(self) -> None:
        req = JobCreateRequest(sequence="MKTAYIAKQRQISFVK", format="FASTA")
        assert req.format == "fasta"

    def test_invalid_format_raises(self) -> None:
        with pytest.raises(ValueError, match="format must be one of"):
            JobCreateRequest(sequence="MKTAY", format="xml")
