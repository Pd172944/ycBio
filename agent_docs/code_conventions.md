# Code Conventions

## Type Hints
- Required on all function signatures
- No `Any` — use `object` or specific types
- Use `TypedDict` for internal state shapes
- Use Pydantic v2 models for all I/O boundaries (API, Redis serialization)

## Async
- All functions that touch IO must be `async def`
- Prefer `asyncio.gather` for parallel tasks
- Never use `time.sleep` — use `asyncio.sleep`

## Logging
Use `structlog` bound to `job_id`:
```python
import structlog
log = structlog.get_logger().bind(job_id=job_id)
await log.ainfo("stage_complete", stage="validate")
```

## LangGraph Nodes
Pure functions — take state, return state delta:
```python
async def validate_node(state: JobState) -> dict:
    result = await validate_schema(state["sequence_input"])
    return {"validation_result": result, "status": "auditing"}
```

## Pydantic Models
- Use `model_config = ConfigDict(frozen=True)` for immutable models
- Validators with `@field_validator` for domain logic
- Serialize to Redis with `.model_dump_json()`

## Error Handling
- Catch specific exceptions, not bare `except`
- Set `state["status"] = "failed"` and `state["error"] = str(exc)` on failure
- Log errors with `log.aerror("...", exc_info=True)`

## Secrets
- All from environment variables via `pydantic-settings`
- Never hardcode, never log secrets
- See `.env.example` for required vars

## File Organization
- One class/concept per file where possible
- `__init__.py` files expose public API for each package
