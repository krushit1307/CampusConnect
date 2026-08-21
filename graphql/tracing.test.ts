import { describe, it, expect } from "vitest";
import { initializeBackendTracing, getBackendTracer, openTelemetryPlugin } from "./tracing";

describe("Backend OpenTelemetry Instrumentation (#1460)", () => {
  it("initializes backend TracerProvider", () => {
    const provider = initializeBackendTracing();
    expect(provider).toBeDefined();

    const tracer = getBackendTracer();
    expect(tracer).toBeDefined();
  });

  it("exports openTelemetryPlugin with Yoga hooks", () => {
    const plugin = openTelemetryPlugin();
    expect(plugin).toBeDefined();
    expect(typeof plugin.onRequest).toBe("function");
    expect(typeof plugin.onExecute).toBe("function");
    expect(typeof plugin.onResponse).toBe("function");
  });
});
