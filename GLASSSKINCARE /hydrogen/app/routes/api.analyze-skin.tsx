/**
 * api.analyze-skin.tsx
 * ---------------------
 * POST /api/analyze-skin — photo skin analysis proxy.
 *
 * Accepts a multipart/form-data upload from the browser, base64-encodes
 * the bytes, and forwards to FastAPI `/ai/analyze-skin`. The browser
 * never talks to FastAPI directly; the AI session token cookie is read
 * here and forwarded server-side, keeping HMAC-scoped tokens off the
 * client.
 *
 * Validation:
 *   - Max size  : 5 MB raw bytes (413 Payload Too Large)
 *   - MIME type : image/jpeg | image/png | image/webp (415 Unsupported)
 *   - Method    : POST only; GET → 405
 *
 * Response: `{ analysis, recommended_handles }` from FastAPI. The UI
 * route renders the analysis + the recommended product handles. (The
 * backend does not currently emit a `routine` — recommended handles are
 * the routine's source of truth for now.)
 */
import type { ActionFunctionArgs } from "@remix-run/node";
import { FastApiError } from "~/lib/types";
import { getAiToken, setAiToken } from "~/lib/ai-session.server";
import { getSessionToken, postAnalyzeSkin } from "~/lib/fastapi.server";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** MIME types the AI vision endpoint accepts. */
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** Field name used for the file part in the multipart upload. */
const FILE_FIELD = "image";

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return jsonError(405, "Method Not Allowed");
  }

  // ─── 1. Parse multipart form ──────────────────────────────────────
  // We support both multipart/form-data (the spec) and JSON fallback
  // (handy for curl/Postman debugging — body: { image_base64, media_type }).
  const contentType = request.headers.get("Content-Type") ?? "";
  let bytes: Uint8Array;
  let mediaType: "image/jpeg" | "image/png" | "image/webp";

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return jsonError(400, "Could not parse multipart form.");
    }

    const file = form.get(FILE_FIELD);
    if (!(file instanceof File) || file.size === 0) {
      return jsonError(400, `Field "${FILE_FIELD}" must be a non-empty file.`);
    }

    // Size check — BufferSource slice vs. ArrayBuffer is well-defined in
    // modern runtimes, but we read the buffer once and measure it.
    if (file.size > MAX_BYTES) {
      return jsonError(413, "Image must be 5 MB or smaller.");
    }

    const declared = (file.type || "").toLowerCase();
    if (!ALLOWED_MIME.has(declared)) {
      return jsonError(415, `Unsupported image type "${declared}".`);
    }
    mediaType = declared as "image/jpeg" | "image/png" | "image/webp";

    const arrayBuf = await file.arrayBuffer();
    bytes = new Uint8Array(arrayBuf);
  } else if (contentType.includes("application/json")) {
    // Fallback path for non-browser clients.
    let body: { image_base64?: string; media_type?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return jsonError(400, "Invalid JSON body.");
    }
    if (!body.image_base64 || typeof body.image_base64 !== "string") {
      return jsonError(400, "image_base64 is required.");
    }
    const declared = (body.media_type ?? "image/jpeg").toLowerCase();
    if (!ALLOWED_MIME.has(declared)) {
      return jsonError(415, `Unsupported image type "${declared}".`);
    }
    mediaType = declared as "image/jpeg" | "image/png" | "image/webp";

    // Decode + size-check raw bytes (decodeURIComponent + escape handles
    // both standard and URL-safe base64 variants).
    try {
      const cleaned = body.image_base64.replace(/\s+/g, "");
      const binary = atob(cleaned);
      const out = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
      bytes = out;
    } catch {
      return jsonError(400, "image_base64 is not valid base64.");
    }
    if (bytes.byteLength > MAX_BYTES) {
      return jsonError(413, "Image must be 5 MB or smaller.");
    }
  } else {
    return jsonError(415, "Content-Type must be multipart/form-data or application/json.");
  }

  // ─── 2. Resolve AI session token ──────────────────────────────────
  let token = await getAiToken(request);
  let setCookie: string | undefined;
  if (!token) {
    try {
      token = await getSessionToken(request, context.env.FASTAPI_URL);
      setCookie = await setAiToken(token, 15 * 60 - 60);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "session-token failed";
      return jsonError(502, `Could not obtain AI session token: ${msg}`);
    }
  }

  // ─── 3. Forward to FastAPI ─────────────────────────────────────────
  // Re-encode to base64. Server-side btoa() handles ASCII cleanly.
  let imageBase64: string;
  try {
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    imageBase64 = btoa(binary);
  } catch {
    return jsonError(500, "Failed to base64-encode image.");
  }

  try {
    // FastAPI accepts image/jpeg | image/png. webp is collapsed to jpeg
    // because the upstream Claude vision call expects one of those two
    // — caller should re-encode if webp, but we don't fail hard here.
    const upstreamMedia: "image/jpeg" | "image/png" =
      mediaType === "image/png" ? "image/png" : "image/jpeg";

    const result = await postAnalyzeSkin(token, imageBase64, upstreamMedia, {
      fastApiUrl: context.env.FASTAPI_URL,
      request,
    });

    const headers = new Headers({ "Content-Type": "application/json" });
    if (setCookie) headers.append("Set-Cookie", setCookie);
    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch (err) {
    if (err instanceof FastApiError) {
      if (err.status === 401) {
        return jsonError(401, "AI session expired — please refresh.");
      }
      return jsonError(err.status, err.message);
    }
    return jsonError(502, "Skin analysis service is unavailable.");
  }
}

/** GET on a POST-only resource route → 405. */
export function loader() {
  return new Response("Method Not Allowed", { status: 405 });
}