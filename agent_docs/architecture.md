# BioSync Architecture

## System Overview

```
HTTP Request
     │
     ▼
FastAPI (app/main.py)
     │  POST /jobs  →  creates job_id, stores pending state
     │  GET  /jobs/{job_id}  →  reads from Redis
     │
     ▼
LangGraph Orchestrator (app/orchestrator/graph.py)
     │
     ├── [validate]   validate_schema()   →  ValidationResult
     ├── [audit]      audit_context()     →  AuditResult
     ├── [execute]    pipeline node map   →  per user graph
     ├── [dispatch]   trigger_modal_job() →  ModalJobHandle
     └── [analyze]    run_moe_analysis()  →  MoEReport
     │
     ▼
Redis (app/integrations/redis_store.py)
     │  job state persistence keyed by job_id
     │
     ▼
Modal (app/workers/modal_runner.py)
     │  GPU inference via Tamarind Bio API
     │  output → /outputs/{job_id}/raw_result.json in Modal Volume
     │
     ▼
MoE Analysis (app/moe/)
     │  asyncio.gather([statistician, critic, synthesizer])
     └──▶ MoEReport
```

## Pipeline Registry
Tools are registered in `app/integrations/pipeline_registry.py` and exposed as draggable
components in the workflow builder UI via `GET /pipelines/tools`.

## Job State Lifecycle
```
pending → validating → auditing → running → analyzing → complete
                                                        ↘ failed
```

## Key Design Decisions
- LangGraph nodes are **pure functions** — no side effects except via injected stores
- All external I/O (Redis, Modal, Tamarind) is wrapped in async clients
- MoE experts are fully independent and run via `asyncio.gather`
- `structlog` is bound per-request with `job_id` for correlation
