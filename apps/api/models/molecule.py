from sqlalchemy import Column, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from core.database import Base
import uuid
import enum


class MoleculeType(str, enum.Enum):
    TARGET_PROTEIN = "target_protein"
    LIGAND = "ligand"
    COMPLEX = "complex"


class Molecule(Base):
    __tablename__ = "molecules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("pipeline_runs.id"), nullable=False)
    mol_type = Column(String, nullable=False)  # Using String instead of Enum for flexibility
    name = Column(String, nullable=False)
    smiles = Column(Text, nullable=True)
    inchi_key = Column(String, nullable=True)
    pdb_path = Column(String, nullable=True)
    properties = Column(JSONB, nullable=True, default=dict)

    # Relationships
    run = relationship("PipelineRun", back_populates="molecules")

    def __repr__(self):
        return f"<Molecule(id='{self.id}', name='{self.name}', type='{self.mol_type}')>"