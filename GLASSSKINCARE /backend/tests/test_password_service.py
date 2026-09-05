from app.services.password_service import hash_password, verify_password

def test_hash_then_verify():
    pw = "secret123"
    h = hash_password(pw)
    assert h != pw
    assert verify_password(pw, h) is True
    assert verify_password("wrong", h) is False
