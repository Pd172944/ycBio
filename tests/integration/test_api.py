"""Integration tests for the FastAPI endpoints."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


class TestHealthEndpoint:
    def test_health_returns_ok(self, client: TestClient) -> None:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


class TestPipelineEndpoints:
    def test_list_tools_returns_tools(self, client: TestClient) -> None:
        response = client.get("/pipelines/tools")
        assert response.status_code == 200
        data = response.json()
        assert "tools" in data
        tool_names = {t["name"] for t in data["tools"]}
        assert "validate_schema" in tool_names

    def test_list_templates_returns_templates(self, client: TestClient) -> None:
        response = client.get("/pipelines/templates")
        assert response.status_code == 200
        data = response.json()
        assert "templates" in data
        template_ids = {t["id"] for t in data["templates"]}
        assert "default" in template_ids


class TestJobEndpoints:
    def test_get_nonexistent_job_returns_404(self, client: TestClient) -> None:
        response = client.get("/jobs/nonexistent-job-id")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_create_job_returns_202(self, client: TestClient) -> None:
        mock_store = AsyncMock()
        mock_store.create_job = AsyncMock()
        mock_store.close = AsyncMock()

        with patch("app.main.get_store", return_value=mock_store):
            response = client.post(
                "/jobs",
                json={"sequence": "MKTAYIAKQRQISFVK", "format": "raw"},
            )

        assert response.status_code == 202
        data = response.json()
        assert "job_id" in data
        assert data["status"] == "pending"
