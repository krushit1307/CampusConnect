import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Redis } from "npm:@upstash/redis";
import { z } from "https://esm.sh/zod@3.24.2";
import { corsHeaders, parseJsonBody } from "../_shared/validation.ts";

// ---------------------------------------------------------------------------
// SSRF protection
//
// An unvalidated link-preview proxy lets an attacker make the edge runtime
// fetch internal addresses (localhost, 169.254.169.254 AWS metadata, private
// subnets) and use it as a port scanner. Every target host is validated
// before a single byte is fetched, and redirect targets are re-validated on
// every hop (a hostile site could otherwise redirect to an internal IP).
// ---------------------------------------------------------------------------

/** Thrown when the target host is explicitly private/local/reserved. Maps to 403. */
class SsrFBlockedError extends Error {}

function isPrivateIp(rawIp: string): boolean {
  const ip = rawIp.replace(/^\[|\]$/g, "").replace(/^::ffff:/i, "");
  if (ip.includes(":")) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    // Unique local addresses (fc00::/7)
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    // Link-local (fe80::/10)
    if (
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb")
    )
      return true;
    return false;
  }
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local / AWS metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  return false;
}

async function assertHostIsPublic(parsedUrl: URL): Promise<void> {
  const hostname = parsedUrl.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname) throw new SsrFBlockedError("SSRF: empty host.");
  if (isPrivateIp(hostname)) {
    throw new SsrFBlockedError(`SSRF: "${hostname}" is a private IP address.`);
  }
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new SsrFBlockedError(`SSRF: "${hostname}" is a local/internal address.`);
  }

  // Defense in depth: resolve the hostname and reject it if ANY record points
  // to a private/reserved IP (covers DNS-rebinding and split-horizon setups).
  if (typeof Deno.resolveDns === "function") {
    let records: string[] = [];
    try {
      const [a, aaaa] = await Promise.all([
        Deno.resolveDns(hostname, "A").catch(() => [] as string[]),
        Deno.resolveDns(hostname, "AAAA").catch(() => [] as string[]),
      ]);
      records = [...a, ...aaaa];
    } catch {
      // Runtime without DNS resolution support (or transient failure) — the
      // direct-IP checks above still apply, so proceed to the fetch.
    }
    for (const ip of records) {
      if (isPrivateIp(ip)) {
        throw new SsrFBlockedError(`SSRF: "${hostname}" resolves to private IP "${ip}".`);
      }
    }
  }
}

/**
 * Fetch a URL with SSRF-safe redirect handling. `redirect: "manual"` means we
 * never let the fetch follow a Location header blindly — each hop is resolved
 * and validated against the private-IP rules before the next request is made.
 */
async function fetchWithRedirectValidation(
  startUrl: string,
  init: RequestInit,
  signal: AbortSignal,
): Promise<Response> {
  const MAX_REDIRECTS = 5;
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertHostIsPublic(new URL(current));
    const response = await fetch(current, { ...init, signal, redirect: "manual" });
    if (response.status >= 300 && response.status < 400 && response.headers.has("location")) {
      const location = response.headers.get("location")!;
      current = new URL(location, current).toString();
      await response.body?.cancel().catch(() => {});
      continue;
    }
    return response;
  }
  throw new Error("Too many redirects.");
}

// ---------------------------------------------------------------------------
// OG metadata extraction
// ---------------------------------------------------------------------------

interface OgData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .trim();
}

function extractOgMetadata(html: string, baseUrl: URL): OgData {
  const metadata: Partial<OgData> = {};
  const metaRegex =
    /<meta\s+[^>]*\b(?:property|name)\s*=\s*["']og:(title|description|image)["'][^>]*>/gi;
  let match;
  while ((match = metaRegex.exec(html)) !== null) {
    const prop = match[1].toLowerCase();
    const cm = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(match[0]);
    if (cm) {
      if (prop === "title" && !metadata.title) metadata.title = decodeHtmlEntities(cm[1]);
      else if (prop === "description" && !metadata.description)
        metadata.description = decodeHtmlEntities(cm[1]);
      else if (prop === "image" && !metadata.image) {
        // Resolve relative images and reject non-http(s) schemes so the value
        // is safe to render in an <img> tag.
        try {
          const imageUrl = new URL(cm[1].trim(), baseUrl);
          if (imageUrl.protocol === "http:" || imageUrl.protocol === "https:") {
            metadata.image = imageUrl.toString();
          }
        } catch {
          /* ignore malformed URLs */
        }
      }
    }
  }
  if (!metadata.title) {
    const tm = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
    if (tm) metadata.title = decodeHtmlEntities(tm[1]);
  }
  if (!metadata.description) {
    const dm = /<meta\s+[^>]*\bname\s*=\s*["']description["'][^>]*>/gi.exec(html);
    if (dm) {
      const cm = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(dm[0]);
      if (cm) metadata.description = decodeHtmlEntities(cm[1]);
    }
  }
  const fm = /<link[^>]+\brel\s*=\s*["'][^"']*icon[^"']*["'][^>]*>/gi.exec(html);
  if (fm) {
    const hm = /\bhref\s*=\s*["']([^"']*)["']/i.exec(fm[0]);
    if (hm) {
      try {
        metadata.favicon = new URL(hm[1], baseUrl.origin).toString();
      } catch {
        /* ignore */
      }
    }
  }
  if (!metadata.favicon) metadata.favicon = `${baseUrl.origin}/favicon.ico`;
  return { url: baseUrl.toString(), ...metadata };
}

// ---------------------------------------------------------------------------
// Redis cache — 24 h TTL (lazily constructed so cache is a no-op without
// UPSTASH credentials, which also keeps the function testable in isolation).
// ---------------------------------------------------------------------------

const CACHE_TTL_SECONDS = 60 * 60 * 24;

let _redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  const url = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
  _redis = url && token ? new Redis({ url, token }) : null;
  return _redis;
}

function makeCacheKey(url: string): string {
  return `og:v2:${btoa(unescape(encodeURIComponent(url)))
    .replace(/[^a-zA-Z0-9]/g, "_")
    .slice(0, 220)}`;
}

async function getCached(url: string): Promise<OgData | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    const raw = await client.get<string>(makeCacheKey(url));
    if (!raw) return null;
    return JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)) as OgData;
  } catch {
    return null;
  }
}

async function setCached(url: string, data: OgData): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    await client.set(makeCacheKey(url), JSON.stringify(data), { ex: CACHE_TTL_SECONDS });
  } catch {
    /* non-fatal */
  }
}

// ---------------------------------------------------------------------------
// Fetch limits
// ---------------------------------------------------------------------------

/** Overall deadline for connect + headers + body. The issue mandates 3000ms. */
const DEFAULT_TIMEOUT_MS = 3000;

/** Abort the body stream once it exceeds this many bytes (2 MB cap per issue, tighter here). */
const MAX_RESPONSE_BYTES = 200_000;

/** Thrown when the response body exceeds MAX_RESPONSE_BYTES. Maps to 413. */
class OversizeError extends Error {}

async function readHtmlWithLimit(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    total += value.byteLength;
    if (total > maxBytes) {
      // Abort the stream entirely instead of buffering a massive download.
      await reader.cancel().catch(() => {});
      throw new OversizeError("Response body exceeds the size limit.");
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const RequestSchema = z.object({ url: z.string().url("Must be a valid URL") }).strict();

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Accept both GET /link-preview?url=... and POST { url } so the endpoint is
  // easy to call from any client while keeping the existing frontend working.
  let rawUrl: string;
  if (req.method === "GET") {
    const candidate = new URL(req.url).searchParams.get("url") ?? undefined;
    const result = RequestSchema.safeParse({ url: candidate });
    if (!result.success) {
      return jsonResponse(
        { error: "Invalid request body", fields: { url: ["Must be a valid URL"] } },
        400,
      );
    }
    rawUrl = result.data.url;
  } else if (req.method === "POST") {
    const parsed = await parseJsonBody(RequestSchema, req);
    if (!parsed.ok) return parsed.response;
    rawUrl = parsed.data.url;
  } else {
    return jsonResponse({ error: "Method not allowed. Use GET or POST." }, 405);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") throw new Error();
  } catch {
    return jsonResponse({ error: "Invalid URL format or unsupported protocol." }, 400);
  }

  // SSRF guard — reject internal targets with 403 BEFORE any fetch or cache hit.
  try {
    await assertHostIsPublic(parsedUrl);
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 403);
  }

  // Cache check
  const cached = await getCached(rawUrl);
  if (cached) {
    return jsonResponse(cached, 200, { "X-Cache": "HIT" });
  }

  // Fetch with SSRF-safe redirects and a hard deadline.
  const timeoutMs = Number(Deno.env.get("LINK_PREVIEW_TIMEOUT_MS") ?? DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchWithRedirectValidation(
      parsedUrl.toString(),
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; CampusConnectBot/1.0; +https://campusconnect.app/bot)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      },
      controller.signal,
    );

    // Reject non-HTML responses before streaming their body (e.g. a 10 GB PDF).
    const mediaType = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (mediaType !== "text/html" && mediaType !== "application/xhtml+xml") {
      await response.body?.cancel().catch(() => {});
      return jsonResponse(
        { error: `Unsupported content type "${mediaType || "unknown"}". Expected text/html.` },
        415,
      );
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return jsonResponse({ error: `Remote page returned HTTP ${response.status}.` }, 502);
    }

    const html = await readHtmlWithLimit(response, MAX_RESPONSE_BYTES);
    const data = extractOgMetadata(html, parsedUrl);
    if (!data.title && !data.description && !data.image) {
      return jsonResponse({ error: "No OpenGraph metadata found on the target page." }, 422);
    }

    await setCached(rawUrl, data);

    return jsonResponse(data, 200, { "X-Cache": "MISS" });
  } catch (err) {
    if (err instanceof SsrFBlockedError) return jsonResponse({ error: err.message }, 403);
    if (err instanceof OversizeError) {
      return jsonResponse({ error: "Response body exceeds the size limit." }, 413);
    }
    if (err instanceof DOMException && err.name === "AbortError") {
      return jsonResponse({ error: "Request timed out fetching the URL." }, 504);
    }
    if (err instanceof Error && err.message.startsWith("SSRF:")) {
      return jsonResponse({ error: err.message }, 403);
    }
    return jsonResponse({ error: `Network error: ${(err as Error).message}` }, 502);
  } finally {
    clearTimeout(timeoutId);
  }
}

if (import.meta.main) {
  serve(handler);
}
