# Modal Setup Guide

## Authentication
```bash
modal token new  # interactive login
# or set env vars:
# MODAL_TOKEN_ID, MODAL_TOKEN_SECRET
```

## Deployment
```bash
modal deploy app/workers/modal_runner.py
```

## Running Inference Manually
```bash
modal run app/workers/modal_runner.py::run_inference \
  --sequence "MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQ..."
```

## Volume Layout
Inference outputs are stored in a Modal Volume named `biosync-outputs`:
```
/outputs/{job_id}/raw_result.json
```

## App Name
Configured via `MODAL_APP_NAME` env var (default: `biosync-orchestrator`).

## GPU Configuration
The `run_inference` function requests an `A10G` GPU.
Adjust `gpu` parameter in `@app.function(gpu=...)` to change hardware tier.

## Stub vs Deployed
- Local dev: use `modal run` (stub runtime, no deploy needed)
- Production: use `modal deploy` then call deployed function via `modal.Function.lookup()`
