export const CSRF_COOKIE = "csrf_token";

export function generateCsrfToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));

  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function buildCsrfCookie(token: string): string {
  return [
    `${CSRF_COOKIE}=${token}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    "Max-Age=3600",
  ].join("; ");
}

export function readCookie(req: Request, name: string): string | null {
  const cookie = req.headers.get("Cookie");

  if (!cookie) return null;

  for (const part of cookie.split(";")) {
    const [key, value] = part.trim().split("=");

    if (key === name) return value;
  }

  return null;
}

export function verifyCsrf(req: Request): boolean {
  const cookieToken = readCookie(req, CSRF_COOKIE);

  const headerToken = req.headers.get("X-CSRF-Token") ?? req.headers.get("x-csrf-token");

  if (!cookieToken) return false;

  if (!headerToken) return false;

  return cookieToken === headerToken;
}
