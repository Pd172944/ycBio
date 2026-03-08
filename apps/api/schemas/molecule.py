from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any
from models.molecule import MoleculeType
import uuid


class MoleculeCreate(BaseModel):
    run_id: uuid.UUID
    mol_type: str
    name: str
    smiles: Optional[str] = None
    inchi_key: Optional[str] = None
    pdb_path: Optional[str] = None
    properties: Dict[str, Any] = {}


class MoleculeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    run_id: uuid.UUID
    mol_type: str
    name: str
    smiles: Optional[str]
    inchi_key: Optional[str]
    pdb_path: Optional[str]
    properties: Dict[str, Any]


class ADMETProperties(BaseModel):
    molecular_weight: Optional[float] = None
    logp: Optional[float] = None
    hbd: Optional[int] = None  # Hydrogen bond donors
    hba: Optional[int] = None  # Hydrogen bond acceptors
    tpsa: Optional[float] = None  # Topological polar surface area
    bioavailability_score: Optional[float] = None
    lipinski_violations: Optional[int] = None
    veber_violations: Optional[int] = None


class DockingResult(BaseModel):
    ligand_name: str
    smiles: str
    docking_score: float
    binding_affinity: float
    rmsd: Optional[float] = None
    pose_rank: int