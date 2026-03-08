"""Integration tests for RedisStore using fakeredis."""

from __future__ import annotations

import pytest
import fakeredis.aioredis

from app.integrations.redis_store import RedisStore
from app.orchestrator.state import (
    AuditResult,
    ModalJobHandle,
    MoEReport,
    SequenceInput,
    StatisticianOutput,
    CriticOutput,
    SynthesizerOutput,
    ValidationResult,
)


@pytest.fixture
async def store() -> RedisStore:
    fake_redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
    return RedisStore(redis=fake_redis)


@pytest.fixture
def seq_input() -> SequenceInput:
    return SequenceInput(sequence="MKTAYIAKQRQISFVK", format="raw")


class TestRedisStore:
    @pytest.mark.asyncio
    async def test_create_and_get_job(self, store: RedisStore, seq_input: SequenceInput) -> None:
        await store.create_job("job-001", seq_input)
        state = await store.get_job("job-001")
        assert state is not None
        assert state["job_id"] == "job-001"
        assert state["status"] == "pending"

    @pytest.mark.asyncio
    async def test_get_nonexistent_job_returns_none(self, store: RedisStore) -> None:
        result = await store.get_job("does-not-exist")
        assert result is None

    @pytest.mark.asyncio
    async def test_update_status(self, store: RedisStore, seq_input: SequenceInput) -> None:
        await store.create_job("job-002", seq_input)
        await store.update_status("job-002", "validating")
        state = await store.get_job("job-002")
        assert state is not None
        assert state["status"] == "validating"

    @pytest.mark.asyncio
    async def test_set_validation_result(
        self, store: RedisStore, seq_input: SequenceInput
    ) -> None:
        await store.create_job("job-003", seq_input)
        result = ValidationResult(valid=True, length=16)
        await store.set_validation_result("job-003", result)
        state = await store.get_job("job-003")
        assert state is not None
        assert state["validation_result"]["valid"] is True

    @pytest.mark.asyncio
    async def test_fail_job(self, store: RedisStore, seq_input: SequenceInput) -> None:
        await store.create_job("job-004", seq_input)
        await store.fail_job("job-004", "Something went wrong")
        state = await store.get_job("job-004")
        assert state is not None
        assert state["status"] == "failed"
        assert state["error"] == "Something went wrong"

    @pytest.mark.asyncio
    async def test_get_recent_jobs(self, store: RedisStore, seq_input: SequenceInput) -> None:
        for i in range(3):
            await store.create_job(f"job-bulk-{i}", seq_input)
        jobs = await store.get_recent_jobs(limit=10)
        assert len(jobs) == 3
