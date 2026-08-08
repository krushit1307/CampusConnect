import type { Plugin } from "graphql-yoga";
import { logger, redactDeep } from "./logger";

const requestStartTimes = new WeakMap<Request, number>();

function serializeHeaders(headers: Headers): Record<string, unknown> {
  const plainHeaders: Record<string, string> = {};
  headers.forEach((value, key) => {
    plainHeaders[key] = value;
  });
  return redactDeep(plainHeaders);
}

async function serializeBody(request: Request): Promise<unknown> {
  if (!request.body) {
    return undefined;
  }
  try {
    const text = await request.clone().text();
    if (!text) {
      return undefined;
    }
    try {
      return redactDeep(JSON.parse(text));
    } catch {
      return { error: "unparseable body", byte_length: text.length };
    }
  } catch {
    return undefined;
  }
}

export function requestLoggingPlugin(): Plugin {
  return {
    async onRequest({ request, url }) {
      requestStartTimes.set(request, performance.now());
      const body = await serializeBody(request);
      logger.info(
        {
          event: "http_request_start",
          method: request.method,
          url: url.href,
          headers: serializeHeaders(request.headers),
          body,
        },
        "incoming request",
      );
    },
    onResponse({ request, response }) {
      const start = requestStartTimes.get(request) ?? performance.now();
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      logger.info(
        {
          event: "http_response",
          method: request.method,
          url: request.url,
          status: response.status,
          duration_ms: durationMs,
        },
        "request completed",
      );
    },
  };
}
