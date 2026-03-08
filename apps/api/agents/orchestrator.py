import asyncio
import json
from typing import Dict, Any, List
from anthropic import AsyncAnthropic
from core.config import settings
from core.files import write_artifact, read_artifact_text
from models.pipeline_run import PipelineRun, PipelineStep, StepStatus
from agents.tools.folding import call_folding_tool
from agents.tools.docking import call_docking_tool
from agents.tools.screening import call_screening_tool
from agents.tools.literature import call_literature_tool
from agents.tools.documentation import call_documentation_tool
from agents.prompts.orchestrator import ORCHESTRATOR_SYSTEM_PROMPT, ORCHESTRATOR_USER_PROMPT_TEMPLATE
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import base64
import uuid
import logging

logger = logging.getLogger(__name__)


class PipelineOrchestrator:
    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.tools = [
            {
                "name": "run_folding_agent",
                "description": "Execute protein folding prediction using ESMFold or AlphaFold 3",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "sequence": {"type": "string", "description": "Protein sequence"},
                        "model": {"type": "string", "enum": ["esmfold", "alphafold3"], "description": "Folding model to use"}
                    },
                    "required": ["sequence", "model"]
                }
            },
            {
                "name": "run_docking_agent", 
                "description": "Execute molecular docking using DiffDock or AutoDock Vina",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "pdb_path": {"type": "string", "description": "Path to protein structure PDB file"},
                        "ligands": {"type": "array", "items": {"type": "string"}, "description": "List of ligand SMILES strings"}
                    },
                    "required": ["pdb_path", "ligands"]
                }
            },
            {
                "name": "run_screening_agent",
                "description": "Execute ADMET screening and drug-likeness prediction",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "ligand_smiles": {"type": "array", "items": {"type": "string"}, "description": "List of ligand SMILES"}
                    },
                    "required": ["ligand_smiles"]
                }
            },
            {
                "name": "run_literature_agent",
                "description": "Search literature for target information and relevant compounds",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "target_name": {"type": "string", "description": "Target protein name"},
                        "indication": {"type": "string", "description": "Disease indication or therapeutic area"}
                    },
                    "required": ["target_name"]
                }
            },
            {
                "name": "run_documentation_agent",
                "description": "Generate comprehensive FDA-grade documentation report",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "all_results": {"type": "object", "description": "All pipeline results to document"}
                    },
                    "required": ["all_results"]
                }
            },
            {
                "name": "update_step_status",
                "description": "Update pipeline step status and reasoning",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "step_id": {"type": "string", "description": "Pipeline step ID"},
                        "status": {"type": "string", "enum": ["pending", "running", "completed", "failed"]},
                        "reasoning": {"type": "string", "description": "Agent reasoning for this step"}
                    },
                    "required": ["step_id", "status", "reasoning"]
                }
            },
            {
                "name": "save_artifact",
                "description": "Save pipeline artifact to local storage",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "run_id": {"type": "string", "description": "Pipeline run ID"},
                        "filename": {"type": "string", "description": "Artifact filename"},
                        "content_b64": {"type": "string", "description": "Base64 encoded file content"}
                    },
                    "required": ["run_id", "filename", "content_b64"]
                }
            }
        ]

    async def execute_pipeline(self, run_id: str, db: AsyncSession) -> Dict[str, Any]:
        """Execute complete pipeline orchestration."""
        try:
            # Get pipeline run
            result = await db.execute(
                select(PipelineRun).where(PipelineRun.id == run_id)
            )
            run = result.scalar_one_or_none()
            if not run:
                raise Exception(f"Pipeline run {run_id} not found")

            # Prepare prompt
            user_prompt = ORCHESTRATOR_USER_PROMPT_TEMPLATE.format(
                target_sequence=run.target_sequence,
                pipeline_name=run.name,
                run_id=run_id,
                pipeline_config=json.dumps(run.pipeline_config, indent=2)
            )

            # Execute orchestrator agent
            response = await self.client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=4000,
                temperature=0.1,
                system=ORCHESTRATOR_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
                tools=self.tools,
                tool_choice={"type": "auto"}
            )

            # Process tool calls
            results = {}
            for content_block in response.content:
                if content_block.type == "tool_use":
                    tool_result = await self._execute_tool(
                        content_block.name,
                        content_block.input,
                        run_id,
                        db
                    )
                    results[content_block.name] = tool_result

            return results

        except Exception as e:
            logger.error(f"Pipeline execution failed for run {run_id}: {str(e)}")
            # Update run status to failed
            run.status = "failed"
            run.error_message = str(e)
            await db.commit()
            raise

    async def _execute_tool(
        self, 
        tool_name: str, 
        tool_input: Dict[str, Any],
        run_id: str,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Execute a specific tool and return results."""
        
        if tool_name == "run_folding_agent":
            return await call_folding_tool(
                tool_input["sequence"], 
                tool_input["model"],
                run_id,
                db
            )
        elif tool_name == "run_docking_agent":
            return await call_docking_tool(
                tool_input["pdb_path"],
                tool_input["ligands"], 
                run_id,
                db
            )
        elif tool_name == "run_screening_agent":
            return await call_screening_tool(
                tool_input["ligand_smiles"],
                run_id,
                db
            )
        elif tool_name == "run_literature_agent":
            return await call_literature_tool(
                tool_input["target_name"],
                tool_input.get("indication", ""),
                run_id,
                db
            )
        elif tool_name == "run_documentation_agent":
            return await call_documentation_tool(
                tool_input["all_results"],
                run_id,
                db
            )
        elif tool_name == "update_step_status":
            return await self._update_step_status(
                tool_input["step_id"],
                tool_input["status"],
                tool_input["reasoning"],
                db
            )
        elif tool_name == "save_artifact":
            return await self._save_artifact(
                tool_input["run_id"],
                tool_input["filename"],
                tool_input["content_b64"]
            )
        else:
            raise Exception(f"Unknown tool: {tool_name}")

    async def _update_step_status(
        self,
        step_id: str,
        status: str,
        reasoning: str,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Update pipeline step status."""
        result = await db.execute(
            select(PipelineStep).where(PipelineStep.id == step_id)
        )
        step = result.scalar_one_or_none()
        
        if not step:
            return {"error": f"Step {step_id} not found"}
        
        step.status = StepStatus(status)
        step.agent_reasoning = reasoning
        
        if status == "running":
            step.started_at = asyncio.get_event_loop().time()
        elif status in ["completed", "failed"]:
            step.completed_at = asyncio.get_event_loop().time()
            
        await db.commit()
        
        return {"success": True, "step_id": step_id, "status": status}

    async def _save_artifact(
        self,
        run_id: str, 
        filename: str,
        content_b64: str
    ) -> Dict[str, Any]:
        """Save artifact to local filesystem."""
        try:
            content = base64.b64decode(content_b64)
            path_key = write_artifact(run_id, filename, content)
            return {"success": True, "path_key": path_key}
        except Exception as e:
            return {"error": f"Failed to save artifact: {str(e)}"}


# Global orchestrator instance
orchestrator = PipelineOrchestrator()