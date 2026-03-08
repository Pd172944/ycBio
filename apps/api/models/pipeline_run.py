from sqlalchemy import Column, String, Text, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from core.database import Base
import uuid
import enum


class PipelineStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class StepName(str, enum.Enum):
    INGESTION = "ingestion"
    FOLDING = "folding"
    BINDING_SITE = "binding_site"
    DOCKING = "docking"
    ADMET = "admet"
    LITERATURE = "literature"
    DOCUMENTATION = "documentation"


class StepStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    status = Column(Enum(PipelineStatus), nullable=False, default=PipelineStatus.PENDING)
    target_sequence = Column(Text, nullable=False)
    pipeline_config = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    run_key = Column(String, nullable=True, index=True)

    # Relationships
    user = relationship("User", back_populates="pipeline_runs")
    steps = relationship("PipelineStep", back_populates="run", cascade="all, delete-orphan")
    molecules = relationship("Molecule", back_populates="run", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="run", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<PipelineRun(id='{self.id}', name='{self.name}', status='{self.status}')>"


class PipelineStep(Base):
    __tablename__ = "pipeline_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("pipeline_runs.id"), nullable=False)
    step_name = Column(Enum(StepName), nullable=False)
    status = Column(Enum(StepStatus), nullable=False, default=StepStatus.PENDING)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    agent_reasoning = Column(Text, nullable=True)
    input_artifact_key = Column(String, nullable=True)
    output_artifact_key = Column(String, nullable=True)
    step_metadata = Column("metadata", JSONB, nullable=True, default=dict)
    error_message = Column(Text, nullable=True)

    # Relationships
    run = relationship("PipelineRun", back_populates="steps")

    def __repr__(self):
        return f"<PipelineStep(id='{self.id}', step_name='{self.step_name}', status='{self.status}')>"


# Add back_populates to User model
from .user import User
User.pipeline_runs = relationship("PipelineRun", back_populates="user", cascade="all, delete-orphan")