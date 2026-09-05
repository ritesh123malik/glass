/**
 * Shared TS types for AI feature contracts.
 * Mirrors FastAPI Pydantic schemas in `backend/app/schemas/ai.py`.
 */

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface QuizAnswers {
  skin_type: string;
  primary_concern: string;
  current_routine: string;
  lifestyle: string;
  budget: string;
}

export interface RoutineStep {
  step: number;
  product_handle: string | null;
  product_name: string;
  /** "Cleanse" | "Treat" | "Moisturize" | "Protect" */
  action: string;
  how_to_use: string;
  why: string;
}

export interface RoutineResult {
  skin_profile_summary: string;
  morning_routine: RoutineStep[];
  evening_routine: RoutineStep[];
  routine_goal: string;
}

export interface SkinAnalysis {
  skin_type: string;
  concerns: string[];
  concern_details: Record<string, unknown>;
  overall_skin_health: string;
  confidence: number;
}

export interface AnalyzeSkinResult {
  analysis: SkinAnalysis;
  recommended_handles: string[];
}

export interface SkinProfile {
  /** Backend looks this up via Shopify customer token; pass-through not stored. */
  skin_type?: string | null;
  concerns?: string[] | null;
  quiz_answers?: QuizAnswers | null;
}

export interface Product {
  id: string;
  title: string;
  handle: string;
  description: string;
  featuredImage: { url: string; altText: string | null } | null;
  priceRange: {
    minVariantPrice: { amount: string; currencyCode: string };
  };
}

/**
 * Raised on any non-2xx FastAPI response. Carries status + parsed body so
 * callers can branch (e.g. 401 → re-mint session token, 429 → back off).
 */
export class FastApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly endpoint: string;

  constructor(endpoint: string, status: number, body: unknown, message?: string) {
    super(
      message ??
        `FastAPI ${endpoint} returned ${status}: ${typeof body === "string" ? body : JSON.stringify(body)}`,
    );
    this.name = "FastApiError";
    this.status = status;
    this.body = body;
    this.endpoint = endpoint;
  }
}
