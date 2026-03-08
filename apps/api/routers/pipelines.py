from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from core.database import get_db
from models.pipeline_run import PipelineRun, PipelineStep, PipelineStatus, StepName, StepStatus
from models.user import User
from schemas.pipeline import PipelineRunCreate, PipelineRunResponse, PipelineRunList
from routers.auth import get_current_user
from workers.celery_app import celery_app
import hashlib
import json
from typing import Optional

router = APIRouter()


def generate_run_key(target_sequence: str, pipeline_config: dict) -> str:
    """Generate a unique key for pipeline run idempotency."""
    content = f"{target_sequence}{json.dumps(pipeline_config, sort_keys=True)}"
    return hashlib.md5(content.encode()).hexdigest()


@router.post("", response_model=PipelineRunResponse)
async def create_pipeline_run(
    request: PipelineRunCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create and start a new pipeline run."""
    
    # Validate sequence (basic amino acid validation)
    valid_aa = set("ACDEFGHIKLMNPQRSTVWY")
    if not all(aa.upper() in valid_aa for aa in request.target_sequence.replace(" ", "").replace("\n", "")):
        raise HTTPException(
            status_code=400,
            detail="Invalid amino acid sequence. Only standard 20 amino acids allowed."
        )
    
    # Generate run key for idempotency
    run_key = generate_run_key(request.target_sequence, [step.model_dump() for step in request.pipeline_config])
    
    # Check if run already exists
    existing_run = await db.execute(
        select(PipelineRun).where(PipelineRun.run_key == run_key)
    )
    existing = existing_run.scalar_one_or_none()
    if existing and existing.status == PipelineStatus.COMPLETED:
        # Return existing completed run
        await db.refresh(existing, ["steps"])
        return PipelineRunResponse.model_validate(existing)
    
    # Create new pipeline run
    pipeline_run = PipelineRun(
        user_id=current_user.id,
        name=request.name,
        target_sequence=request.target_sequence.strip(),
        pipeline_config=[step.model_dump() for step in request.pipeline_config],
        run_key=run_key,
        status=PipelineStatus.PENDING
    )
    
    db.add(pipeline_run)
    await db.commit()
    await db.refresh(pipeline_run)
    
    # Create pipeline steps based on configuration
    enabled_steps = [step for step in request.pipeline_config if step.enabled]
    
    for i, config_step in enumerate(enabled_steps):
        step = PipelineStep(
            run_id=pipeline_run.id,
            step_name=config_step.step_name,
            status=StepStatus.PENDING,
            metadata=config_step.params
        )
        db.add(step)
    
    await db.commit()
    
    # Trigger pipeline execution asynchronously
    celery_app.send_task(
        "workers.pipeline_worker.execute_pipeline",
        args=[str(pipeline_run.id)]
    )
    
    # Return the created run
    await db.refresh(pipeline_run, ["steps"])
    return PipelineRunResponse.model_validate(pipeline_run)


@router.get("", response_model=PipelineRunList)
async def list_pipeline_runs(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List user's pipeline runs with pagination."""
    
    offset = (page - 1) * per_page
    
    # Get total count
    count_result = await db.execute(
        select(func.count(PipelineRun.id)).where(PipelineRun.user_id == current_user.id)
    )
    total = count_result.scalar()
    
    # Get runs with steps
    runs_result = await db.execute(
        select(PipelineRun)
        .where(PipelineRun.user_id == current_user.id)
        .options(selectinload(PipelineRun.steps))
        .order_by(PipelineRun.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    runs = runs_result.scalars().all()
    
    return PipelineRunList(
        runs=[PipelineRunResponse.model_validate(run) for run in runs],
        total=total,
        page=page,
        per_page=per_page
    )


@router.get("/{run_id}", response_model=PipelineRunResponse)
async def get_pipeline_run(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific pipeline run with all steps."""
    
    result = await db.execute(
        select(PipelineRun)
        .where(PipelineRun.id == run_id, PipelineRun.user_id == current_user.id)
        .options(selectinload(PipelineRun.steps))
    )
    run = result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    
    return PipelineRunResponse.model_validate(run)


@router.delete("/{run_id}")
async def delete_pipeline_run(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a pipeline run and all associated data."""
    
    result = await db.execute(
        select(PipelineRun)
        .where(PipelineRun.id == run_id, PipelineRun.user_id == current_user.id)
    )
    run = result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    
    await db.delete(run)
    await db.commit()
    
    return {"message": "Pipeline run deleted successfully"}