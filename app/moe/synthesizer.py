"""
MoE Synthesizer Expert.
Produces a human-readable report for wet-lab researchers by integrating
statistician and critic outputs with the raw inference data.
"""

from __future__ import annotations

import json

import structlog
from anthropic import AsyncAnthropic

from app.moe.utils import parse_json_response
from app.orchestrator.state import CriticOutput, StatisticianOutput, SynthesizerOutput
from app.settings import get_settings

log = structlog.get_logger()

_SYSTEM_PROMPT = """\
You are a scientific writer specializing in computational biology. Given raw inference
output plus statistician and critic analyses, produce a clear, concise report for a
wet-lab researcher. Write:
- A concise executive summary (2–3 sentences)
- Key findings with plain-language explanations
- Recommended next steps
- Any caveats or limitations

Return ONLY a JSON object matching this exact schema:
{
  "executive_summary": "string",
  "key_findings": ["string"],
  "next_steps": ["string"],
  "caveats": ["string"]
}
"""


async def run_synthesizer(
    raw_output: dict,
    statistician: StatisticianOutput,
    critic: CriticOutput,
) -> SynthesizerOutput:
    """
    Integrate statistician + critic analyses into a human-readable report.

    Args:
        raw_output: The raw inference output dict
        statistician: StatisticianOutput from the statistician expert
        critic: CriticOutput from the critic expert

    Returns:
        SynthesizerOutput with executive summary, findings, next steps, caveats
    """
    settings = get_settings()
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    combined = {
        "raw_inference_output": raw_output,
        "statistician_analysis": statistician.model_dump(),
        "critic_review": critic.model_dump(),
    }
    user_content = json.dumps(combined, indent=2)

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Synthesize this analysis into a researcher report:\n{user_content}",
            }
        ],
    )

    raw_text = message.content[0].text if message.content else "{}"

    try:
        parsed = parse_json_response(raw_text)
        return SynthesizerOutput(**parsed)
    except (ValueError, KeyError) as exc:
        await log.awarning("synthesizer_parse_failed", error=str(exc))
        return SynthesizerOutput(
            executive_summary="Analysis complete. See raw outputs for details.",
            key_findings=[],
            next_steps=["Review raw inference output manually"],
            caveats=[f"Report synthesis failed: {exc}"],
        )
