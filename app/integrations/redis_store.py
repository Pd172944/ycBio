"""
Redis-backed job state store.
All Redis interactions must go through this module.
"""

from __future__ import annotations

import json
from typing import cast

import redis.asyncio as aioredis
import structlog

from app.orchestrator.state import (
    AuditResult,
    JobStatus,
    ModalJobHandle,
    MoEReport,
    SequenceInput,
    ValidationResult,
)
from app.settings import get_settings

log = structlog.get_logger()

_JOB_PREFIX = "biosync:job:"
_JOB_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 days


def _job_key(job_id: str) -> str:
    return f"{_JOB_PREFIX}{job_id}"


def _make_redis() -> aioredis.Redis:  # type: ignore[type-arg]
    settings = get_settings()
    return aioredis.from_url(settings.redis_url, decode_responses=True)


class RedisStore:
    """Async Redis store for job state persistence."""

    def __init__(self, redis: aioredis.Redis | None = None) -> None:  # type: ignore[type-arg]
        self._redis = redis or _make_redis()

    async def create_job(
        self,
        job_id: str,
        sequence_input: SequenceInput,
        pipeline_id: str = "default",
    ) -> None:
        """Create a new job in pending state."""
        state: dict[str, object] = {
            "job_id": job_id,
            "status": "pending",
            "pipeline_id": pipeline_id,
            "sequence_input": sequence_input.model_dump(),
            "validation_result": None,
            "audit_result": None,
            "modal_handle": None,
            "modal_output": None,
            "moe_report": None,
            "error": None,
        }
        await self._redis.setex(
            _job_key(job_id),
            _JOB_TTL_SECONDS,
            json.dumps(state),
        )
        await log.ainfo("job_created", job_id=job_id)

    async def get_job(self, job_id: str) -> dict | None:
        """Retrieve job state dict. Returns None if not found."""
        raw = await self._redis.get(_job_key(job_id))
        if raw is None:
            return None
        return cast(dict, json.loads(raw))

    async def update_job(self, job_id: str, updates: dict) -> None:
        """Merge updates into existing job state and refresh TTL."""
        state = await self.get_job(job_id)
        if state is None:
            raise KeyError(f"Job {job_id!r} not found in Redis")
        state.update(updates)
        await self._redis.setex(
            _job_key(job_id),
            _JOB_TTL_SECONDS,
            json.dumps(state),
        )

    async def update_status(self, job_id: str, status: JobStatus) -> None:
        """Convenience: update only the status field."""
        await self.update_job(job_id, {"status": status})
        await log.ainfo("job_status_updated", job_id=job_id, status=status)

    async def set_validation_result(self, job_id: str, result: ValidationResult) -> None:
        await self.update_job(job_id, {"validation_result": result.model_dump()})

    async def set_audit_result(self, job_id: str, result: AuditResult) -> None:
        await self.update_job(job_id, {"audit_result": result.model_dump()})

    async def set_modal_handle(self, job_id: str, handle: ModalJobHandle) -> None:
        await self.update_job(job_id, {"modal_handle": handle.model_dump()})

    async def set_modal_output(self, job_id: str, output: dict) -> None:
        await self.update_job(job_id, {"modal_output": output})

    async def set_moe_report(self, job_id: str, report: MoEReport) -> None:
        await self.update_job(job_id, {"moe_report": report.model_dump()})

    async def fail_job(self, job_id: str, error: str) -> None:
        await self.update_job(job_id, {"status": "failed", "error": error})
        await log.aerror("job_failed", job_id=job_id, error=error)

    async def get_recent_jobs(self, limit: int = 50) -> list[dict]:
        """
        Return recent job states for audit context.
        Scans Redis for biosync:job:* keys (suitable for small job counts).
        """
        cursor: int = 0
        keys: list[str] = []
        while True:
            cursor, batch = await self._redis.scan(
                cursor=cursor,
                match=f"{_JOB_PREFIX}*",
                count=100,
            )
            keys.extend(batch)
            if cursor == 0:
                break

        if not keys:
            return []

        raw_values = await self._redis.mget(*keys)
        jobs = []
        for raw in raw_values:
            if raw:
                try:
                    jobs.append(json.loads(raw))
                except json.JSONDecodeError:
                    pass

        # Sort by creation order is not tracked; return as-is up to limit
        return jobs[-limit:]

    async def close(self) -> None:
        await self._redis.aclose()
