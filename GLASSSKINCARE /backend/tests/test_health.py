"""Test /health endpoint."""
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_health_returns_200():
    """GET /health returns HTTP 200."""
    response = client.get("/health")
    assert response.status_code == 200


def test_health_returns_status_ok():
    """GET /health returns JSON with status='ok'."""
    response = client.get("/health")
    assert response.json() == {"status": "ok"}


def test_docs_endpoint_available():
    """GET /docs serves Swagger UI."""
    response = client.get("/docs")
    assert response.status_code == 200
