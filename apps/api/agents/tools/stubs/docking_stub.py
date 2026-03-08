import asyncio
import random
from typing import List, Dict, Any


# STUB: replace with real API call
async def call_diffdock_api(pdb_path: str, ligand_smiles: List[str]) -> Dict[str, Any]:
    """Stub for DiffDock API call."""
    await asyncio.sleep(3)  # Simulate API processing time
    
    # Generate mock docking results
    results = []
    for i, smiles in enumerate(ligand_smiles[:5]):  # Limit to 5 ligands
        score = random.uniform(-12.0, -6.0)  # kcal/mol
        results.append({
            "ligand_id": f"ligand_{i+1}",
            "smiles": smiles,
            "docking_score": round(score, 2),
            "binding_affinity": round(score + random.uniform(-0.5, 0.5), 2),
            "rmsd": round(random.uniform(0.5, 3.0), 2),
            "pose_rank": i + 1,
            "pose_file": f"pose_{i+1}.pdb"
        })
    
    # Sort by docking score (most negative = best)
    results.sort(key=lambda x: x["docking_score"])
    
    return {
        "status": "success",
        "results": results,
        "total_poses": len(results),
        "processing_time": 3.1,
        "model_version": "diffdock_v1.2"
    }


# STUB: replace with real API call
async def call_autodock_vina_api(pdb_path: str, ligand_smiles: List[str]) -> Dict[str, Any]:
    """Stub for AutoDock Vina API call."""
    await asyncio.sleep(2)  # Simulate API processing time
    
    results = []
    for i, smiles in enumerate(ligand_smiles[:5]):
        score = random.uniform(-10.0, -5.0)  # Vina scores
        results.append({
            "ligand_id": f"vina_ligand_{i+1}",
            "smiles": smiles,
            "docking_score": round(score, 2),
            "binding_affinity": round(score, 2),
            "rmsd_lb": round(random.uniform(0.0, 2.0), 2),
            "rmsd_ub": round(random.uniform(2.0, 4.0), 2),
            "pose_rank": i + 1
        })
    
    results.sort(key=lambda x: x["docking_score"])
    
    return {
        "status": "success",
        "results": results,
        "total_poses": len(results),
        "processing_time": 2.3,
        "model_version": "autodock_vina_1.2.0"
    }