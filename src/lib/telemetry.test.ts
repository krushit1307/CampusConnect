import { describe, it, expect } from "vitest";
import {
  initializeTracing,
  getFrontendTracer,
  traceSpan,
  traceInteraction,
  sanitizeSpanAttributes,
  generateTraceParentHeader,
} from "./telemetry";

describe("OpenTelemetry Telemetry Module (#2630)", () => {
  it("initializes WebTracerProvider and registers global tracer", () => {
    const provider = initializeTracing();
    expect(provider).toBeDefined();

    const tracer = getFrontendTracer();
    expect(tracer).toBeDefined();
  });

  it("sanitizes PII keys from span attributes", () => {
    const rawAttributes = {
      event_id: "evt_123",
      email: "student@campus.edu",
      password: "secret_password",
      jwt_token: "bearer_xyz",
      theme: "dark",
    };

    const sanitized = sanitizeSpanAttributes(rawAttributes);

    expect(sanitized.event_id).toBe("evt_123");
    expect(sanitized.theme).toBe("dark");
    expect(sanitized.email).toBe("[REDACTED_PII]");
    expect(sanitized.password).toBe("[REDACTED_PII]");
    expect(sanitized.jwt_token).toBe("[REDACTED_PII]");
  });

  it("generates valid W3C traceparent header string", () => {
    const traceParent = generateTraceParentHeader();
    expect(traceParent).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-[a-f0-9]{2}$/);
  });

  it("traces async UI interactions via traceInteraction helper", async () => {
    const result = await traceInteraction(
      "rsvp.submit",
      async (span) => {
        expect(span).toBeDefined();
        return { rsvp_id: "rsvp_999" };
      },
      { event_id: "evt_123", email: "secret@campus.edu" },
    );

    expect(result).toEqual({ rsvp_id: "rsvp_999" });
  });

  it("records error status when traceInteraction callback throws", async () => {
    await expect(
      traceInteraction("rsvp.failed", async () => {
        throw new Error("Seat unavailable");
      }),
    ).rejects.toThrow("Seat unavailable");
  });
});
