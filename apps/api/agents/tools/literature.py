from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from agents.tools.stubs.literature_stub import search_pubmed, search_chembl
from core.files import write_artifact
import json
import logging

logger = logging.getLogger(__name__)


async def call_literature_tool(
    target_name: str,
    indication: str,
    run_id: str,
    db: AsyncSession
) -> Dict[str, Any]:
    """Execute literature search and analysis."""
    try:
        logger.info(f"Starting literature search for run {run_id}, target: {target_name}")
        
        # Search PubMed
        pubmed_result = await search_pubmed(target_name, indication, limit=10)
        
        # Search ChEMBL
        chembl_result = await search_chembl(target_name)
        
        if pubmed_result["status"] != "success":
            raise Exception(f"PubMed search failed: {pubmed_result}")
        
        # Compile literature results
        literature_results = {
            "target_name": target_name,
            "indication": indication,
            "pubmed_papers": pubmed_result["results"],
            "chembl_compounds": chembl_result["results"],
            "search_summary": {
                "pubmed_hits": len(pubmed_result["results"]),
                "chembl_compounds": len(chembl_result["results"]),
                "total_citations": sum(p.get("citation_count", 0) for p in pubmed_result["results"])
            }
        }
        
        # Save literature results
        results_json = json.dumps(literature_results, indent=2)
        results_path = write_artifact(run_id, "literature_results.json", results_json)
        
        # Generate literature analysis
        analysis = analyze_literature_results(literature_results)
        
        literature_result = {
            "status": "success",
            "results_path": results_path,
            "results": literature_results,
            "analysis": analysis,
            "processing_time": pubmed_result.get("processing_time", 0.0)
        }
        
        logger.info(f"Literature search completed for run {run_id}")
        return literature_result
        
    except Exception as e:
        logger.error(f"Literature search failed for run {run_id}: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }


def analyze_literature_results(results: Dict[str, Any]) -> Dict[str, Any]:
    """Analyze literature results and provide insights."""
    
    papers = results.get("pubmed_papers", [])
    compounds = results.get("chembl_compounds", [])
    
    analysis = {
        "literature_strength": "strong" if len(papers) >= 5 else "moderate" if len(papers) >= 2 else "limited",
        "recent_activity": len([p for p in papers if p.get("year", 0) >= 2020]),
        "high_impact_papers": [p for p in papers if p.get("citation_count", 0) > 100],
        "compound_diversity": len(set(c.get("chembl_id", "") for c in compounds)),
        "therapeutic_evidence": [],
        "recommendations": []
    }
    
    # Analyze therapeutic evidence
    if any("clinical" in p.get("title", "").lower() for p in papers):
        analysis["therapeutic_evidence"].append("Clinical trial evidence available")
    
    if any("FDA" in p.get("abstract", "") for p in papers):
        analysis["therapeutic_evidence"].append("FDA-related research identified")
    
    # Generate recommendations
    if analysis["literature_strength"] == "strong":
        analysis["recommendations"].append("Strong literature support for target validation")
    
    if analysis["recent_activity"] >= 3:
        analysis["recommendations"].append("Active research area with recent publications")
    
    if len(compounds) > 5:
        analysis["recommendations"].append("Multiple known active compounds provide SAR insights")
    
    return analysis