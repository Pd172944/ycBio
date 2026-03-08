# E2E Tests

End-to-end tests run against real external services and are intended for CI only.

## Prerequisites
- Real `ANTHROPIC_API_KEY` set
- Real `TAMARIND_API_KEY` set
- Modal deployed: `modal deploy app/workers/modal_runner.py`
- Redis running: `docker run -p 6379:6379 redis:7-alpine`

## Run
```bash
pytest tests/e2e/ -v --timeout=300
```

These tests are excluded from the standard `pytest tests/unit tests/integration` runs.
