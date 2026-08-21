import type { NextFunction, Request, Response } from "express";
import { logger, redactDeep } from "./logger";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = performance.now();

  const sanitizedHeaders = redactDeep({ ...req.headers });
  const sanitizedBody = redactDeep(req.body);

  res.on("finish", () => {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    logger.info(
      {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration_ms: durationMs,
        headers: sanitizedHeaders,
        body: sanitizedBody,
      },
      "request completed",
    );
  });

  next();
}
