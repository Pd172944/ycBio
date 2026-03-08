from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from agents.tools.stubs.folding_stub import call_esmfold_api, call_alphafold3_api
from core.files import write_artifact
import logging

logger = logging.getLogger(__name__)


async def call_folding_tool(
    sequence: str,
    model: str,
    run_id: str,
    db: AsyncSession
) -> Dict[str, Any]:
    """Execute protein folding prediction."""
    try:
        logger.info(f"Starting folding prediction for run {run_id} using {model}")
        
        # Call appropriate folding API
        if model.lower() == "esmfold":
            result = await call_esmfold_api(sequence)
        elif model.lower() == "alphafold3":
            result = await call_alphafold3_api(sequence)
        else:
            raise ValueError(f"Unknown folding model: {model}")
        
        if result["status"] != "success":
            raise Exception(f"Folding failed: {result}")
        
        # Save PDB structure to artifacts
        pdb_path = write_artifact(
            run_id, 
            "predicted_structure.pdb", 
            result["pdb_content"]
        )
        
        # Prepare folding results
        folding_result = {
            "status": "success",
            "model_used": model,
            "pdb_path": pdb_path,
            "confidence_score": result.get("confidence_score", 0.0),
            "confidence_scores": result.get("confidence_scores", []),
            "processing_time": result.get("processing_time", 0.0),
            "model_version": result.get("model_version", "unknown"),
            "sequence_length": len(sequence.replace(" ", "").replace("\n", "")),
            "structure_quality": {
                "mean_confidence": result.get("confidence_score", 0.0),
                "low_confidence_regions": [],  # Would be calculated from structure
                "structural_features": "alpha_helices_beta_sheets"  # Stub data
            }
        }
        
        logger.info(f"Folding prediction completed for run {run_id}")
        return folding_result
        
    except Exception as e:
        logger.error(f"Folding prediction failed for run {run_id}: {str(e)}")
        return {
            "status": "error",
            "error": str(e),
            "model_used": model
        }