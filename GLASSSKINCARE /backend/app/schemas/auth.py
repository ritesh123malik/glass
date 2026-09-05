"""Auth request/response schemas."""
from pydantic import BaseModel, EmailStr


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str  # plain text; service layer hashes/verifies


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ShopifyVerifyRequest(BaseModel):
    shopify_customer_token: str


class UserResponse(BaseModel):
    id: str
    email: str
    has_skin_profile: bool
    skin_type: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str  # min length enforced at router layer
