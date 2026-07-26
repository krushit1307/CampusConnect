// @vitest-environment jsdom

import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import { MemoryRouter } from "react-router-dom";
import { CommandPalette } from "./command-palette";

expect.extend(matchers);

beforeEach(() => {
  cleanup();

  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));
  }

  if (typeof window !== "undefined" && window.Element) {
    window.Element.prototype.scrollIntoView = vi.fn();
  }
});

afterEach(() => {
  cleanup();
});

describe("CommandPalette", () => {
  it("renders correctly and stays closed by default", () => {
    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>
    );
    expect(screen.queryByPlaceholderText(/type a command or search/i)).not.toBeInTheDocument();
  });

  it("opens when Cmd+K or Ctrl+K is pressed", () => {
    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>
    );

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByPlaceholderText(/type a command or search/i)).toBeInTheDocument();
  });

  it("displays navigation items when open", () => {
    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>
    );

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(screen.getByText("Explore Clubs")).toBeInTheDocument();
    expect(screen.getByText("Events Calendar")).toBeInTheDocument();
  });
});