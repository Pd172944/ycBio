
# BioSync Orchestrator

Serverless agentic platform for automating Computational Biology (CompOps) pipelines. BioSync allows researchers to visually compose computational biology workflows and execute them through a scalable orchestration engine.

Users design pipelines using a **visual workflow builder (Zapier-style)** where different analysis tools and models can be connected together. BioSync then handles validation, compute orchestration, and analysis automatically.

The system ingests experimental requests, performs multi-stage validation (Rules-based + Agentic), manages cloud compute via Modal, and synthesizes results using a Mixture-of-Experts (MoE) analysis pattern.

---

# Tech Stack

**Runtime:** Python 3.11+

**Agent Framework:** LangGraph (state-machine orchestration)

**API Layer:** FastAPI (REST + Webhooks)

**State Store:** Redis (job state persistence)

**Compute:** Modal (serverless GPU/CPU workers)

**Model Provider:** Tamarind Bio API (structural biology / protein design)

**Validation:** Pydantic v2

**Workflow UI:** Visual pipeline builder (Zapier-style node editor)

**Notifications:** UI status dashboard + result reports

---

# Project Structure

```
biosync-orchestrator/
├── CLAUDE.md
├── pyproject.toml
├── .env.example
├── agent_docs/
│   ├── architecture.md
│   ├── modal_setup.md
│   ├── tamarind_api.md
│   ├── moe_prompts.md
│   ├── testing_guide.md
│   └── code_conventions.md
├── app/
│   ├── main.py
│   ├── orchestrator/
│   │   ├── graph.py
│   │   ├── state.py
│   │   └── tools.py
│   ├── validation/
│   │   ├── schemas.py
│   │   └── auditor.py
│   ├── workers/
│   │   └── modal_runner.py
│   ├── moe/
│   │   ├── statistician.py
│   │   ├── critic.py
│   │   └── synthesizer.py
│   └── integrations/
│       ├── redis_store.py
│       └── pipeline_registry.py
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

Before starting any non-trivial task, read the relevant files in `agent_docs/`.

---

# Commands

```bash
pip install -e ".[dev]"

uvicorn app.main:app --reload --port 8000

docker run -p 6379:6379 redis:7-alpine

pytest tests/ -v

pytest tests/unit/ -v

mypy app/

ruff check app/ tests/

ruff format app/ tests/

modal deploy app/workers/modal_runner.py

modal run app/workers/modal_runner.py::run_inference --sequence "MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKRQTLGQHDFSAGEGLYTHMKALRPDEDRLSPLHSVYVDQWDWERVMGDGERQFSTLKSTVEAIWAGIKATEAAVSEEFGLAPFLPDQIHFVHSQELLSRYPDLDAKGRERAIAKDLGAVFLVGIGGKLSDGHRHDVRAPDYDDWSTPSELGHAGLNGDILVWNPSVNMRFSHFNHDVITQQHTEKPLIINGEGLQR"
```

---

# Workflow Logic (Pipeline Execution)

Users construct pipelines visually using a node-based interface where each node corresponds to a tool or analysis stage.

When a pipeline is executed, the orchestrator converts the graph into a LangGraph state machine and executes it asynchronously.

### 1. Ingestion & Rules Validation

```
validate_schema(input)
```

Parse FASTA/PDB headers and sequences against the Pydantic schema.

---

### 2. Agentic Audit

```
audit_context(input, history)
```

LLM-based contextual validation that checks experiment redundancy, anomalies, or conflicting runs using Redis job history.

---

### 3. Pipeline Execution

The orchestrator resolves the user-designed workflow graph and executes each node.

Example nodes:

- Structure Prediction
- Docking Simulation
- Sequence Validation
- Structural Analysis
- MoE Reporting

Each node maps to a tool function in `tools.py`.

---

### 4. Modal Dispatch

```
trigger_modal_job(job_id, sequence)
```

Runs heavy compute tasks through Modal workers and the Tamarind Bio API.

Outputs are written to Modal Volumes.

---

### 5. MoE Analysis

```
run_moe_analysis(raw_output)
```

Runs three expert agents in parallel:

- Statistician (confidence metrics)
- Critic (outlier detection)
- Synthesizer (human-readable report)

Results are aggregated into a final structured report.

---

# Agent Tool Contracts

All tools are defined in `app/orchestrator/tools.py`.

```
def validate_schema(input: dict) -> ValidationResult: ...
def audit_context(input: dict, history: list[dict]) -> AuditResult: ...
def trigger_modal_job(job_id: str, sequence: str) -> ModalJobHandle: ...
def run_moe_analysis(raw_output: dict) -> MoEReport: ...
```

Tools are automatically registered in the **pipeline registry** so they appear as draggable components in the workflow builder UI.

---

# State Management

Jobs are tracked by `job_id` (UUID4) in Redis.

Canonical state shape:

```
class JobState(TypedDict):
    job_id: str
    status: Literal[
        "pending",
        "validating",
        "auditing",
        "running",
        "analyzing",
        "complete",
        "failed"
    ]
    sequence_input: SequenceInput
    audit_result: AuditResult | None
    modal_output: dict | None
    moe_report: MoEReport | None
    error: str | None
```

All Redis operations must go through `redis_store.py`.

---

# Code Conventions

- Python type hints required on all function signatures
- No `Any` types
- Pydantic v2 models for all I/O boundaries
- LangGraph nodes must be pure functions
- Async everywhere (`async def`)
- `structlog` logging with `job_id`
- All secrets stored via environment variables

---

# Testing

Unit tests mock:

- Modal
- Tamarind Bio API
- Redis

Integration tests use:

- local Redis
- Modal stub runtime

```
pytest tests/ -v
mypy app/
```

must pass before merge.

---

# Important Notes

Never commit `.env` files or API keys.

Modal Volume output format:

```
/outputs/{job_id}/raw_result.json
```

MoE agents run in parallel using `asyncio.gather`.

Tamarind API rate limits apply per key.

---

# Concept

BioSync is designed to function as a **Zapier-like automation platform for computational biology pipelines**.

Instead of manually orchestrating model runs, researchers can visually compose pipelines that automatically execute heavy computational tasks and synthesize results.

Example pipeline:

```
Sequence Input
     ↓
Structure Prediction
     ↓
Docking Simulation
     ↓
MoE Analysis
     ↓
Final Report
```

The platform manages compute orchestration, validation, and analysis so researchers can focus on experimental design rather than infrastructure.
