"""
Global test configuration and fixtures.
"""

import os
from unittest.mock import patch

import pytest

# Create test settings that override environment variables
os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic-key")
os.environ.setdefault("TAMARIND_API_KEY", "test-tamarind-key")
os.environ.setdefault("TAMARIND_API_BASE_URL", "https://api.tamarind.bio/v1")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("MODAL_APP_NAME", "biosync-test")
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("LOG_LEVEL", "INFO")


@pytest.fixture(autouse=True)
def mock_settings():
    """Mock settings with test values for all tests."""
    # Mock Redis operations during tests
    with patch("redis.Redis"):
        yield
