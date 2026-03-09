"""
MoE Comparator Expert.
Produces a comparative analysis across mutation variants by integrating
multiple MoEReports and ranking them by structural impact.
"""

from __future__ import annotations

import json

import structlog
from anthropic import AsyncAnthropic

from app.moe.utils import parse_json_response
from app.orchestrator.state import ComparatorOutput, MoEReport
from app.settings import get_settings

log = structlog.get_logger()

_SYSTEM_PROMPT = """\
You are a computational structural biologist specialising in protein engineering.
You receive multiple AlphaFold MoE analysis reports — one for the wildtype sequence
and one for each point-mutant variant. Your job is to produce a rigorous comparative
analysis that helps researchers choose which mutation to pursue experimentally.

For each variant (non-wildtype), compare its overall_confidence and key findings
against the wildtype. Use the pLDDT-based confidence scores as a proxy for structural
quality (higher = better-predicted / likely more stable).

Rules:
- "stabilizing": variant confidence noticeably higher than wildtype (>0.03 delta)
- "destabilizing": variant confidence noticeably lower than wildtype (<-0.03 delta)
- "neutral": within ±0.03 of wildtype

Return ONLY a JSON object matching this exact schema (no markdown, no prose outside JSON):
{
  "summary": "string — 2-3 sentence plain-English overview",
  "rankings": [
    {
      "label": "string",
      "plddt_delta": number_or_null,
      "impact": "stabilizing" | "neutral" | "destabilizing",
      "notes": "string"
    }
  ],
  "recommendation": "string — which single variant to pursue and why",
  "caveats": ["string"]
}

rankings must be sorted from best (highest confidence delta vs wildtype) to worst.
Include the wildtype itself in rankings with plddt_delta = 0 and impact = "neutral".
"""


async def run_comparator(reports: dict[str, MoEReport]) -> ComparatorOutput:
    """
    Generate a comparative report across wildtype and mutant MoEReports.

    Args:
        reports: mapping of label → MoEReport, must include a "wildtype" key.

    Returns:
        ComparatorOutput with summary, rankings, recommendation, and caveats.
    """
    settings = get_settings()
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    serialised = {label: report.model_dump() for label, report in reports.items()}
    user_content = json.dumps(serialised, indent=2)

    bound_log = log.bind(component="comparator", variant_count=len(reports))
    await bound_log.ainfo("comparator_started")

    message = await client.messages.create(
        model="claude-opus-4-5",
        max_tokens=2048,
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    "Compare these mutation variants against the wildtype and produce "
                    f"a comparative structural impact report:\n{user_content}"
                ),
            }
        ],
    )

    raw_text = message.content[0].text if message.content else "{}"

    try:
        parsed = parse_json_response(raw_text)
        output = ComparatorOutput(**parsed)
        await bound_log.ainfo("comparator_complete")
        return output
    except (ValueError, KeyError) as exc:
        await bound_log.awarning("comparator_parse_failed", error=str(exc))
        labels = list(reports.keys())
        wildtype_conf = reports["wildtype"].overall_confidence if "wildtype" in reports else None
        fallback_rankings: list[dict] = []
        for label, report in reports.items():
            delta: float | None = (
                round(report.overall_confidence - wildtype_conf, 4)
                if wildtype_conf is not None and label != "wildtype"
                else (0.0 if label == "wildtype" else None)
            )
            fallback_rankings.append(
                {
                    "label": label,
                    "plddt_delta": delta,
                    "impact": "neutral",
                    "notes": "Automated comparison unavailable; review raw reports.",
                }
            )
        return ComparatorOutput(
            summary="Comparative analysis parsing failed. Review individual variant reports.",
            rankings=fallback_rankings,
            recommendation=f"Unable to determine automatically from {len(labels)} variants.",
            caveats=[f"Report generation failed: {exc}"],
        )
