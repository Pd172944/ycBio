import asyncio
import random
from typing import List, Dict, Any


import os
import uuid
import logging

logger = logging.getLogger(__name__)

async def call_diffdock_api(pdb_path: str, ligand_smiles: List[str]) -> Dict[str, Any]:
    """Call DiffDock via Modal → Tamarind Bio API."""
    return await _call_modal_docking(pdb_path, ligand_smiles, model="diffdock")


async def call_autodock_vina_api(pdb_path: str, ligand_smiles: List[str]) -> Dict[str, Any]:
    """Call AutoDock Vina via Modal → Tamarind Bio API."""
    return await _call_modal_docking(pdb_path, ligand_smiles, model="vina")


async def _call_modal_docking(pdb_path: str, ligand_smiles: List[str], model: str) -> Dict[str, Any]:
    """Dispatch docking to Modal."""
    job_id = str(uuid.uuid4())
    
    try:
        import modal # type: ignore
        from core.files import read_artifact_text
        
        # Read the receptor PDB content
        # Note: pdb_path might be relative to artifacts dir or absolute
        # The orchestrator usually passes the path returned by write_artifact
        # which is typically just the filename or relative to run_id
        # We need to ensure we can read it.
        # Assuming the caller provides a valid path that read_artifact_text handles.
        receptor_pdb = read_artifact_text(pdb_path)
        
        app_name = os.environ.get("MODAL_APP_NAME", "biosync-orchestrator")
        fn = modal.Function.lookup(app_name, "run_docking")
        
        # Tamarind API currently takes receptor_pdb and ligand_smiles
        result = await fn.remote.aio(
            receptor_pdb=receptor_pdb, 
            ligand_smiles=ligand_smiles, 
            job_id=job_id
        )
        return result

    except Exception as exc:
        logger.error("Modal docking failed: %s", exc)
        raise Exception(f"Modal docking failed: {str(exc)}")