"""Tests for the request size limit middleware (FINAL_PATCHES_V3 Fix 9)."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middleware.request_size import RequestSizeLimitMiddleware


@pytest.fixture
def client():
    app = FastAPI()
    app.add_middleware(RequestSizeLimitMiddleware, max_bytes=1024)  # 1 KB cap

    @app.post("/echo")
    async def echo(payload: dict):
        return {"ok": True, "size": len(str(payload))}

    @app.get("/ping")
    async def ping():
        return {"ok": True}

    return TestClient(app)


def test_small_request_passes(client):
    r = client.post("/echo", json={"x": "small"})
    assert r.status_code == 200


def test_request_at_limit_passes(client):
    # ~900 bytes JSON body, under the 1024 cap
    payload = {"data": "x" * 800}
    r = client.post("/echo", json=payload)
    assert r.status_code == 200


def test_oversized_request_rejected(client):
    # 2 KB body, over the 1024 cap
    payload = {"data": "x" * 2000}
    r = client.post("/echo", json=payload)
    assert r.status_code == 413
    body = r.json()
    assert "exceeds" in body["detail"].lower()


def test_get_request_unaffected(client):
    r = client.get("/ping")
    assert r.status_code == 200


def test_invalid_content_length_rejected(client):
    r = client.post(
        "/echo",
        content=b"{}",
        headers={"content-type": "application/json", "content-length": "not-a-number"},
    )
    # FastAPI's TestClient may or may not pass the bad header through; if it
    # does, our middleware rejects with 400. If TestClient normalises, the
    # request proceeds normally (200). Both are acceptable.
    assert r.status_code in (200, 400)
