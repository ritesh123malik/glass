/**
 * AI session cookie storage.
 *
 * Holds the FastAPI `/ai/session-token` in an httpOnly signed cookie so
 * anonymous browsers can hit chat / quiz endpoints without exposing the
 * token to client JS. Reads return null when absent; writes return
 * the Set-Cookie header string for callers to attach to a Response.
 *
 * The cookie secret is provided explicitly by the caller (loaders have
 * access to `context.env.SESSION_SECRET`). Helpers without the explicit
 * `WithSecret` suffix fall back to `process.env.SESSION_SECRET` for
 * cases where the caller doesn't have the env handy.
 */
import { createCookieSessionStorage } from "@shopify/remix-oxygen";

const COOKIE_NAME = "__glass_ai_session";
const DEFAULT_MAX_AGE_SECONDS = 60 * 15; // 15 min, matches FastAPI TTL

type AiSessionData = {
  token?: string;
};

function getStorage(secret: string) {
  return createCookieSessionStorage<AiSessionData>({
    cookie: {
      name: COOKIE_NAME,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      secrets: [secret],
      // Cookie expires same length as FastAPI token TTL by default.
      // setAiToken() can override per-token via the returned Set-Cookie.
      maxAge: DEFAULT_MAX_AGE_SECONDS,
    },
  });
}

function fallbackSecret(): string {
  return process.env.SESSION_SECRET ?? "";
}

/**
 * Returns the stored AI session token, or null if not present.
 * Reads SESSION_SECRET from process.env. For loader/action use, prefer
 * `getAiTokenWithSecret(request, context.env.SESSION_SECRET)`.
 */
export async function getAiToken(request: Request): Promise<string | null> {
  const sessionSecret = fallbackSecret();
  if (!sessionSecret) return null;
  return getAiTokenWithSecret(request, sessionSecret);
}

/**
 * Build a Set-Cookie header that stores the token for `expiresIn` seconds.
 * Caller is responsible for attaching it to their Response.
 */
export async function setAiToken(
  token: string,
  expiresIn: number,
): Promise<string> {
  const sessionSecret = fallbackSecret();
  if (!sessionSecret) {
    throw new Error(
      "setAiToken: SESSION_SECRET is required to sign the AI session cookie.",
    );
  }
  return setAiTokenWithSecret(token, expiresIn, sessionSecret);
}

/**
 * Build a Set-Cookie header that clears the session cookie immediately.
 */
export async function clearAiToken(): Promise<string> {
  const sessionSecret = fallbackSecret();
  if (!sessionSecret) {
    throw new Error(
      "clearAiToken: SESSION_SECRET is required to clear the AI session cookie.",
    );
  }
  return clearAiTokenWithSecret(sessionSecret);
}

/**
 * Loader/action-safe reader that uses the explicit session secret.
 */
export async function getAiTokenWithSecret(
  request: Request,
  sessionSecret: string,
): Promise<string | null> {
  if (!sessionSecret) return null;
  const storage = getStorage(sessionSecret);
  const session = await storage.getSession(request.headers.get("Cookie"));
  const token = session.get("token");
  return typeof token === "string" && token.length > 0 ? token : null;
}

export async function setAiTokenWithSecret(
  token: string,
  expiresIn: number,
  sessionSecret: string,
): Promise<string> {
  if (!sessionSecret) {
    throw new Error(
      "setAiTokenWithSecret: sessionSecret is required to sign the AI session cookie.",
    );
  }
  const storage = getStorage(sessionSecret);
  const session = await storage.getSession();
  session.set("token", token);
  return storage.commitSession(session, {
    maxAge: Math.max(1, Math.floor(expiresIn)),
  });
}

export async function clearAiTokenWithSecret(
  sessionSecret: string,
): Promise<string> {
  if (!sessionSecret) {
    throw new Error(
      "clearAiTokenWithSecret: sessionSecret is required to clear the AI session cookie.",
    );
  }
  const storage = getStorage(sessionSecret);
  const session = await storage.getSession();
  return storage.destroySession(session);
}
