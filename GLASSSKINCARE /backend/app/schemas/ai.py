"""AI endpoint request/response schemas."""
from pydantic import BaseModel


class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    shopify_customer_token: str | None = None


class SessionTokenResponse(BaseModel):
    token: str
    expires_in: int = 900  # 15 minutes


class SkinQuizAnswers(BaseModel):
    skin_type: str
    primary_concern: str
    current_routine: str
    lifestyle: str
    budget: str


class SkinQuizRequest(BaseModel):
    answers: SkinQuizAnswers
    shopify_customer_token: str | None = None


class RoutineStep(BaseModel):
    step: int
    product_handle: str | None = None
    product_name: str
    action: str  # "Cleanse" | "Treat" | "Moisturize" | "Protect"
    how_to_use: str
    why: str


class SkinQuizResponse(BaseModel):
    skin_profile_summary: str
    morning_routine: list[RoutineStep]
    evening_routine: list[RoutineStep]
    routine_goal: str


class AnalyzeSkinRequest(BaseModel):
    image_base64: str
    media_type: str = "image/jpeg"  # "image/jpeg" | "image/png"
    shopify_customer_token: str | None = None


class SkinAnalysisResult(BaseModel):
    skin_type: str
    concerns: list[str]
    concern_details: dict
    overall_skin_health: str
    confidence: float


class AnalyzeSkinResponse(BaseModel):
    analysis: SkinAnalysisResult
    recommended_handles: list[str]


class RecommendRequest(BaseModel):
    shopify_customer_token: str


class RecommendResponse(BaseModel):
    recommended_handles: list[str]
