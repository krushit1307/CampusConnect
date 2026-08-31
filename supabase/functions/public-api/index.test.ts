import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handler } from "./index.ts";

Deno.test("public-api handler - serves openapi.json spec", async () => {
  const req = new Request("https://localhost/functions/v1/public-api/openapi.json", {
    method: "GET",
  });

  const res = await handler(req);
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "application/json");
  const data = await res.json();
  assertEquals(data.openapi, "3.0.3");
  assertEquals(data.info.title, "Campus Connect Public REST API");
});

Deno.test("public-api handler - serves Swagger UI HTML", async () => {
  const req = new Request("https://localhost/functions/v1/public-api/docs", {
    method: "GET",
  });

  const res = await handler(req);
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "text/html");
  const body = await res.text();
  assertStringIncludes(body, "SwaggerUIBundle");
});

Deno.test("public-api handler - rejects POST method with 405", async () => {
  const req = new Request("https://localhost/functions/v1/public-api/v1/public/events/upcoming", {
    method: "POST",
  });

  const res = await handler(req);
  assertEquals(res.status, 405);
});
