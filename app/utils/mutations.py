"""
Utilities for parsing and applying point mutations to amino acid sequences.
"""

from __future__ import annotations

import re

_MUTATION_RE = re.compile(r"^([A-Za-z])(\d+)([A-Za-z])$")


def apply_mutation(sequence: str, mutation: str) -> str:
    """
    Apply a point mutation like 'V5A' to a sequence.

    V = expected amino acid (1-letter code), 5 = position (1-indexed), A = new amino acid.
    The check against the expected residue is case-insensitive.

    Raises:
        ValueError: if the mutation string is malformed, the position is out of range,
                    or the residue at that position does not match the expected amino acid.
    """
    match = _MUTATION_RE.match(mutation.strip())
    if not match:
        raise ValueError(
            f"Invalid mutation format {mutation!r}. Expected format like 'V5A' "
            "(original residue, 1-indexed position, new residue)."
        )

    original_aa = match.group(1).upper()
    position = int(match.group(2))
    new_aa = match.group(3).upper()

    if position < 1 or position > len(sequence):
        raise ValueError(
            f"Mutation {mutation!r}: position {position} is out of range for a "
            f"sequence of length {len(sequence)}."
        )

    idx = position - 1
    actual_aa = sequence[idx].upper()

    if actual_aa != original_aa:
        raise ValueError(
            f"Mutation {mutation!r}: expected residue {original_aa!r} at position "
            f"{position} but found {actual_aa!r}."
        )

    return sequence[:idx] + new_aa + sequence[idx + 1:]
