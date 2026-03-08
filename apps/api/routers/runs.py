from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from core.database import get_db
from models.pipeline_run import PipelineRun
from models.user import User
from schemas.pipeline import SSEEvent
from routers.auth import get_current_user
import asyncio
import json
from typing import AsyncGenerator

router = APIRouter()


async def get_run_or_404(
    run_id: str, 
    user_id: str, 
    db: AsyncSession
) -> PipelineRun:
    """Get pipeline run or raise 404."""
    result = await db.execute(
        select(PipelineRun)
        .where(PipelineRun.id == run_id, PipelineRun.user_id == user_id)
        .options(selectinload(PipelineRun.steps))
    )
    run = result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    
    return run


@router.get("/{run_id}/stream")
async def stream_pipeline_events(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Server-Sent Events endpoint for live pipeline updates."""
    
    # Verify run exists and user has access
    run = await get_run_or_404(run_id, str(current_user.id), db)
    
    async def event_stream() -> AsyncGenerator[str, None]:
        """Generate SSE events for pipeline progress."""
        last_step_count = 0
        
        while True:
            try:
                # Get latest run state
                result = await db.execute(
                    select(PipelineRun)
                    .where(PipelineRun.id == run_id)
                    .options(selectinload(PipelineRun.steps))
                )
                current_run = result.scalar_one_or_none()
                
                if not current_run:
                    break
                
                # Check for new step updates
                if len(current_run.steps) > last_step_count:
                    for step in current_run.steps[last_step_count:]:
                        event = SSEEvent(
                            event="step_update",
                            data={
                                "step_id": str(step.id),
                                "step_name": step.step_name,
                                "status": step.status,
                                "agent_reasoning": step.agent_reasoning,
                                "started_at": step.started_at.isoformat() if step.started_at else None,
                                "completed_at": step.completed_at.isoformat() if step.completed_at else None,
                                "metadata": step.step_metadata
                            },
                            run_id=run_id,
                            step_id=str(step.id)
                        )
                        yield f"data: {event.model_dump_json()}\n\n"
                    
                    last_step_count = len(current_run.steps)
                
                # Check for run completion
                if current_run.status in ["completed", "failed"]:
                    event = SSEEvent(
                        event="run_completed" if current_run.status == "completed" else "run_failed",
                        data={
                            "status": current_run.status,
                            "completed_at": current_run.completed_at.isoformat() if current_run.completed_at else None,
                            "error_message": current_run.error_message
                        },
                        run_id=run_id
                    )
                    yield f"data: {event.model_dump_json()}\n\n"
                    break
                
                # Wait before next check
                await asyncio.sleep(2)
                
            except Exception as e:
                error_event = SSEEvent(
                    event="error",
                    data={"error": str(e)},
                    run_id=run_id
                )
                yield f"data: {error_event.model_dump_json()}\n\n"
                break
        
        yield "data: {\"event\": \"close\"}\n\n"
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control"
        }
    )


@router.get("/{run_id}/status")
async def get_run_status(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current status of a pipeline run."""
    
    run = await get_run_or_404(run_id, str(current_user.id), db)
    
    return {
        "run_id": str(run.id),
        "status": run.status,
        "progress": {
            "total_steps": len(run.steps),
            "completed_steps": len([s for s in run.steps if s.status == "completed"]),
            "current_step": next(
                (s.step_name for s in run.steps if s.status == "running"), None
            )
        },
        "created_at": run.created_at,
        "completed_at": run.completed_at,
        "error_message": run.error_message
    }