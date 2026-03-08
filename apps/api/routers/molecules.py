from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from models.molecule import Molecule
from models.pipeline_run import PipelineRun
from models.user import User
from schemas.molecule import MoleculeResponse, MoleculeCreate
from routers.auth import get_current_user
from typing import List, Optional

router = APIRouter()


@router.post("", response_model=MoleculeResponse)
async def create_molecule(
    request: MoleculeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new molecule record."""
    
    # Verify user owns the pipeline run
    run_result = await db.execute(
        select(PipelineRun).where(
            PipelineRun.id == request.run_id,
            PipelineRun.user_id == current_user.id
        )
    )
    run = run_result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    
    molecule = Molecule(
        run_id=request.run_id,
        mol_type=request.mol_type,
        name=request.name,
        smiles=request.smiles,
        inchi_key=request.inchi_key,
        pdb_path=request.pdb_path,
        properties=request.properties
    )
    
    db.add(molecule)
    await db.commit()
    await db.refresh(molecule)
    
    return MoleculeResponse.model_validate(molecule)


@router.get("/run/{run_id}", response_model=List[MoleculeResponse])
async def get_molecules_by_run(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all molecules associated with a pipeline run."""
    
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
    
    # Get molecules
    molecules_result = await db.execute(
        select(Molecule).where(Molecule.run_id == run_id)
    )
    molecules = molecules_result.scalars().all()
    
    return [MoleculeResponse.model_validate(mol) for mol in molecules]


@router.get("/{molecule_id}", response_model=MoleculeResponse)
async def get_molecule(
    molecule_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific molecule by ID."""
    
    molecule_result = await db.execute(
        select(Molecule).where(Molecule.id == molecule_id)
    )
    molecule = molecule_result.scalar_one_or_none()
    
    if not molecule:
        raise HTTPException(status_code=404, detail="Molecule not found")
    
    # Verify user owns the associated pipeline run
    run_result = await db.execute(
        select(PipelineRun).where(
            PipelineRun.id == molecule.run_id,
            PipelineRun.user_id == current_user.id
        )
    )
    run = run_result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return MoleculeResponse.model_validate(molecule)


@router.delete("/{molecule_id}")
async def delete_molecule(
    molecule_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a molecule record."""
    
    molecule_result = await db.execute(
        select(Molecule).where(Molecule.id == molecule_id)
    )
    molecule = molecule_result.scalar_one_or_none()
    
    if not molecule:
        raise HTTPException(status_code=404, detail="Molecule not found")
    
    # Verify user owns the associated pipeline run
    run_result = await db.execute(
        select(PipelineRun).where(
            PipelineRun.id == molecule.run_id,
            PipelineRun.user_id == current_user.id
        )
    )
    run = run_result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.delete(molecule)
    await db.commit()
    
    return {"message": "Molecule deleted successfully"}