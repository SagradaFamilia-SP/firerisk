import pytest
import respx
from fastapi.testclient import TestClient
from httpx import Response

from app.main import app


@pytest.fixture
def client() -> TestClient:
    with respx.mock(base_url="http://localhost:30000/v1", assert_all_called=False) as model_api:
        model_api.get("/models").mock(return_value=Response(200, json={"data": []}))
        with TestClient(app) as test_client:
            yield test_client
