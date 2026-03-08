"""
Pipeline registry — maps tool names to callable tool functions and pipeline templates.
Tools registered here appear as draggable components in the workflow builder UI.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

import structlog

log = structlog.get_logger()


@dataclass(frozen=True)
class ToolDefinition:
    """Metadata for a registered pipeline tool/node."""

    name: str
    display_name: str
    description: str
    input_schema: dict[str, Any]
    output_schema: dict[str, Any]
    category: str = "general"
    fn: Callable[..., Any] | None = field(default=None, compare=False, repr=False)


@dataclass
class PipelineTemplate:
    """A pre-defined pipeline template users can instantiate."""

    id: str
    name: str
    description: str
    node_ids: list[str]  # ordered list of tool names


class PipelineRegistry:
    """Singleton registry for tools and pipeline templates."""

    def __init__(self) -> None:
        self._tools: dict[str, ToolDefinition] = {}
        self._templates: dict[str, PipelineTemplate] = {}

    def register_tool(self, tool: ToolDefinition) -> None:
        self._tools[tool.name] = tool
        log.debug("tool_registered", name=tool.name)

    def get_tool(self, name: str) -> ToolDefinition | None:
        return self._tools.get(name)

    def list_tools(self) -> list[ToolDefinition]:
        return list(self._tools.values())

    def register_template(self, template: PipelineTemplate) -> None:
        self._templates[template.id] = template

    def get_template(self, template_id: str) -> PipelineTemplate | None:
        return self._templates.get(template_id)

    def list_templates(self) -> list[PipelineTemplate]:
        return list(self._templates.values())


# Module-level singleton
_registry = PipelineRegistry()


def get_registry() -> PipelineRegistry:
    return _registry


def _bootstrap_registry() -> None:
    """Register built-in tools and default pipeline templates."""

    tools = [
        ToolDefinition(
            name="validate_schema",
            display_name="Schema Validation",
            description="Parse and validate FASTA/PDB/raw sequence input",
            category="validation",
            input_schema={"sequence": "str", "format": "str"},
            output_schema={"valid": "bool", "length": "int", "warnings": "list[str]"},
        ),
        ToolDefinition(
            name="audit_context",
            display_name="Experiment Audit",
            description="LLM-based audit for redundancy and anomaly detection",
            category="validation",
            input_schema={"sequence_input": "SequenceInput", "history": "list[dict]"},
            output_schema={"approved": "bool", "redundant": "bool", "anomalies": "list[str]"},
        ),
        ToolDefinition(
            name="trigger_modal_job",
            display_name="Structure Prediction",
            description="Run GPU inference via Modal + Tamarind Bio API",
            category="compute",
            input_schema={"job_id": "str", "sequence": "str"},
            output_schema={"modal_call_id": "str", "volume_path": "str"},
        ),
        ToolDefinition(
            name="run_moe_analysis",
            display_name="MoE Analysis",
            description="Parallel Mixture-of-Experts analysis (statistician + critic + synthesizer)",
            category="analysis",
            input_schema={"raw_output": "dict"},
            output_schema={"statistician": "dict", "critic": "dict", "synthesizer": "dict"},
        ),
        ToolDefinition(
            name="docking_simulation",
            display_name="Docking Simulation",
            description="Molecular docking simulation via Tamarind Bio",
            category="compute",
            input_schema={"pdb_string": "str", "ligand_smiles": "str"},
            output_schema={"docked_pdb": "str", "binding_affinity": "float"},
        ),
        ToolDefinition(
            name="sequence_analysis",
            display_name="Sequence Analysis",
            description="Compositional and structural sequence analysis",
            category="analysis",
            input_schema={"sequence": "str"},
            output_schema={"gc_content": "float", "hydrophobicity": "float"},
        ),
    ]

    for tool in tools:
        _registry.register_tool(tool)

    # Default pipeline: full structure prediction + MoE
    _registry.register_template(
        PipelineTemplate(
            id="default",
            name="Structure Prediction + Analysis",
            description="Validate → Audit → Structure Prediction → MoE Analysis",
            node_ids=[
                "validate_schema",
                "audit_context",
                "trigger_modal_job",
                "run_moe_analysis",
            ],
        )
    )

    # Docking pipeline
    _registry.register_template(
        PipelineTemplate(
            id="docking",
            name="Docking Simulation",
            description="Validate → Audit → Structure Prediction → Docking → MoE Analysis",
            node_ids=[
                "validate_schema",
                "audit_context",
                "trigger_modal_job",
                "docking_simulation",
                "run_moe_analysis",
            ],
        )
    )


_bootstrap_registry()
