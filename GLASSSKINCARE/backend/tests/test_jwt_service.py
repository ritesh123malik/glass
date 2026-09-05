import pytest
from datetime import timedelta
from app.services.jwt_service import create_access_token, decode_token

def test_roundtrip():
    token = create_access_token({"sub": "user-123", "is_admin": True})
    decoded = decode_token(token)
    assert decoded["sub"] == "user-123"
    assert decoded["is_admin"] is True

def test_expired_token_raises():
    import jwt
    from app.config import settings
    from datetime import datetime
    # Create an expired token directly
    expired = jwt.encode({"sub": "x", "exp": datetime.utcnow() - timedelta(hours=1)}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_token(expired)
