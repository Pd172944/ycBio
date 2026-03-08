"""Shared utilities for MoE agents."""

from __future__ import annotations

import json
import re


def extract_json(text: str) -> str:
    """
    Strip markdown code fences from Claude's response and return raw JSON.
    Handles ```json ... ``` and ``` ... ``` wrappers.
    """
    # Try to find a fenced code block first
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        return match.group(1)
    # Fall back to finding the first {...} block
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return match.group(0)
    return text


def parse_json_response(text: str) -> dict:
    """Parse Claude's response as JSON, stripping any markdown fencing."""
    return json.loads(extract_json(text))
