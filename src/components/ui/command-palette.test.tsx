// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BrowserRouter } from "react-router-dom";
import { CommandPalette } from "./command-palette";

// Mock JSDOM missing browser APIs required by cmdk
beforeEach(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  Element.prototype.scrollIntoView = () => {};
});

const renderPalette = () => {
  return render(
    <BrowserRouter>
      <CommandPalette />
    </BrowserRouter>,
  );
};

describe("CommandPalette Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("does not render initially", () => {
    renderPalette();
    expect(screen.queryByPlaceholderText(/Type a command or search/i)).not.toBeInTheDocument();
  });

  it("opens when pressing Cmd+K or Ctrl+K", () => {
    renderPalette();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    expect(screen.getByPlaceholderText(/Type a command or search/i)).toBeInTheDocument();
  });

  it("displays navigation items when open", () => {
    renderPalette();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    expect(screen.getByText("Browse Clubs")).toBeInTheDocument();
    expect(screen.getByText("Upcoming Events")).toBeInTheDocument();
  });
});
