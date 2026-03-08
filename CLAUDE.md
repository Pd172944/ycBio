# BioSync Orchestrator — Agent Guide

## Project Overview
Serverless agentic platform for automating Computational Biology pipelines.
Visual (Zapier-style) workflow builder → LangGraph orchestration → Modal GPU compute → MoE analysis.

## Key Rules
- Read `agent_docs/` before starting any non-trivial task
- Python 3.11+, strict typing, no `Any`
- `async def` everywhere
- All I/O boundaries use Pydantic v2 models
- LangGraph nodes must be pure functions
- All Redis access through `redis_store.py`
- Log with `structlog` bound to `job_id`
- Never commit secrets or `.env`

## Commands
```bash
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
docker run -p 6379:6379 redis:7-alpine
pytest tests/ -v
mypy app/
ruff check app/ tests/
ruff format app/ tests/
modal deploy app/workers/modal_runner.py
```

## Architecture Docs
- `agent_docs/architecture.md` — system design
- `agent_docs/modal_setup.md` — Modal configuration
- `agent_docs/tamarind_api.md` — Tamarind Bio API usage
- `agent_docs/moe_prompts.md` — MoE agent prompts
- `agent_docs/testing_guide.md` — testing patterns
- `agent_docs/code_conventions.md` — style rules
