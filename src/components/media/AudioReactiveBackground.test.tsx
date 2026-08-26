import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AudioReactiveBackground } from "./AudioReactiveBackground";
import { act } from "@testing-library/react";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;

// Mock WebGL context
HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((type: string) => {
  if (type === "webgl" || type === "experimental-webgl") {
    return {
      createBuffer: vi.fn(),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),

      createShader: vi.fn(() => ({})),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      getShaderParameter: vi.fn(() => true),
      getShaderInfoLog: vi.fn(() => ""),
      deleteShader: vi.fn(),

      createProgram: vi.fn(() => ({})),
      attachShader: vi.fn(),
      linkProgram: vi.fn(),
      getProgramParameter: vi.fn(() => true),
      getProgramInfoLog: vi.fn(() => ""),
      useProgram: vi.fn(),

      getUniformLocation: vi.fn(),
      getAttribLocation: vi.fn(() => 0),

      enableVertexAttribArray: vi.fn(),
      vertexAttribPointer: vi.fn(),

      uniform1f: vi.fn(),
      uniform2f: vi.fn(),

      viewport: vi.fn(),
      clear: vi.fn(),
      clearColor: vi.fn(),
      drawArrays: vi.fn(),

      deleteProgram: vi.fn(),
      deleteBuffer: vi.fn(),

      ARRAY_BUFFER: 34962,
      STATIC_DRAW: 35044,
      FLOAT: 5126,
      TRIANGLES: 4,
      VERTEX_SHADER: 35633,
      FRAGMENT_SHADER: 35632,
      COMPILE_STATUS: 35713,
      LINK_STATUS: 35714,
    };
  }
  return null;
});

describe("AudioReactiveBackground Component", () => {
  it("renders WebGL visualizer canvas and control toggle", () => {
    render(<AudioReactiveBackground defaultPreset="neonPulse" />);
    expect(screen.getByText("Hide Controls")).toBeInTheDocument();
  });

  it("renders controls panel when active", () => {
    render(<AudioReactiveBackground defaultPreset="cyberTunnel" />);
    expect(screen.getByText("Shader Visualizer")).toBeInTheDocument();
    expect(screen.getByText("GLSL Preset")).toBeInTheDocument();
  });

  it("shows fallback UI when WebGL context is lost", async () => {
    render(<AudioReactiveBackground />);

    const canvas = document.querySelector("canvas")!;

    act(() => {
      canvas.dispatchEvent(
        new Event("webglcontextlost", {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(await screen.findByText(/WebGL Context Lost/i)).toBeInTheDocument();

    expect(
      await screen.findByRole("button", {
        name: /Reload Visualizer/i,
      }),
    ).toBeInTheDocument();
  });
});
