from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional, Dict, Any, AsyncGenerator
from core.database import get_db
from models.user import User
from models.pipeline_run import PipelineRun
from models.report import Report
from models.ai_models import ChatMessage, ChatRequest, ResearchQuery
from routers.auth import get_current_user
from services.ai_assistant_service import AIAssistantService
import json
import asyncio

router = APIRouter()


@router.post("/chat/stream")
async def chat_with_assistant_stream(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Stream chat responses from the AI Research Assistant."""
    
    ai_service = AIAssistantService()
    
    # Get context data if run_id provided
    context_data = None
    if request.context and request.context.get("run_id"):
        context_data = await _get_run_context(
            request.context["run_id"], 
            current_user, 
            db
        )
    
    async def generate_response() -> AsyncGenerator[str, None]:
        try:
            async for chunk in ai_service.stream_chat_response(
                message=request.message,
                history=request.history,
                context=context_data,
                user_id=current_user.id
            ):
                yield f"data: {json.dumps({'content': chunk, 'done': False})}\n\n"
            
            yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"
            
        except Exception as e:
            error_msg = f"AI Assistant Error: {str(e)}"
            yield f"data: {json.dumps({'error': error_msg, 'done': True})}\n\n"
    
    return StreamingResponse(
        generate_response(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.post("/research/analyze")
async def analyze_research_question(
    request: ResearchQuery,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Analyze a complex research question using the MoE approach."""
    
    ai_service = AIAssistantService()
    
    # Get context from pipeline run if provided
    context_data = None
    if request.run_id:
        context_data = await _get_run_context(request.run_id, current_user, db)
    
    try:
        analysis = await ai_service.analyze_research_question(
            query=request.query,
            domains=request.domains,
            context=context_data,
            user_id=current_user.id
        )
        
        return {
            "query": request.query,
            "analysis": analysis,
            "domains": request.domains,
            "context_included": context_data is not None
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze research question: {str(e)}"
        )


@router.post("/suggestions/optimize")
async def get_pipeline_optimization_suggestions(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get AI-powered suggestions to optimize a pipeline run."""
    
    ai_service = AIAssistantService()
    
    # Get comprehensive run context
    context_data = await _get_run_context(run_id, current_user, db)
    if not context_data:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    
    try:
        suggestions = await ai_service.generate_optimization_suggestions(
            context_data, 
            current_user.id
        )
        
        return {
            "run_id": run_id,
            "suggestions": suggestions,
            "generated_at": context_data.get("timestamp")
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate optimization suggestions: {str(e)}"
        )


@router.get("/knowledge/search")
async def search_computational_biology_knowledge(
    q: str,
    limit: int = 10,
    domains: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Search the AI's knowledge base for computational biology information."""
    
    ai_service = AIAssistantService()
    
    search_domains = domains.split(",") if domains else [
        "protein_structure", 
        "drug_discovery", 
        "molecular_dynamics",
        "bioinformatics"
    ]
    
    try:
        results = await ai_service.search_knowledge(
            query=q,
            domains=search_domains,
            limit=limit,
            user_id=current_user.id
        )
        
        return {
            "query": q,
            "domains": search_domains,
            "results": results,
            "count": len(results)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Knowledge search failed: {str(e)}"
        )


@router.post("/explain/results")
async def explain_pipeline_results(
    run_id: str,
    question: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get AI explanation of pipeline results in plain language."""
    
    ai_service = AIAssistantService()
    
    context_data = await _get_run_context(run_id, current_user, db)
    if not context_data:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    
    try:
        explanation = await ai_service.explain_results(
            context_data, 
            specific_question=question,
            user_id=current_user.id
        )
        
        return {
            "run_id": run_id,
            "explanation": explanation,
            "question": question
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to explain results: {str(e)}"
        )


async def _get_run_context(
    run_id: str, 
    user: User, 
    db: AsyncSession
) -> Optional[Dict[str, Any]]:
    """Get comprehensive context data for a pipeline run."""
    
    # Get pipeline run
    run_result = await db.execute(
        select(PipelineRun).where(
            PipelineRun.id == run_id,
            PipelineRun.user_id == user.id
        )
    )
    run = run_result.scalar_one_or_none()
    
    if not run:
        return None
    
    # Get latest report
    report_result = await db.execute(
        select(Report)
        .where(Report.run_id == run_id)
        .order_by(Report.created_at.desc())
    )
    report = report_result.scalar_one_or_none()
    
    context = {
        "run_id": run_id,
        "pipeline_name": run.name,
        "pipeline_type": run.pipeline_type,
        "status": run.status,
        "parameters": run.parameters,
        "created_at": run.created_at.isoformat(),
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "error_message": run.error_message,
        "timestamp": run.updated_at.isoformat()
    }
    
    if report:
        context["report"] = {
            "sections": report.sections,
            "compliance_flags": report.compliance_flags,
            "version": report.version,
            "status": report.status
        }
    
    return context