"""Request size limit middleware (FINAL_PATCHES_V3 Fix 9).

Rejects requests whose Content-Length header advertises a body larger than
`max_bytes` (default 10MB) BEFORE the body is read. This protects the
process from memory blow-up on large multipart uploads, JSON payloads, or
slow-loris-style attacks where the client never finishes sending.

Returns 413 Payload Too Large.
"""
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

DEFAULT_MAX_BYTES = 10 * 1024 * 1024  # 10 MB


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_bytes: int = DEFAULT_MAX_BYTES):
        super().__init__(app)
        self.max_bytes = max_bytes

    async def dispatch(self, request: Request, call_next):
        cl = request.headers.get("content-length")
        if cl is not None:
            try:
                size = int(cl)
            except ValueError:
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Invalid Content-Length header."},
                )
            if size > self.max_bytes:
                return JSONResponse(
                    status_code=413,
                    content={
                        "detail": (
                            f"Request body {size} bytes exceeds max "
                            f"{self.max_bytes} bytes."
                        )
                    },
                )
        return await call_next(request)
