# Testing Guide

## Test Layout
```
tests/
├── unit/           # pure logic, fully mocked external deps
├── integration/    # local Redis, Modal stub
└── e2e/            # full pipeline against real services (CI only)
```

## Running Tests
```bash
pytest tests/ -v          # all tests
pytest tests/unit/ -v     # unit only
pytest tests/integration/ # integration only
mypy app/                 # type check
```

## Mocking Patterns

### Redis
Use `fakeredis.aioredis.FakeRedis` as drop-in replacement:
```python
import fakeredis.aioredis
fake_redis = fakeredis.aioredis.FakeRedis()
```

### Modal
Mock `modal.Function.lookup` and `.remote.aio`:
```python
mock_fn = AsyncMock(return_value={"pdb": "...", "confidence": 0.9})
monkeypatch.setattr("app.workers.modal_runner.run_inference", mock_fn)
```

### Tamarind API
Use `respx` to mock HTTP calls:
```python
import respx, httpx
with respx.mock:
    respx.post("https://app.tamarind.bio/api/submit-job").mock(
        return_value=httpx.Response(200, json={"jobId": "abc-123", "status": "submitted"})
    )
```

### Anthropic (Claude)
Mock the `AsyncAnthropic` client:
```python
mock_client = AsyncMock()
mock_client.messages.create.return_value = mock_message(content="...")
```

## Required for Merge
```
pytest tests/ -v   # must pass
mypy app/          # must pass
```
