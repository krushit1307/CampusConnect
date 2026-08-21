import type { Request, Response, NextFunction } from "express";

/**
 * Middleware to enforce strict Content-Type validation on POST, PUT, and PATCH requests.
 * Instant rejection of non-JSON requests protects against injection and CSRF vectors.
 */
export function requireJsonContent(
  req: Request,
  res: Response,
  next: NextFunction,
): void | Response {
  // Enforce X-Content-Type-Options: nosniff globally on API responses
  res.setHeader("X-Content-Type-Options", "nosniff");

  const method = req.method.toUpperCase();
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    const contentType = req.headers["content-type"];

    // Exclude file upload endpoints requiring multipart/form-data (if any exist)
    if (contentType && contentType.includes("multipart/form-data")) {
      return next();
    }

    // Safely allow JSON and standard variants (including charset suffixes like application/json; charset=utf-8)
    const isJson =
      contentType &&
      (contentType.includes("application/json") ||
        contentType.includes("application/activity+json") ||
        contentType.includes("application/ld+json"));

    if (!isJson) {
      return res.status(415).json({
        error: "Unsupported Media Type: Server requires application/json",
      });
    }
  }

  next();
}
