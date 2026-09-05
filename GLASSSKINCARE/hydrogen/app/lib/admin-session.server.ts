/**
 * Admin session cookie storage.
 *
 * Holds the FastAPI `/auth/admin-login` JWT in a signed httpOnly cookie so
 * server loaders/actions can verify admin status without exposing the
 * token to client JS. Mirrors the shape of `ai-session.ts` so callers can
 * copy/paste patterns across.
 *
 * The cookie secret is provided explicitly by the caller (loaders have
 * access to `context.env.SESSION_SECRET`). Helpers without the explicit
 * `WithSecret` suffix fall back to `process.env.SESSION_SECRET`.
 *
 * Cookie: __glass_admin_session
 *   - httpOnly           — JS can't read it (XSS-safe)
 *   - secure (prod)      — HTTPS only
 *   - sameSite=lax       — survives top-level navigations, blocks CSRF on POST
 *   - signed             — Remix cookie session w/ HMAC
 *   - default maxAge=8h  — admin tokens are short-lived; reload to refresh
 */
import { createCookieSessionStorage } from "@shopify/remix-oxygen";

const COOKIE_NAME = "__glass_admin_session";
const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

type AdminSessionData = {
  jwt?: string;
};

function getStorage(secret: string) {
  return createCookieSessionStorage<AdminSessionData>({
    cookie: {
      name: COOKIE_NAME,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      secrets: [secret],
      // 8h default — admin tokens expire faster than the long-lived
      // store session. Override per-write via the returned Set-Cookie.
      maxAge: DEFAULT_MAX_AGE_SECONDS,
    },
  });
}

function fallbackSecret(): string {
  return process.env.SESSION_SECRET ?? "";
}

/**
 * Returns the stored admin JWT, or null if not present / no secret.
 * Reads SESSION_SECRET from process.env. For loader/action use, prefer
 * `getAdminJwtWithSecret(request, context.env.SESSION_SECRET)`.
 */
export async function getAdminJwt(request: Request): Promise<string | null> {
  const sessionSecret = fallbackSecret();
  if (!sessionSecret) return null;
  return getAdminJwtWithSecret(request, sessionSecret);
}

/**
 * Build a Set-Cookie header that stores the admin JWT for `expiresIn` seconds.
 * Caller is responsible for attaching it to their Response.
 */
export async function setAdminJwt(
  jwt: string,
  expiresIn: number,
): Promise<string> {
  const sessionSecret = fallbackSecret();
  if (!sessionSecret) {
    throw new Error(
      "setAdminJwt: SESSION_SECRET is required to sign the admin session cookie.",
    );
  }
  return setAdminJwtWithSecret(jwt, expiresIn, sessionSecret);
}

/**
 * Build a Set-Cookie header that clears the admin session cookie immediately.
 */
export async function clearAdminJwt(): Promise<string> {
  const sessionSecret = fallbackSecret();
  if (!sessionSecret) {
    throw new Error(
      "clearAdminJwt: SESSION_SECRET is required to clear the admin session cookie.",
    );
  }
  return clearAdminJwtWithSecret(sessionSecret);
}

/**
 * Loader/action-safe reader that uses the explicit session secret.
 */
export async function getAdminJwtWithSecret(
  request: Request,
  sessionSecret: string,
): Promise<string | null> {
  if (!sessionSecret) return null;
  const storage = getStorage(sessionSecret);
  const session = await storage.getSession(request.headers.get("Cookie"));
  const jwt = session.get("jwt");
  return typeof jwt === "string" && jwt.length > 0 ? jwt : null;
}

export async function setAdminJwtWithSecret(
  jwt: string,
  expiresIn: number,
  sessionSecret: string,
): Promise<string> {
  if (!sessionSecret) {
    throw new Error(
      "setAdminJwtWithSecret: sessionSecret is required to sign the admin session cookie.",
    );
  }
  const storage = getStorage(sessionSecret);
  const session = await storage.getSession();
  session.set("jwt", jwt);
  return storage.commitSession(session, {
    maxAge: Math.max(1, Math.floor(expiresIn)),
  });
}

export async function clearAdminJwtWithSecret(
  sessionSecret: string,
): Promise<string> {
  if (!sessionSecret) {
    throw new Error(
      "clearAdminJwtWithSecret: sessionSecret is required to clear the admin session cookie.",
    );
  }
  const storage = getStorage(sessionSecret);
  const session = await storage.getSession();
  return storage.destroySession(session);
}