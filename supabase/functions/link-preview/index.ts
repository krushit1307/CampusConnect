import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.24.2";
import { corsHeaders, parseJsonBody } from "../_shared/validation.ts";
import { redis } from "../_shared/redis.ts";

// ---------------------------------------------------------------------------
// SSRF protection
// ---------------------------------------------------------------------------

function isPrivateIp(ip: string): boolean {
  const mapped = ip.replace(/^::ffff:/i, "");
  if (mapped.includes(":")) {
    if (mapped === "::1") return true;
    const lower = mapped.toLowerCase();
    if (lower.startsWith("fe8") || lower.startsWith("fe9") ||
        lower.startsWith("fea") || lower.startsWith("feb")) return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    return false;
  }
  const parts = mapped.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return false;
}

async function assertHostIsPublic(parsedUrl: URL): Promise<void> {
  const hostname = parsedUrl.hostname;
  if (isPrivateIp(hostname)) throw new Error(`SSRF: "${hostname}" is a private IP address.`);
  if (hostname === "localhost" || hostname.endsWith(".local")) {
    throw new Error(`SSRF: "${hostname}" is a local address.`);
  }
  try {
    const aRecords = await Deno.resolveDns(hostname, "A").catch(() => []);
    const aaaaRecords = await Deno.resolveDns(hostname, "AAAA").catch(() => []);
    for (const ip of [...aRecords, ...aaaaRecords]) {
      if (isPrivateIp(ip)) throw new Error(`SSRF: "${hostname}" resolves to private IP "${ip}".`);
    }
  } catch (err) {
    if ((err as Error).message.startsWith("SSRF:")) throw err;
    throw new Error(`SSRF: could not resolve hostname "${hostname}".`);
  }
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
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").trim();
}

function extractOgMetadata(html: string, baseUrl: URL): OgData {
  const metadata: Partial<OgData> = {};
  const metaRegex = /<meta\s+[^>]*\b(?:property|name)\s*=\s*["']og:(title|description|image)["'][^>]*>/gi;
  let match;
  while ((match = metaRegex.exec(html)) !== null) {
    const prop = match[1].toLowerCase();
    const cm = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(match[0]);
    if (cm) {
      if (prop === "title" && !metadata.title) metadata.title = decodeHtmlEntities(cm[1]);
      else if (prop === "description" && !metadata.description) metadata.description = decodeHtmlEntities(cm[1]);
      else if (prop === "image" && !metadata.image) metadata.image = cm[1].trim();
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
      try { metadata.favicon = new URL(hm[1], baseUrl.origin).toString(); } catch { /* ignore */ }
    }
  }
  if (!metadata.favicon) metadata.favicon = `${baseUrl.origin}/favicon.ico`;
  return { url: baseUrl.toString(), ...metadata };
}

// ---------------------------------------------------------------------------
// Redis cache — 24 h TTL
// ---------------------------------------------------------------------------

const CACHE_TTL_SECONDS = 60 * 60 * 24;

function makeCacheKey(url: string): string {
  return `og:v2:${btoa(unescape(encodeURIComponent(url))).replace(/[^a-zA-Z0-9]/g, "_").slice(0, 220)}`;
}

async function getCached(url: string): Promise<OgData | null> {
  try {
    const raw = await redis.get<string>(makeCacheKey(url));
    if (!raw) return null;
    return JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)) as OgData;
  } catch { return null; }
}

async function setCached(url: string, data: OgData): Promise<void> {
  try { await redis.set(makeCacheKey(url), JSON.stringify(data), { ex: CACHE_TTL_SECONDS }); }
  catch { /* non-fatal */ }
}

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const RequestSchema = z.object({ url: z.string().url("Must be a valid URL") }).strict();

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const parsed = await parseJsonBody(RequestSchema, req);
  if (!parsed.ok) return parsed.response;

  const rawUrl = parsed.data.url;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") throw new Error();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid URL format or unsupported protocol." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // SSRF guard
  try { await assertHostIsPublic(parsedUrl); }
  catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Cache check
  const cached = await getCached(rawUrl);
  if (cached) {
    return new Response(JSON.stringify(cached), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" },
    });
  }

  // Fetch (max 200 KB)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  let html = "";

  try {
    const response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CampusConnectBot/1.0; +https://campusconnect.app/bot)",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });
    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Remote page returned HTTP ${response.status}.` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const MAX_BYTES = 200_000;
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      totalBytes += value.byteLength;
      if (totalBytes >= MAX_BYTES) { reader.cancel(); break; }
    }
    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
    html = new TextDecoder().decode(merged);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return new Response(JSON.stringify({ error: "Request timed out fetching the URL." }),
        { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: `Network error: ${(err as Error).message}` }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } finally { clearTimeout(timeoutId); }

  const data = extractOgMetadata(html, parsedUrl);
  if (!data.title && !data.description && !data.image) {
    return new Response(JSON.stringify({ error: "No OpenGraph metadata found on the target page." }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  await setCached(rawUrl, data);

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "MISS" },
  });
});
