"""
MoE Critic Expert.
Detects anomalies, outliers, and potential issues with inference results.
"""

from __future__ import annotations

import json

import structlog
from anthropic import AsyncAnthropic

from app.moe.utils import parse_json_response
from app.orchestrator.state import CriticOutput
from app.settings import get_settings

log = structlog.get_logger()

_SYSTEM_PROMPT = """\
You are a critical reviewer for computational biology experiments. Given raw inference
output, identify:
- Outliers or physically unreasonable values
- Potential failure modes (low pLDDT, clashing residues, convergence failures, etc.)
- Whether results warrant re-running the experiment
- A list of specific concerns ranked by severity

Return ONLY a JSON object matching this exact schema:
{
  "has_concerns": bool,
  "concerns": ["string"],
  "recommend_rerun": bool,
  "severity": "low" | "medium" | "high"
}
"""


async def run_critic(raw_output: dict) -> CriticOutput:
    """
    Review raw inference output for anomalies and failure modes.

    Args:
        raw_output: The raw dict from Modal/Tamarind inference

    Returns:
        CriticOutput with concern flags and severity assessment
    """
    settings = get_settings()
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    user_content = json.dumps(raw_output, indent=2)

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"Review this inference output:\n{user_content}"}],
    )

    raw_text = message.content[0].text if message.content else "{}"

    try:
        parsed = parse_json_response(raw_text)
        return CriticOutput(**parsed)
    except (ValueError, KeyError) as exc:
        await log.awarning("critic_parse_failed", error=str(exc))
        return CriticOutput(
            has_concerns=True,
            concerns=[f"Parse error — could not evaluate results: {exc}"],
            recommend_rerun=False,
            severity="low",
        )
