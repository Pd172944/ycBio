# BioSync Orchestrator — Claude Memory

## Active Frontend: apps/web (Next.js 14 + Tailwind + ReactFlow)
- Dark theme: `--background: 222 47% 3%`, emerald primary (#10b981)
- ReactFlow v11 (`reactflow` package) — uses `reactFlowInstance.project()` for coordinate conversion
- Main dashboard: `apps/web/app/dashboard/page.tsx`
- Workflow builder: `apps/web/components/workflow-builder.tsx`
- Workflow nodes: `apps/web/components/workflow-nodes.tsx`
- AI chat assistant: `apps/web/components/ai-research-assistant.tsx`

## Key Architecture Decisions
- `WorkflowContext` in `workflow-nodes.tsx` provides `handleNodeDataChange` so nodes can update their own data without prop drilling
- Per-step colour themes use inline styles (not Tailwind) to avoid purge issues — defined in `STEP_THEME` record
- `TOOL_VARIANTS` record in `workflow-nodes.tsx` defines 3 specific tool choices per pipeline step
- `WorkflowBuilder` wraps `WorkflowBuilderInner` in `ReactFlowProvider`; inner component uses `useReactFlow()`
- Token is passed as prop to `WorkflowBuilder` from dashboard so AI Guide can call `/api/ai/chat/stream`
- AI Guide panel is a right sidebar (toggleable) with: smart suggestions, pipeline health checklist, compact chat

## Pipeline Steps & Their Tools
- folding: AlphaFold 3 (default), ESMFold, OpenFold
- binding_site: P2Rank (default), FPocket, SiteMap
- docking: DiffDock (default), AutoDock Vina, Gnina
- admet: ADMETlab 2.0 (default), SwissADME, pkCSM
- literature: PubMed+AI (default), ChEMBL, Semantic Scholar
- documentation: FDA IND Report (default), Scientific Summary, Full Tech Report

## Pipeline Templates
- Drug Discovery: all 6 steps
- Protein Analysis: folding + binding_site + literature
- Quick Screen: folding + docking + admet

## Backend API (apps/api, FastAPI)
- Auth: POST /api/auth/login → access_token
- Pipelines: POST /api/pipelines, GET /api/pipelines/{id}
- AI: POST /api/ai/chat/stream (SSE), POST /api/ai/explain/results, POST /api/ai/suggestions/optimize
- Health: GET /health

## User Preferences
- Prefers beautiful, polished UI with glassmorphism aesthetic
- Wants AI to guide researchers through pipeline building (integrated in builder, not just popup)
- Tool selection (specific tools per step) is a key feature
