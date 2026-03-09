from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class ChatMessage(BaseModel):
    role: str = Field(..., description="Role: 'user' or 'assistant'")
    content: str = Field(..., description="Message content")
    timestamp: Optional[str] = None


class ChatRequest(BaseModel):
    message: str = Field(..., description="User's message to the AI assistant")
    context: Optional[Dict[str, Any]] = Field(
        default=None, 
        description="Optional context: run_id, pipeline_type, etc."
    )
    history: List[ChatMessage] = Field(
        default=[], 
        description="Previous conversation history"
    )


class ResearchQuery(BaseModel):
    query: str = Field(..., description="Scientific research question")
    run_id: Optional[str] = Field(
        default=None, 
        description="Optional pipeline run ID for context"
    )
    domains: List[str] = Field(
        default=["protein_structure", "drug_discovery", "computational_biology"],
        description="Research domains to focus on"
    )