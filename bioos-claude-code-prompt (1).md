# BioOS — Claude Code Boilerplate Prompt

> Copy and paste everything below this line into Claude Code.

---

You are building BioOS — an agentic operating system for biology researchers. This is a full-stack TypeScript/Python monorepo. Build the complete boilerplate in one shot.

## Vision
BioOS is an orchestration harness that connects AI bioscience models (AlphaFold 3, ESMFold, RFdiffusion, DiffDock, etc.) into autonomous multi-agent pipelines. Researchers ingest a target sequence and the system handles everything: protein folding → binding site prediction → ligand docking → ADMET screening → FDA-grade documentation. Every step is reproducible, auditable, and compliance-ready.

---

## Tech Stack

**Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Zustand, React Query
**Backend API**: FastAPI (Python 3.11), async, Pydantic v2
**Agent Layer**: Claude claude-sonnet-4-20250514 via Anthropic SDK (Python), with tool_use for every external model call
**Queue/Workers**: Redis + Celery (async pipeline execution)
**DB**: PostgreSQL via SQLAlchemy async + Alembic migrations
**File Storage**: Local filesystem under `./data/artifacts/` organised by `run_id`. Stores PDB files, SDF files, and generated reports. No S3 or object storage.
**Auth**: NextAuth.js (frontend) + JWT middleware (FastAPI)
**Observability**: OpenTelemetry traces on every agent step

---

## Local Dev Setup

No Docker. The developer runs each service directly:

```bash
# 1. Start PostgreSQL and Redis however they prefer (brew services, system packages, etc.)

# 2. Backend
cd apps/api && pip install -r requirements.txt
alembic upgrade head
python seed.py          # creates demo user + example run
uvicorn main:app --reload --port 8000

# 3. Celery worker (separate terminal)
cd apps/api && celery -A workers.celery_app worker --loglevel=info

# 4. Frontend
cd apps/web && npm install && npm run dev   # localhost:3000
```

The README must include these exact steps with prerequisites listed: Python 3.11, Node 18+, PostgreSQL 15, Redis 7.

---

## Monorepo Structure

```
bioos/
├── apps/
│   ├── web/                          # Next.js frontend
│   │   ├── app/
│   │   │   ├── (auth)/login/
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx          # Pipeline run list
│   │   │   │   └── layout.tsx
│   │   │   ├── pipeline/
│   │   │   │   ├── new/page.tsx      # Sequence ingestion + pipeline config UI
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx      # Live run monitor (SSE)
│   │   │   │       └── report/page.tsx  # FDA-grade report viewer
│   │   │   ├── models/page.tsx       # Model registry browser
│   │   │   └── api/                  # Next.js API routes (auth, SSE proxy)
│   │   ├── components/
│   │   │   ├── pipeline/
│   │   │   │   ├── SequenceInput.tsx       # FASTA/UniProt input with validation
│   │   │   │   ├── PipelineBuilder.tsx     # Drag-and-drop step configurator
│   │   │   │   ├── AgentStepCard.tsx       # Live step status + agent reasoning display
│   │   │   │   ├── MoleculeViewer.tsx      # 3Dmol.js PDB structure viewer
│   │   │   │   └── RunTimeline.tsx         # Real-time pipeline progress
│   │   │   ├── report/
│   │   │   │   ├── ReportSection.tsx
│   │   │   │   └── ComplianceChecklist.tsx
│   │   │   └── ui/                   # shadcn components
│   │   ├── lib/
│   │   │   ├── api.ts                # Typed API client (fetch wrapper)
│   │   │   ├── sse.ts                # SSE hook for live agent events
│   │   │   └── stores/
│   │   │       └── pipeline.ts       # Zustand store
│   │   └── types/
│   │       └── index.ts              # Shared TypeScript types
│   │
│   └── api/                          # FastAPI backend
│       ├── main.py
│       ├── core/
│       │   ├── config.py             # Pydantic settings (env vars)
│       │   ├── database.py           # Async SQLAlchemy engine
│       │   ├── auth.py               # JWT utilities
│       │   └── files.py              # Local filesystem helpers (read/write artifacts)
│       ├── models/                   # SQLAlchemy ORM models
│       │   ├── user.py
│       │   ├── pipeline_run.py       # PipelineRun, PipelineStep
│       │   └── molecule.py           # Target, Ligand, BindingSite
│       ├── schemas/                  # Pydantic request/response schemas
│       │   ├── pipeline.py
│       │   └── molecule.py
│       ├── routers/
│       │   ├── auth.py
│       │   ├── pipelines.py          # CRUD + trigger runs
│       │   ├── runs.py               # Run status, SSE stream endpoint
│       │   ├── molecules.py          # Molecule/structure management
│       │   └── reports.py            # Report generation + download
│       ├── agents/                   # THE CORE — multi-agent swarm
│       │   ├── orchestrator.py       # Master orchestrator agent
│       │   ├── tools/
│       │   │   ├── folding.py        # AlphaFold 3 / ESMFold tool wrappers
│       │   │   ├── docking.py        # DiffDock / AutoDock Vina wrappers
│       │   │   ├── admet.py          # ADMET-AI / SwissADME wrappers
│       │   │   ├── literature.py     # PubMed / ChEMBL search tools
│       │   │   ├── structure.py      # PDB parsing, binding site detection
│       │   │   └── stubs/            # Dev stubs — replace with real API calls later
│       │   │       ├── folding_stub.py
│       │   │       ├── docking_stub.py
│       │   │       ├── admet_stub.py
│       │   │       └── literature_stub.py
│       │   ├── subagents/
│       │   │   ├── folding_agent.py
│       │   │   ├── docking_agent.py
│       │   │   ├── screening_agent.py
│       │   │   ├── literature_agent.py
│       │   │   └── documentation_agent.py
│       │   └── prompts/
│       │       ├── orchestrator.py
│       │       ├── folding.py
│       │       ├── docking.py
│       │       ├── screening.py
│       │       └── documentation.py
│       ├── workers/
│       │   ├── celery_app.py
│       │   └── pipeline_worker.py    # Celery task: runs full agent pipeline
│       ├── services/
│       │   ├── pipeline_service.py
│       │   └── report_service.py
│       ├── seed.py                   # Creates demo user + example pipeline run
│       └── alembic/
│           └── versions/
│
├── data/
│   └── artifacts/                    # Local file storage (gitignored)
│       └── {run_id}/
│           ├── structure.pdb
│           ├── ligands.sdf
│           └── report.pdf
│
├── .env.example
└── README.md
```

---

## What To Build — Detailed Spec

### 1. Local File Storage

All artifact I/O goes through `core/files.py`. No S3, no MinIO, no object storage of any kind.

```python
# core/files.py
ARTIFACTS_DIR = Path(settings.artifacts_dir)  # defaults to ./data/artifacts

def artifact_path(run_id: str, filename: str) -> Path:
    path = ARTIFACTS_DIR / run_id
    path.mkdir(parents=True, exist_ok=True)
    return path / filename

def write_artifact(run_id: str, filename: str, content: bytes) -> str:
    """Writes file, returns a relative path key for DB storage."""
    p = artifact_path(run_id, filename)
    p.write_bytes(content)
    return str(p.relative_to(ARTIFACTS_DIR.parent))

def read_artifact(key: str) -> bytes:
    return (ARTIFACTS_DIR.parent / key).read_bytes()
```

The `input_artifact_key` and `output_artifact_key` fields on `PipelineStep` store these relative path strings. FastAPI serves artifact files via a `GET /api/artifacts/{run_id}/{filename}` streaming file response endpoint.

### 2. Database Models (SQLAlchemy async)

**User**: id, email, hashed_password, org_id, role (researcher/admin), created_at

**PipelineRun**: id (uuid), user_id, name, status (enum: pending/running/completed/failed), target_sequence (text), pipeline_config (JSONB — ordered list of enabled steps with params), created_at, completed_at, error_message

**PipelineStep**: id, run_id, step_name (enum: ingestion/folding/binding_site/docking/admet/literature/documentation), status, started_at, completed_at, agent_reasoning (text — full Claude response), input_artifact_key (local path string), output_artifact_key (local path string), metadata (JSONB)

**Molecule**: id, run_id, mol_type (enum: target_protein/ligand/complex), name, smiles, inchi_key, pdb_path (relative local path), properties (JSONB — MW, LogP, etc.)

**Report**: id, run_id, version, status, pdf_path (relative local path), sections (JSONB), compliance_flags (JSONB), created_at

### 3. Agent Architecture

The orchestrator uses Claude claude-sonnet-4-20250514 with `tool_use`. It receives the pipeline config and loops through steps, delegating to subagents. Each subagent is also Claude claude-sonnet-4-20250514 with its own tool set.

**Orchestrator tools**:
- `run_folding_agent(sequence: str, model: str) -> FoldingResult`
- `run_docking_agent(pdb_path: str, ligands: list[str]) -> DockingResult`
- `run_screening_agent(ligand_smiles: list[str]) -> ScreeningResult`
- `run_literature_agent(target_name: str, indication: str) -> LiteratureResult`
- `run_documentation_agent(all_results: dict) -> ReportDraft`
- `update_step_status(step_id: str, status: str, reasoning: str)`
- `save_artifact(run_id: str, filename: str, content_b64: str) -> str` (writes to local disk via `files.py`, returns path key)

Each tool implementation calls the corresponding subagent. Subagents have their own tools that call the stubs in dev.

**Critical**: After each tool call, persist the agent's reasoning text and step status to PostgreSQL. Emit an SSE event so the frontend updates in real time.

### 4. SSE Streaming

`GET /api/runs/{run_id}/stream` — FastAPI SSE endpoint that yields events as pipeline steps complete. Event types: `step_started`, `step_completed`, `step_failed`, `agent_reasoning`, `run_completed`. Frontend subscribes with a custom `useSSE` hook and updates Zustand store live.

### 5. Frontend Pages

**`/pipeline/new`**: Two-panel layout. Left: FASTA textarea with sequence validation (check valid amino acid chars), UniProt ID lookup stub, organism/target name fields. Right: Pipeline configurator — toggleable cards for each step (Folding Model selector: ESMFold/AlphaFold3, Docking: DiffDock/Vina, ADMET: on/off, Literature: on/off). Submit triggers POST to `/api/pipelines` then redirects to run monitor.

**`/pipeline/[id]`**: Live run monitor. Top: run metadata header. Center: vertical timeline of PipelineStep cards. Each card shows step name, status badge, elapsed time, and an expandable "Agent Reasoning" accordion with the raw Claude reasoning text. When folding completes, render the PDB in a 3Dmol.js viewer (loaded via `/api/artifacts/{run_id}/structure.pdb`).

**`/pipeline/[id]/report`**: Structured report viewer. Sections: Executive Summary, Target Analysis, Structural Analysis, Docking Results (table of top ligands with scores), ADMET Profile (radar chart), Literature Evidence, Compliance Checklist (FDA IND-relevant flags). PDF download button hits `/api/reports/{run_id}/download`.

**`/models`**: Static page listing integrated models (AlphaFold3, ESMFold, RFdiffusion, DiffDock, ADMET-AI) with descriptions, paper links, version info.

### 6. Environment & Config

`.env.example`:
```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/bioos
REDIS_URL=redis://localhost:6379/0
ANTHROPIC_API_KEY=sk-ant-...
ARTIFACTS_DIR=./data/artifacts
JWT_SECRET=change-me
NEXTAUTH_SECRET=change-me
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Implementation Requirements

- **TypeScript strict mode** everywhere in the frontend. All API responses have generated types.
- **Async everywhere** in FastAPI — no sync database calls.
- **Pydantic v2** for all schemas. Use `model_config = ConfigDict(from_attributes=True)` for ORM models.
- **Error handling**: Every agent tool call is wrapped in try/except. On failure, step is marked failed, error stored, orchestrator decides whether to retry or abort pipeline.
- **Idempotency**: Pipeline runs have a `run_key` (hash of sequence + config). Re-submitting same run returns existing run if completed.
- **Logging**: Structured JSON logs with run_id and step_id in every log line.
- **`data/` is gitignored**: Add `data/` to `.gitignore`. The directory is created automatically on first run.
- **README.md**: Complete setup instructions covering prerequisites, env setup, migration, seed, and how to start all three processes.

---

## Stub Data for Dev

Since AlphaFold/DiffDock APIs won't be available locally, stubs in `agents/tools/stubs/` should:
- `call_esmfold_api`: Sleep 2s, write a real crambin PDB string to disk via `files.py`, return the path key
- `call_diffdock_api`: Sleep 3s, return 5 mock ligands with docking scores between -8 and -12 kcal/mol
- `compute_admet`: Return mock ADMET properties (MW, LogP, HBD, HBA, TPSA, bioavailability score)
- `search_pubmed`: Return 3 mock paper citations relevant to the target

Every stub is flagged with `# STUB: replace with real API call` at the top of the function.

---

## Deliverable

A fully runnable monorepo. After following the README, a researcher should be able to log in (demo user: `researcher@bioos.dev` / `bioos2024`), submit a sequence (pre-fill the form with a real example sequence), watch the multi-agent pipeline run live with step-by-step reasoning visible, view the 3D structure, and download a PDF report — all within the same session.

The seed script must also create one completed example pipeline run so the dashboard is not empty on first load.

Build the entire thing. Don't ask clarifying questions. Make architectural decisions confidently. This is the foundation of the platform.
