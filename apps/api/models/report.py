from sqlalchemy import Column, String, DateTime, Enum, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from core.database import Base
import uuid
import enum


class ReportStatus(str, enum.Enum):
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"


class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("pipeline_runs.id"), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    status = Column(Enum(ReportStatus), nullable=False, default=ReportStatus.GENERATING)
    pdf_path = Column(String, nullable=True)
    sections = Column(JSONB, nullable=True, default=dict)
    compliance_flags = Column(JSONB, nullable=True, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    run = relationship("PipelineRun", back_populates="reports")

    def __repr__(self):
        return f"<Report(id='{self.id}', run_id='{self.run_id}', status='{self.status}')>"