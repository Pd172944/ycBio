"""
MoE Statistician Expert.
Analyzes numerical inference outputs for confidence metrics and statistical validity.
"""

from __future__ import annotations

import json

import structlog
from anthropic import AsyncAnthropic

from app.moe.utils import parse_json_response
from app.orchestrator.state import StatisticianOutput
from app.settings import get_settings

log = structlog.get_logger()

_SYSTEM_PROMPT = """\
You are a computational biology statistician. Given raw inference output from a protein
analysis pipeline, compute and report:
- Confidence score interpretation (pLDDT / PAE for structure predictions)
- Statistical significance of binding affinities
- Quality metrics and their acceptable ranges
- A numeric confidence_score (0.0–1.0) for the overall result

Return ONLY a JSON object matching this exact schema:
{
  "confidence_score": float (0.0–1.0),
  "metrics": { "metric_name": float },
  "interpretation": "string"
}
"""


async def run_statistician(raw_output: dict) -> StatisticianOutput:
    """
    Analyze raw inference output and return statistical confidence metrics.

    Args:
        raw_output: The raw dict from Modal/Tamarind inference

    Returns:
        StatisticianOutput with confidence score, metrics, and interpretation
    """
    settings = get_settings()
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    user_content = json.dumps(raw_output, indent=2)

    message = await client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"Analyze this inference output:\n{user_content}"}],
    )

    raw_text = message.content[0].text if message.content else "{}"

    try:
        parsed = parse_json_response(raw_text)
        return StatisticianOutput(**parsed)
    except (ValueError, KeyError) as exc:
        await log.awarning("statistician_parse_failed", error=str(exc))
        return StatisticianOutput(
            confidence_score=0.5,
            metrics={},
            interpretation=f"Parse error — raw response: {raw_text[:200]}",
        )
