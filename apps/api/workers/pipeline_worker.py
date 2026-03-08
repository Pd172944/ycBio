from celery import Celery
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from core.config import settings
from core.database import Base
from models.pipeline_run import PipelineRun, PipelineStep, PipelineStatus, StepStatus
from agents.orchestrator import orchestrator
import asyncio
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create async database engine for worker
engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionWorker = async_sessionmaker(engine, expire_on_commit=False)

# Import Celery app
from workers.celery_app import celery_app


@celery_app.task(bind=True)
def execute_pipeline(self, run_id: str):
    """Celery task to execute complete pipeline."""
    return asyncio.run(execute_pipeline_async(self, run_id))


async def execute_pipeline_async(task_instance, run_id: str):
    """Async pipeline execution."""
    async with AsyncSessionWorker() as db:
        try:
            logger.info(f"Starting pipeline execution for run {run_id}")
            
            # Get pipeline run
            result = await db.execute(
                select(PipelineRun).where(PipelineRun.id == run_id)
            )
            run = result.scalar_one_or_none()
            
            if not run:
                raise Exception(f"Pipeline run {run_id} not found")
            
            # Update run status to running
            run.status = PipelineStatus.RUNNING
            await db.commit()
            
            # Execute pipeline orchestration
            try:
                results = await orchestrator.execute_pipeline(run_id, db)
                
                # Update run status to completed
                run.status = PipelineStatus.COMPLETED
                run.completed_at = datetime.utcnow()
                await db.commit()
                
                logger.info(f"Pipeline execution completed for run {run_id}")
                return {"status": "success", "results": results}
                
            except Exception as e:
                logger.error(f"Pipeline execution failed for run {run_id}: {str(e)}")
                
                # Update run status to failed
                run.status = PipelineStatus.FAILED
                run.error_message = str(e)
                run.completed_at = datetime.utcnow()
                await db.commit()
                
                # Mark any running steps as failed
                steps_result = await db.execute(
                    select(PipelineStep).where(
                        PipelineStep.run_id == run_id,
                        PipelineStep.status == StepStatus.RUNNING
                    )
                )
                running_steps = steps_result.scalars().all()
                
                for step in running_steps:
                    step.status = StepStatus.FAILED
                    step.error_message = str(e)
                    step.completed_at = datetime.utcnow()
                
                await db.commit()
                raise
                
        except Exception as e:
            logger.error(f"Critical error in pipeline worker for run {run_id}: {str(e)}")
            
            # Try to update run status to failed as last resort
            try:
                async with AsyncSessionWorker() as fallback_db:
                    result = await fallback_db.execute(
                        select(PipelineRun).where(PipelineRun.id == run_id)
                    )
                    run = result.scalar_one_or_none()
                    if run:
                        run.status = PipelineStatus.FAILED
                        run.error_message = f"Critical worker error: {str(e)}"
                        run.completed_at = datetime.utcnow()
                        await fallback_db.commit()
            except Exception as fallback_error:
                logger.error(f"Failed to update run status in fallback: {str(fallback_error)}")
            
            raise


@celery_app.task
def health_check():
    """Health check task for Celery worker."""
    return {"status": "healthy", "worker": "bioos_pipeline_worker"}