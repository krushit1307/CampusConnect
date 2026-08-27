import { describe, it, expect } from "vitest";
import { executeCodeSandbox } from "../liveCodingService";

describe("liveCodingService - Browser Code Sandbox Execution", () => {
  it("executes valid JavaScript code and captures console.log output", async () => {
    const code = `
      const a = 10;
      const b = 20;
      console.log('Sum is:', a + b);
    `;

    const result = await executeCodeSandbox(code, "javascript");
    expect(result.status).toBe("success");
    expect(result.output).toContain("Sum is: 30");
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("captures multiple console log invocations in sequential order", async () => {
    const code = `
      console.log('Line 1');
      console.log('Line 2');
    `;

    const result = await executeCodeSandbox(code, "javascript");
    expect(result.status).toBe("success");
    expect(result.output).toBe("Line 1\nLine 2");
  });

  it("safely catches and returns runtime exceptions without crashing", async () => {
    const code = `
      const obj = null;
      obj.someUndefinedFunction();
    `;

    const result = await executeCodeSandbox(code, "javascript");
    expect(result.status).toBe("error");
    expect(result.output).toContain("Runtime Error:");
  });

  it("returns default success message if code produces no console output", async () => {
    const code = `
      const x = 5 * 5;
    `;

    const result = await executeCodeSandbox(code, "javascript");
    expect(result.status).toBe("success");
    expect(result.output).toContain("Code executed successfully");
  });
});
