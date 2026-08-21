// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handler } from "./index.ts";

// ---------------------------------------------------------------------------
// Test harness — no real network, no real cache, fast deterministic runs.
//
// `handler` is exported from index.ts (serve() only starts when the file is
// run directly, so importing it here is side-effect free). We stub out fetch,
// Deno.resolveDns, and clear the UPSTASH credentials so every request skips
// the Redis cache entirely.
// ---------------------------------------------------------------------------

const PUBLIC_IP = "93.184.216.34";

function stubResolveDns(impl?: () => Promise<string[]>): void {
  Deno.resolveDns = impl ?? (async () => [PUBLIC_IP]);
}

function htmlResponse(html: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...headers },
  });
}

let fetchCalls: string[] = [];

function installFetch(impl: (input: unknown, init?: RequestInit) => unknown): void {
  fetchCalls = [];
  globalThis.fetch = (input: unknown, init?: RequestInit) => {
    fetchCalls.push(String(input));
    return Promise.resolve(impl(input, init));
  };
}

function setup(env: Record<string, string> = {}): void {
  Deno.env.set("UPSTASH_REDIS_REST_URL", "");
  Deno.env.set("UPSTASH_REDIS_REST_TOKEN", "");
  Deno.env.set("LINK_PREVIEW_TIMEOUT_MS", "3000");
  for (const [key, value] of Object.entries(env)) Deno.env.set(key, value);
  stubResolveDns();
  installFetch(() => htmlResponse("<html><title>ok</title></html>"));
}

function post(url: string): Request {
  return new Request("http://localhost:8000/link-preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

// ---------------------------------------------------------------------------
// Method / CORS routing
// ---------------------------------------------------------------------------

Deno.test("link-preview - OPTIONS returns CORS headers", async () => {
  setup();
  const res = await handler(
    new Request("http://localhost:8000/link-preview", { method: "OPTIONS" }),
  );
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("link-preview - unsupported methods return 405", async () => {
  setup();
  const res = await handler(new Request("http://localhost:8000/link-preview", { method: "PUT" }));
  assertEquals(res.status, 405);
});

// ---------------------------------------------------------------------------
// Happy paths (POST + GET)
// ---------------------------------------------------------------------------

Deno.test("link-preview - POST extracts OG metadata and caches as MISS", async () => {
  setup();
  const html =
    `<!DOCTYPE html><html><head>` +
    `<meta property="og:title" content="Example" />` +
    `<meta property="og:description" content="An example page" />` +
    `<meta property="og:image" content="https://example.com/img.png" />` +
    `<title>Fallback Title</title>` +
    `</head><body></body></html>`;
  installFetch(() => htmlResponse(html));

  const res = await handler(post("https://example.com"));

  assertEquals(res.status, 200);
  assertEquals(res.headers.get("X-Cache"), "MISS");
  const data = await res.json();
  assertEquals(data.url, "https://example.com/");
  assertEquals(data.title, "Example");
  assertEquals(data.description, "An example page");
  assertEquals(data.image, "https://example.com/img.png");
  assertEquals(data.favicon, "https://example.com/favicon.ico");
  assertEquals(fetchCalls.length, 1);
});

Deno.test("link-preview - GET ?url= returns the same data", async () => {
  setup();
  installFetch(() =>
    htmlResponse('<meta property="og:title" content="Via GET" /><title>t</title>'),
  );

  const req = new Request("http://localhost:8000/link-preview?url=https%3A%2F%2Fapple.com", {
    method: "GET",
  });
  const res = await handler(req);

  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.title, "Via GET");
  assertEquals(data.url, "https://apple.com/");
  assertEquals(fetchCalls.length, 1);
  assertEquals(fetchCalls[0], "https://apple.com/");
});

Deno.test("link-preview - GET without url returns 400", async () => {
  setup();
  const res = await handler(new Request("http://localhost:8000/link-preview", { method: "GET" }));
  assertEquals(res.status, 400);
  assertEquals(fetchCalls.length, 0);
});

Deno.test("link-preview - POST with invalid URL returns 400", async () => {
  setup();
  const res = await handler(post("not-a-url"));
  assertEquals(res.status, 400);
  assertEquals(fetchCalls.length, 0);
});

Deno.test("link-preview - POST with extra body keys is rejected (strict schema)", async () => {
  setup();
  const req = new Request("http://localhost:8000/link-preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: "https://example.com", sneaky: true }),
  });
  const res = await handler(req);
  assertEquals(res.status, 400);
  assertEquals(fetchCalls.length, 0);
});

Deno.test("link-preview - non-http(s) protocols are rejected", async () => {
  setup();
  const res = await handler(post("ftp://example.com/file"));
  assertEquals(res.status, 400);
  assertEquals(fetchCalls.length, 0);
});

// ---------------------------------------------------------------------------
// SSRF protection — 403 BEFORE any fetch
// ---------------------------------------------------------------------------

const SSRF_TARGETS = [
  "http://localhost:5432",
  "http://127.0.0.1:80",
  "http://169.254.169.254/latest/meta-data",
  "http://10.0.0.5",
  "http://192.168.1.1",
  "http://172.16.0.1",
];

for (const target of SSRF_TARGETS) {
  Deno.test(`link-preview - rejects ${target} with 403 without fetching`, async () => {
    setup();
    const res = await handler(post(target));
    assertEquals(res.status, 403);
    assertEquals(fetchCalls.length, 0);
  });
}

Deno.test("link-preview - rejects a hostname that resolves to a private IP", async () => {
  setup();
  stubResolveDns(async () => ["127.0.0.1"]);
  const res = await handler(post("https://ssrf.example.com"));
  assertEquals(res.status, 403);
  assertEquals(fetchCalls.length, 0);
});

// ---------------------------------------------------------------------------
// Redirect handling — every hop re-validated
// ---------------------------------------------------------------------------

Deno.test("link-preview - blocks a redirect to an internal address", async () => {
  setup();
  installFetch(
    () =>
      new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data" },
      }),
  );

  const res = await handler(post("https://redirect.example.com/start"));

  assertEquals(res.status, 403);
  // Only the first hop was fetched; the internal target was validated, never fetched.
  assertEquals(fetchCalls.length, 1);
});

Deno.test("link-preview - follows redirects to public targets", async () => {
  setup();
  let call = 0;
  installFetch(() => {
    call++;
    if (call === 1) {
      return new Response(null, { status: 302, headers: { location: "/final" } });
    }
    return htmlResponse('<meta property="og:title" content="Final Page" /><title>t</title>');
  });

  const res = await handler(post("https://example.com/start"));

  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.title, "Final Page");
  assertEquals(fetchCalls.length, 2);
});

// ---------------------------------------------------------------------------
// Response shaping / limits
// ---------------------------------------------------------------------------

Deno.test("link-preview - rejects non-HTML content types before streaming", async () => {
  setup();
  installFetch(() => new Response("not html", { headers: { "content-type": "application/pdf" } }));
  const res = await handler(post("https://example.com/huge.pdf"));
  assertEquals(res.status, 415);
  assertEquals(fetchCalls.length, 1);
});

Deno.test("link-preview - aborts oversized HTML bodies with 413", async () => {
  setup();
  installFetch(() => htmlResponse("x".repeat(250_000)));
  const res = await handler(post("https://example.com/giant.html"));
  assertEquals(res.status, 413);
});

Deno.test("link-preview - returns 422 when no OG metadata is present", async () => {
  setup();
  installFetch(() => htmlResponse("<html><body><p>plain page</p></body></html>"));
  const res = await handler(post("https://example.com/plain"));
  assertEquals(res.status, 422);
});

Deno.test("link-preview - returns 502 when the remote page errors", async () => {
  setup();
  installFetch(() => new Response("server error", { status: 500 }));
  const res = await handler(post("https://example.com/broken"));
  assertEquals(res.status, 502);
});

Deno.test("link-preview - aborts hanging requests with 504 after the timeout", async () => {
  setup({ LINK_PREVIEW_TIMEOUT_MS: "50" });
  installFetch(
    (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      }),
  );

  const res = await handler(post("https://slow.example.com"));

  assertEquals(res.status, 504);
});

// ---------------------------------------------------------------------------
// Defensive path — DNS resolution unavailable should not break the endpoint
// ---------------------------------------------------------------------------

Deno.test("link-preview - still works when DNS resolution is unavailable", async () => {
  setup();
  stubResolveDns(async () => {
    throw new Error("resolveDns not supported");
  });
  installFetch(() => htmlResponse('<meta property="og:title" content="ok" /><title>t</title>'));

  const res = await handler(post("https://example.com"));

  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.title, "ok");
});
