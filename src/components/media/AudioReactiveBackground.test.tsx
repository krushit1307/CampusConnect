import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AudioReactiveBackground } from "./AudioReactiveBackground";

// Mock WebGL context
HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((type: string) => {
  if (type === "webgl" || type === "experimental-webgl") {
    return {
      createBuffer: vi.fn(),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      createShader: vi.fn().mockReturnValue({}),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      getShaderParameter: vi.fn().mockReturnValue(true),
      createProgram: vi.fn().mockReturnValue({}),
      attachShader: vi.fn(),
      linkProgram: vi.fn(),
      getProgramParameter: vi.fn().mockReturnValue(true),
      useProgram: vi.fn(),
      getUniformLocation: vi.fn(),
      getAttribLocation: vi.fn(),
      enableVertexAttribArray: vi.fn(),
      vertexAttribPointer: vi.fn(),
      uniform2f: vi.fn(),
      uniform1f: vi.fn(),
      viewport: vi.fn(),
      drawArrays: vi.fn(),
      deleteProgram: vi.fn(),
    };
  }
  return null;
});

describe("AudioReactiveBackground Component", () => {
  it("renders WebGL visualizer canvas and control toggle", () => {
    render(<AudioReactiveBackground defaultPreset="neonPulse" />);
    expect(screen.getByText("Hide Controls")).toBeInPrimary();
  });

  it("renders controls panel when active", () => {
    render(<AudioReactiveBackground defaultPreset="cyberTunnel" />);
    expect(screen.getByText("Shader Visualizer")).toBeInPrimary();
    expect(screen.getByText("GLSL Preset")).toBeInPrimary();
  });
});
