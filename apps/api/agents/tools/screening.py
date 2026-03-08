from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from agents.tools.stubs.admet_stub import compute_admet_properties, predict_drug_likeness
from core.files import write_artifact
import json
import logging

logger = logging.getLogger(__name__)


async def call_screening_tool(
    ligand_smiles: List[str],
    run_id: str,
    db: AsyncSession
) -> Dict[str, Any]:
    """Execute ADMET screening and drug-likeness prediction."""
    try:
        logger.info(f"Starting ADMET screening for run {run_id} with {len(ligand_smiles)} compounds")
        
        # Compute ADMET properties
        admet_result = await compute_admet_properties(ligand_smiles)
        drug_result = await predict_drug_likeness(ligand_smiles)
        
        if admet_result["status"] != "success":
            raise Exception(f"ADMET computation failed: {admet_result}")
        
        # Combine results
        screening_results = []
        for i, smiles in enumerate(ligand_smiles):
            admet_props = admet_result["results"][i] if i < len(admet_result["results"]) else {}
            drug_props = drug_result["results"][i] if i < len(drug_result["results"]) else {}
            
            combined_result = {
                "smiles": smiles,
                "compound_id": f"compound_{i+1}",
                "admet_properties": admet_props,
                "drug_likeness": drug_props,
                "overall_score": calculate_overall_score(admet_props, drug_props)
            }
            screening_results.append(combined_result)
        
        # Save screening results
        results_json = json.dumps(screening_results, indent=2)
        results_path = write_artifact(run_id, "screening_results.json", results_json)
        
        # Generate analysis
        analysis = analyze_screening_results(screening_results)
        
        screening_result = {
            "status": "success",
            "results_path": results_path,
            "total_compounds": len(screening_results),
            "results": screening_results,
            "analysis": analysis,
            "processing_time": admet_result.get("processing_time", 0.0)
        }
        
        logger.info(f"ADMET screening completed for run {run_id}")
        return screening_result
        
    except Exception as e:
        logger.error(f"ADMET screening failed for run {run_id}: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }


def calculate_overall_score(admet_props: Dict[str, Any], drug_props: Dict[str, Any]) -> float:
    """Calculate overall compound score based on ADMET and drug-likeness."""
    score = 0.0
    
    # ADMET component (50% weight)
    bioavailability = admet_props.get("bioavailability_score", 0.5)
    lipinski_penalty = max(0, 2 - admet_props.get("lipinski_violations", 1)) / 2
    admet_score = (bioavailability + lipinski_penalty) / 2
    
    # Drug-likeness component (50% weight)
    drug_score = drug_props.get("drug_likeness_score", 0.5)
    
    overall_score = (admet_score * 0.5) + (drug_score * 0.5)
    return round(overall_score, 3)


def analyze_screening_results(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyze screening results and provide insights."""
    if not results:
        return {"error": "No screening results to analyze"}
    
    scores = [r["overall_score"] for r in results]
    
    analysis = {
        "total_compounds": len(results),
        "score_distribution": {
            "excellent": len([s for s in scores if s >= 0.8]),
            "good": len([s for s in scores if 0.6 <= s < 0.8]),
            "moderate": len([s for s in scores if 0.4 <= s < 0.6]),
            "poor": len([s for s in scores if s < 0.4])
        },
        "top_compounds": sorted(results, key=lambda x: x["overall_score"], reverse=True)[:5],
        "recommendations": []
    }
    
    # Add recommendations
    if analysis["score_distribution"]["excellent"] > 0:
        analysis["recommendations"].append(f"{analysis['score_distribution']['excellent']} compounds show excellent drug-like properties")
    
    if analysis["score_distribution"]["poor"] > len(results) * 0.7:
        analysis["recommendations"].append("Consider alternative compound libraries")
    
    return analysis