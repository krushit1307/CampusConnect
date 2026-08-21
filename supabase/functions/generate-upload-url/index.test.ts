// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handler } from "./index.ts";

const originalFetch = globalThis.fetch;

// Stub the Supabase API (auth + storage signed-URL creation) so tests run
// without any network access.
function stubSupabaseApi() {
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();

    if (url.includes("/auth/v1/user")) {
      return new Response(JSON.stringify({ user: { id: "user-123", email: "test@example.com" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/storage/v1/object/upload/sign/")) {
      const bucket = url.split("/storage/v1/object/upload/sign/")[1].split("/")[0];
      const signedUrl = `https://mock.supabase.co/storage/v1/object/upload/sign/${url.split("/storage/v1/object/upload/sign/")[1]}?token=mock-token`;
      return new Response(
        JSON.stringify({
          signedUrl,
          token: "mock-token",
          path: url.split("object/upload/sign/")[1],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Not mocked" }), { status: 404 });
  };
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

function authHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: "Bearer mock-jwt",
  };
}

Deno.env.set("SUPABASE_URL", "https://mock.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");

Deno.test("generate-upload-url - handles OPTIONS request for CORS", async () => {
  const req = new Request("http://localhost:8000/generate-upload-url", { method: "OPTIONS" });
  const response = await handler(req);
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("generate-upload-url - missing authorization returns 401", async () => {
  stubSupabaseApi();
  try {
    const req = new Request("http://localhost:8000/generate-upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket: "avatars",
        path: "user-123/photo.jpg",
        contentType: "image/jpeg",
        size: 1000,
      }),
    });
    const response = await handler(req);
    assertEquals(response.status, 401);
    const data = await response.json();
    assertEquals(data.error, "Unauthorized");
  } finally {
    restoreFetch();
  }
});

Deno.test("generate-upload-url - rejects non-POST methods", async () => {
  stubSupabaseApi();
  try {
    const req = new Request("http://localhost:8000/generate-upload-url", {
      method: "GET",
      headers: authHeaders(),
    });
    const response = await handler(req);
    assertEquals(response.status, 405);
  } finally {
    restoreFetch();
  }
});

Deno.test("generate-upload-url - rejects a disallowed bucket", async () => {
  stubSupabaseApi();
  try {
    const req = new Request("http://localhost:8000/generate-upload-url", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        bucket: "club-documents",
        path: "file.pdf",
        contentType: "image/png",
        size: 1000,
      }),
    });
    const response = await handler(req);
    assertEquals(response.status, 400);
    const data = await response.json();
    assertEquals(data.error, "Bucket 'club-documents' is not allowed for image uploads");
  } finally {
    restoreFetch();
  }
});

Deno.test("generate-upload-url - rejects non-image content types", async () => {
  stubSupabaseApi();
  try {
    const req = new Request("http://localhost:8000/generate-upload-url", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        bucket: "avatars",
        path: "user-123/notes.txt",
        contentType: "text/plain",
        size: 1000,
      }),
    });
    const response = await handler(req);
    assertEquals(response.status, 400);
    const data = await response.json();
    assertEquals(data.error, "Content type 'text/plain' is not allowed");
  } finally {
    restoreFetch();
  }
});

Deno.test("generate-upload-url - rejects path traversal", async () => {
  stubSupabaseApi();
  try {
    const req = new Request("http://localhost:8000/generate-upload-url", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        bucket: "avatars",
        path: "user-123/../../other-bucket/evil.jpg",
        contentType: "image/jpeg",
        size: 1000,
      }),
    });
    const response = await handler(req);
    assertEquals(response.status, 400);
    const data = await response.json();
    assertEquals(data.error, "Invalid path");
  } finally {
    restoreFetch();
  }
});

Deno.test("generate-upload-url - rejects oversized files", async () => {
  stubSupabaseApi();
  try {
    const req = new Request("http://localhost:8000/generate-upload-url", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        bucket: "avatars",
        path: "user-123/huge.jpg",
        contentType: "image/jpeg",
        size: 16 * 1024 * 1024,
      }),
    });
    const response = await handler(req);
    assertEquals(response.status, 400);
  } finally {
    restoreFetch();
  }
});

Deno.test("generate-upload-url - returns a signed upload URL on success", async () => {
  stubSupabaseApi();
  try {
    const req = new Request("http://localhost:8000/generate-upload-url", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        bucket: "event-gallery",
        path: "event-123/photo.jpg",
        contentType: "image/jpeg",
        size: 5000,
      }),
    });
    const response = await handler(req);
    assertEquals(response.status, 200);
    const data = await response.json();
    assertEquals(data.bucket, "event-gallery");
    assertEquals(data.path, "event-123/photo.jpg");
    assertEquals(data.token, "mock-token");
    assertEquals(data.uploadUrl.includes("/storage/v1/object/upload/sign/event-gallery/"), true);
  } finally {
    restoreFetch();
  }
});
