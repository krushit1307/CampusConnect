import { describe, it, expect } from "vitest";
import { initializeTracing, getFrontendTracer, traceSpan } from "./instrumentation";
import { trace } from "@opentelemetry/api";

describe("Frontend OpenTelemetry Instrumentation (#1460)", () => {
  it("initializes WebTracerProvider and registers global tracer", () => {
    const provider = initializeTracing();
    expect(provider).toBeDefined();

    const tracer = getFrontendTracer();
    expect(tracer).toBeDefined();
  });

  it("traces async function execution via traceSpan helper", async () => {
    const result = await traceSpan("test.operation", async (span) => {
      expect(span).toBeDefined();
      return 42;
    });

    expect(result).toBe(42);
  });

  it("handles errors inside traceSpan cleanly", async () => {
    await expect(
      traceSpan("test.failing_operation", async () => {
        throw new Error("Tracing failure test");
      }),
    ).rejects.toThrow("Tracing failure test");
  });
});
