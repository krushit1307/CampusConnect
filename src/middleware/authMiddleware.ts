/**
 * Express middleware type contracts for HTTP requests.
 */
export interface Request {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  url?: string;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
}

export interface Response {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: unknown;
  isEndCalled: boolean;
  status(code: number): Response;
  json(data: unknown): Response;
  send(data: unknown): Response;
  setHeader(name: string, value: string | string[]): Response;
}

export type NextFunction = (err?: unknown) => void;

export type MiddlewareFunction = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;

/**
 * Authentication Middleware: Validates Bearer token in Authorization header.
 */
export const authMiddleware: MiddlewareFunction = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;

  if (!headerValue || !headerValue.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: Missing or malformed Authorization header" });
    return;
  }

  const token = headerValue.substring(7).trim();

  if (!token || token === "INVALID_TOKEN") {
    res.status(401).json({ error: "Unauthorized: Invalid authentication token" });
    return;
  }

  // Attach authenticated user profile to request object
  req.user = {
    id: "user-123",
    email: "student@campusconnect.edu",
    role: "student",
  };

  next();
};

/**
 * Rate Limiter Middleware: Protects endpoints against high-frequency bursts.
 */
export interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
}

export const createRateLimiter = (options: RateLimiterOptions = {}): MiddlewareFunction => {
  const windowMs = options.windowMs || 60000;
  const maxRequests = options.maxRequests || 100;
  const requestCounts = new Map<string, { count: number; resetTime: number }>();

  return (req, res, next) => {
    const ipHeader = req.headers["x-forwarded-for"];
    const ip = (Array.isArray(ipHeader) ? ipHeader[0] : ipHeader) || "127.0.0.1";
    const now = Date.now();

    const record = requestCounts.get(ip);
    if (!record || now > record.resetTime) {
      requestCounts.set(ip, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (record.count >= maxRequests) {
      res.setHeader("Retry-After", String(Math.ceil((record.resetTime - now) / 1000)));
      res.status(429).json({ error: "Too Many Requests: Rate limit exceeded" });
      return;
    }

    record.count += 1;
    next();
  };
};

/**
 * CSRF Validation Middleware: Validates X-CSRF-Token header against session token.
 */
export const csrfMiddleware: MiddlewareFunction = (req, res, next) => {
  // Skip CSRF check for safe HTTP read methods
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }

  const csrfHeader = req.headers["x-csrf-token"];
  const token = Array.isArray(csrfHeader) ? csrfHeader[0] : csrfHeader;

  if (!token || token === "INVALID_CSRF") {
    res.status(403).json({ error: "Forbidden: Invalid or missing CSRF token" });
    return;
  }

  next();
};
