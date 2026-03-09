"""
LLM-based contextual auditor.
Checks experiment redundancy, anomalies, and conflicts using Claude + Redis job history.
"""

from __future__ import annotations

import json

import structlog
from anthropic import AsyncAnthropic

from app.orchestrator.state import AuditResult, SequenceInput
from app.settings import get_settings

log = structlog.get_logger()

_SYSTEM_PROMPT = """\
You are a computational biology experiment auditor. You will be given:
1. A new experiment request (sequence + metadata)
2. A history of recent experiments from the same lab

Your job is to determine whether the new request:
- Is redundant (essentially identical to a recent run). If so, identify the most relevant previous job ID from the history.
- Has anomalies (unusual sequence properties, suspicious metadata)
- Conflicts with any existing runs

Respond ONLY with a JSON object matching this exact schema:
{
  "approved": bool,
  "redundant": bool,
  "anomalies": [string],
  "conflicting_job_ids": [string],  // Include the ID of the redundant job here if redundant is true
  "notes": string
}
"""


async def audit_context(
    sequence_input: SequenceInput,
    history: list[dict],
    *,
    job_id: str,
) -> AuditResult:
    """
    Run LLM-based audit against recent job history.

    Args:
        sequence_input: The new experiment's sequence and metadata.
        history: List of recent job state dicts from Redis.
        job_id: Current job ID for logging correlation.

    Returns:
        AuditResult with approval decision and any detected issues.
    """
    bound_log = log.bind(job_id=job_id)
    settings = get_settings()

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    user_content = json.dumps(
        {
            "new_experiment": {
                "sequence": sequence_input.sequence[:200],  # truncate for prompt
                "format": sequence_input.format,
                "metadata": sequence_input.metadata,
            },
            "recent_history": history[-20:],  # last 20 jobs
        },
        indent=2,
    )

    await bound_log.ainfo("audit_start", history_count=len(history))

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )

    raw_text = message.content[0].text if message.content else "{}"

    from app.moe.utils import parse_json_response
    try:
        parsed = parse_json_response(raw_text)
        result = AuditResult(**parsed)
    except (json.JSONDecodeError, ValueError, KeyError) as exc:
        await bound_log.awarning("audit_parse_failed", error=str(exc), raw=raw_text[:200])
        # Fail open — approve but note the parsing failure
        result = AuditResult(
            approved=True,
            notes=f"Audit response parse failed: {exc}. Defaulting to approved.",
        )

    await bound_log.ainfo("audit_complete", approved=result.approved, redundant=result.redundant)
    return result
