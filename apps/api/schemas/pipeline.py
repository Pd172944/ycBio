from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from models.pipeline_run import PipelineStatus, StepStatus, StepName
import uuid


class PipelineConfigStep(BaseModel):
    step_name: StepName
    enabled: bool = True
    params: Dict[str, Any] = Field(default_factory=dict)


class PipelineRunCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    target_sequence: str = Field(..., min_length=10)
    pipeline_config: List[PipelineConfigStep]


class PipelineStepResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    run_id: uuid.UUID
    step_name: StepName
    status: StepStatus
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    agent_reasoning: Optional[str]
    input_artifact_key: Optional[str]
    output_artifact_key: Optional[str]
    metadata: Dict[str, Any]
    error_message: Optional[str]


class PipelineRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    status: PipelineStatus
    target_sequence: str
    pipeline_config: List[Dict[str, Any]]
    created_at: datetime
    completed_at: Optional[datetime]
    error_message: Optional[str]
    run_key: Optional[str]
    steps: List[PipelineStepResponse] = Field(default_factory=list)


class PipelineRunList(BaseModel):
    runs: List[PipelineRunResponse]
    total: int
    page: int
    per_page: int


class SSEEvent(BaseModel):
    event: str
    data: Dict[str, Any]
    run_id: str
    step_id: Optional[str] = None