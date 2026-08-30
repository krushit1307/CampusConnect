// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handler } from "./index.ts";

// Set environment variables for the test
Deno.env.set("SUPABASE_URL", "https://mockproject.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
Deno.env.set("REGISTRAR_SIS_API_URL", "https://sis-api.university.edu/sis/credentials");

Deno.test("export-micro-credentials - handles OPTIONS CORS preflight", async () => {
  const req = new Request("http://localhost:8000/export-micro-credentials", {
    method: "OPTIONS",
  });
  const res = await handler(req);
  assertEquals(res.status, 200);
});

Deno.test("export-micro-credentials - outputs empty state if no credentials ready", async () => {
  const originalFetch = globalThis.fetch;
  
  // Mock fetch to return empty database results
  globalThis.fetch = async (url: string | URL, init?: RequestInit) => {
    const urlStr = url.toString();
    if (urlStr.includes("/rest/v1/issued_certificates")) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("Not found", { status: 404 });
  };

  try {
    const req = new Request("http://localhost:8000/export-micro-credentials", {
      method: "POST",
    });
    const res = await handler(req);
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data.message, "No new micro-credentials to export");
    assertEquals(data.count, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("export-micro-credentials - exports Workday JSON payload and stamps exported time", async () => {
  const originalFetch = globalThis.fetch;
  Deno.env.set("REGISTRAR_SIS_FORMAT", "json");

  let registrarPayload: any = null;
  let updatePerformed = false;

  globalThis.fetch = async (url: string | URL, init?: RequestInit) => {
    const urlStr = url.toString();
    
    // 1. Mock select issued_certificates
    if (urlStr.includes("/rest/v1/issued_certificates") && init?.method === "GET") {
      return new Response(
        JSON.stringify([
          {
            id: "cert-uuid-1",
            certificate_number: "CERT-BUS-1",
            issued_at: "2026-08-20T10:00:00Z",
            user_id: "user-uuid-1",
            series_id: "series-uuid-1",
            event_series: {
              id: "series-uuid-1",
              title: "Business Bootcamp",
              is_credit_eligible: true,
            },
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    // 2. Mock select profiles
    if (urlStr.includes("/rest/v1/profiles") && init?.method === "GET") {
      return new Response(
        JSON.stringify([
          {
            id: "user-uuid-1",
            full_name: "Alex Business student",
            email: "alex@thapar.edu",
            student_id: "STD-202488",
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    // 3. Mock Registrar SIS Post
    if (urlStr.includes("/sis/credentials") && init?.method === "POST") {
      registrarPayload = JSON.parse(init.body as string);
      return new Response(JSON.stringify({ status: "success" }), { status: 200 });
    }

    // 4. Mock update/patch issued_certificates
    if (urlStr.includes("/rest/v1/issued_certificates") && init?.method === "PATCH") {
      updatePerformed = true;
      return new Response(JSON.stringify({}), { status: 200 });
    }

    return new Response("Mock error", { status: 500 });
  };

  try {
    const req = new Request("http://localhost:8000/export-micro-credentials", {
      method: "POST",
    });
    const res = await handler(req);
    assertEquals(res.status, 200);

    const data = await res.json();
    assertEquals(data.success, true);
    assertEquals(data.exported_count, 1);
    assertEquals(data.format, "json");

    // Verify workday payload format
    assertEquals(registrarPayload.source, "CampusConnect");
    assertEquals(registrarPayload.completions.length, 1);
    assertEquals(registrarPayload.completions[0].studentReference.id, "STD-202488");
    assertEquals(registrarPayload.completions[0].studentReference.email, "alex@thapar.edu");
    assertEquals(registrarPayload.completions[0].courseTitle, "Business Bootcamp");
    assertEquals(registrarPayload.completions[0].creditValue, 0.5);

    // Verify DB update happened
    assertEquals(updatePerformed, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("export-micro-credentials - exports Ellucian Banner XML payload", async () => {
  const originalFetch = globalThis.fetch;
  Deno.env.set("REGISTRAR_SIS_FORMAT", "xml");

  let registrarPayload: any = null;

  globalThis.fetch = async (url: string | URL, init?: RequestInit) => {
    const urlStr = url.toString();
    
    if (urlStr.includes("/rest/v1/issued_certificates") && init?.method === "GET") {
      return new Response(
        JSON.stringify([
          {
            id: "cert-uuid-2",
            certificate_number: "CERT-BUS-2",
            issued_at: "2026-08-20T10:00:00Z",
            user_id: "user-uuid-2",
            series_id: "series-uuid-2",
            event_series: {
              id: "series-uuid-2",
              title: "Accounting bootcamp",
              is_credit_eligible: true,
            },
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (urlStr.includes("/rest/v1/profiles") && init?.method === "GET") {
      return new Response(
        JSON.stringify([
          {
            id: "user-uuid-2",
            full_name: "Sam Business Student",
            email: "sam@thapar.edu",
            student_id: "STD-202489",
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (urlStr.includes("/sis/credentials") && init?.method === "POST") {
      registrarPayload = init.body as string;
      return new Response("XML OK", { status: 200 });
    }

    if (urlStr.includes("/rest/v1/issued_certificates") && init?.method === "PATCH") {
      return new Response(JSON.stringify({}), { status: 200 });
    }

    return new Response("Mock error", { status: 500 });
  };

  try {
    const req = new Request("http://localhost:8000/export-micro-credentials", {
      method: "POST",
    });
    const res = await handler(req);
    assertEquals(res.status, 200);

    const data = await res.json();
    assertEquals(data.success, true);
    assertEquals(data.exported_count, 1);
    assertEquals(data.format, "xml");

    // Verify XML format and tags
    assertEquals(registrarPayload.includes("<sisEnrollmentExport>"), true);
    assertEquals(registrarPayload.includes("<studentId>STD-202489</studentId>"), true);
    assertEquals(registrarPayload.includes("<email>sam@thapar.edu</email>"), true);
    assertEquals(registrarPayload.includes("<title>Accounting bootcamp</title>"), true);
    assertEquals(registrarPayload.includes("<creditUnits>0.5</creditUnits>"), true);
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.set("REGISTRAR_SIS_FORMAT", "json");
  }
});
