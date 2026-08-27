// @ts-ignore – Deno global
declare const Deno: { env: { get(key: string): string | undefined } };

// @ts-ignore – Deno npm specifier
import { Redis } from "npm:@upstash/redis";

const url = Deno.env.get("UPSTASH_REDIS_REST_URL");
const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

if (!url || !token) {
  console.warn(
    "[Redis] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set. " +
      "Rate limiting will be skipped (fail-open).",
  );
}

/**
 * Shared Upstash Redis client.
 * Null when environment variables are not configured (e.g. in local dev without Redis).
 */
export const redis: Redis | null = url && token ? new Redis({ url, token }) : null;
