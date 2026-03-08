from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from core.files import read_artifact, artifact_exists
from models.report import Report
from models.pipeline_run import PipelineRun
from models.user import User
from routers.auth import get_current_user
from services.report_service import generate_report_pdf
import io

router = APIRouter()


@router.get("/{run_id}")
async def get_report(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get report data for a pipeline run."""
    
    # Verify user owns the pipeline run
    run_result = await db.execute(
        select(PipelineRun).where(
            PipelineRun.id == run_id,
            PipelineRun.user_id == current_user.id
        )
    )
    run = run_result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    
    # Get latest report
    report_result = await db.execute(
        select(Report)
        .where(Report.run_id == run_id)
        .order_by(Report.created_at.desc())
    )
    report = report_result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return {
        "id": str(report.id),
        "run_id": str(report.run_id),
        "version": report.version,
        "status": report.status,
        "sections": report.sections,
        "compliance_flags": report.compliance_flags,
        "created_at": report.created_at,
        "pdf_available": bool(report.pdf_path and artifact_exists(report.pdf_path))
    }


@router.get("/{run_id}/download")
async def download_report(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Download report as PDF."""
    
    # Verify user owns the pipeline run
    run_result = await db.execute(
        select(PipelineRun).where(
            PipelineRun.id == run_id,
            PipelineRun.user_id == current_user.id
        )
    )
    run = run_result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    
    # Get latest report
    report_result = await db.execute(
        select(Report)
        .where(Report.run_id == run_id)
        .order_by(Report.created_at.desc())
    )
    report = report_result.scalar_one_or_none()
    
    if not report or not report.pdf_path:
        raise HTTPException(status_code=404, detail="PDF report not available")
    
    try:
        pdf_content = read_artifact(report.pdf_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF file not found")
    
    return StreamingResponse(
        io.BytesIO(pdf_content),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=bioos_report_{run.name}_{report.version}.pdf"
        }
    )


@router.post("/{run_id}/regenerate")
async def regenerate_report(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Regenerate report for a completed pipeline run."""
    
    # Verify user owns the pipeline run
    run_result = await db.execute(
        select(PipelineRun).where(
            PipelineRun.id == run_id,
            PipelineRun.user_id == current_user.id
        )
    )
    run = run_result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    
    if run.status != "completed":
        raise HTTPException(
            status_code=400, 
            detail="Can only regenerate reports for completed runs"
        )
    
    # Trigger report generation
    try:
        report = await generate_report_pdf(run_id, db)
        return {
            "message": "Report regeneration started",
            "report_id": str(report.id)
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to regenerate report: {str(e)}"
        )