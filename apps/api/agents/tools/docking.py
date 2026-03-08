from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from agents.tools.stubs.docking_stub import call_diffdock_api, call_autodock_vina_api
from core.files import write_artifact, read_artifact_text
import json
import logging

logger = logging.getLogger(__name__)


async def call_docking_tool(
    pdb_path: str,
    ligands: List[str],
    run_id: str,
    db: AsyncSession
) -> Dict[str, Any]:
    """Execute molecular docking prediction."""
    try:
        logger.info(f"Starting docking prediction for run {run_id} with {len(ligands)} ligands")
        
        # Default to DiffDock for now - could be configurable
        result = await call_diffdock_api(pdb_path, ligands)
        
        if result["status"] != "success":
            raise Exception(f"Docking failed: {result}")
        
        # Process docking results
        docking_results = result["results"]
        
        # Save docking results as JSON
        results_json = json.dumps(docking_results, indent=2)
        results_path = write_artifact(
            run_id,
            "docking_results.json",
            results_json
        )
        
        # Generate SDF file with top ligands (mock content for now)
        sdf_content = generate_mock_sdf(docking_results[:5])
        sdf_path = write_artifact(
            run_id,
            "top_ligands.sdf", 
            sdf_content
        )
        
        # Analyze docking results
        analysis = analyze_docking_results(docking_results)
        
        docking_result = {
            "status": "success",
            "results_path": results_path,
            "sdf_path": sdf_path,
            "total_poses": len(docking_results),
            "top_score": min(r["docking_score"] for r in docking_results),
            "mean_score": sum(r["docking_score"] for r in docking_results) / len(docking_results),
            "top_ligands": docking_results[:5],
            "analysis": analysis,
            "model_version": result.get("model_version", "diffdock_v1.2"),
            "processing_time": result.get("processing_time", 0.0)
        }
        
        logger.info(f"Docking prediction completed for run {run_id}")
        return docking_result
        
    except Exception as e:
        logger.error(f"Docking prediction failed for run {run_id}: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }


def generate_mock_sdf(ligands: List[Dict[str, Any]]) -> str:
    """Generate mock SDF content for ligands."""
    sdf_content = ""
    
    for i, ligand in enumerate(ligands):
        sdf_content += f"""
  Mrv2014 01012024

  6  6  0  0  0  0            999 V2000
   -1.2990    0.7500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -2.0135    0.3375    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -2.0135   -0.4875    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -1.2990   -0.9000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.5845   -0.4875    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.5845    0.3375    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  2  3  1  0  0  0  0
  3  4  1  0  0  0  0
  4  5  1  0  0  0  0
  5  6  1  0  0  0  0
  6  1  1  0  0  0  0
M  END
>  <SMILES>
{ligand['smiles']}

>  <DockingScore>
{ligand['docking_score']}

>  <PoseRank>
{ligand['pose_rank']}

$$$$
"""
    
    return sdf_content


def analyze_docking_results(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyze docking results and provide insights."""
    if not results:
        return {"error": "No docking results to analyze"}
    
    scores = [r["docking_score"] for r in results]
    
    analysis = {
        "total_ligands": len(results),
        "score_range": {
            "best": min(scores),
            "worst": max(scores),
            "mean": sum(scores) / len(scores),
            "std": (sum((x - sum(scores) / len(scores))**2 for x in scores) / len(scores))**0.5
        },
        "promising_ligands": len([s for s in scores if s < -8.0]),
        "weak_binders": len([s for s in scores if s > -6.0]),
        "recommendations": []
    }
    
    # Add recommendations based on scores
    if analysis["score_range"]["best"] < -10.0:
        analysis["recommendations"].append("Excellent binding candidates identified (< -10 kcal/mol)")
    if analysis["promising_ligands"] > 0:
        analysis["recommendations"].append(f"{analysis['promising_ligands']} ligands show promising binding affinity")
    if analysis["weak_binders"] > len(results) * 0.5:
        analysis["recommendations"].append("Consider alternative ligand libraries or binding sites")
    
    return analysis