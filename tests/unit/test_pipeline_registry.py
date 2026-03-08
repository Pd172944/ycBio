"""Unit tests for the pipeline registry."""

from __future__ import annotations

from app.integrations.pipeline_registry import get_registry


class TestPipelineRegistry:
    def test_bootstrap_tools_registered(self) -> None:
        registry = get_registry()
        tools = registry.list_tools()
        tool_names = {t.name for t in tools}
        assert "validate_schema" in tool_names
        assert "audit_context" in tool_names
        assert "trigger_modal_job" in tool_names
        assert "run_moe_analysis" in tool_names

    def test_default_template_registered(self) -> None:
        registry = get_registry()
        template = registry.get_template("default")
        assert template is not None
        assert "validate_schema" in template.node_ids
        assert "run_moe_analysis" in template.node_ids

    def test_get_unknown_tool_returns_none(self) -> None:
        registry = get_registry()
        assert registry.get_tool("nonexistent_tool") is None

    def test_get_unknown_template_returns_none(self) -> None:
        registry = get_registry()
        assert registry.get_template("nonexistent") is None
