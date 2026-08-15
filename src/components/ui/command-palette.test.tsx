// @vitest-environment jsdom

import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import { MemoryRouter } from "react-router-dom";
import { CommandPalette } from "./command-palette";
import { CommandPaletteProvider, useCommand } from "@/components/CommandPaletteProvider";
import { useCommandPaletteSearch } from "@/hooks/useCommandPaletteSearch";

expect.extend(matchers);

vi.mock("@/hooks/useCommandPaletteSearch", () => ({
  useCommandPaletteSearch: vi.fn(() => ({ results: [], isLoading: false })),
}));

function DemoPage() {
  useCommand({
    id: "demo-delete",
    title: "Delete Event",
    keywords: ["remove", "trash"],
    action: vi.fn(),
  });
  return <div>Demo Page</div>;
}

function renderWithProvider(ui: React.ReactElement) {
  return render(
    <CommandPaletteProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </CommandPaletteProvider>,
  );
}

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
    renderWithProvider(<CommandPalette />);
    expect(screen.queryByPlaceholderText(/type a command or search/i)).not.toBeInTheDocument();
  });

  it("opens when Cmd+K or Ctrl+K is pressed", () => {
    renderWithProvider(<CommandPalette />);

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByPlaceholderText(/type a command or search/i)).toBeInTheDocument();
  });

  it("displays navigation items when open", () => {
    renderWithProvider(<CommandPalette />);

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(screen.getByText("Explore Clubs")).toBeInTheDocument();
    expect(screen.getByText("Events Calendar")).toBeInTheDocument();
  });

  it("does not show contextual commands when none are registered", () => {
    renderWithProvider(<CommandPalette />);

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(screen.queryByText("Delete Event")).not.toBeInTheDocument();
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
  });

  it("renders registered contextual commands and executes their action", () => {
    renderWithProvider(
      <>
        <DemoPage />
        <CommandPalette />
      </>,
    );

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(screen.getByText("Delete Event")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Delete Event"));
    expect(screen.queryByPlaceholderText(/type a command or search/i)).not.toBeInTheDocument();
  });

  it("filters contextual commands by keyword search", () => {
    renderWithProvider(
      <>
        <DemoPage />
        <CommandPalette />
      </>,
    );

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    fireEvent.change(screen.getByPlaceholderText(/type a command or search/i), {
      target: { value: "trash" },
    });

    expect(screen.getByText("Delete Event")).toBeInTheDocument();
  });

  it("removes contextual commands when the registering component unmounts", () => {
    const { rerender } = renderWithProvider(
      <>
        <DemoPage />
        <CommandPalette />
      </>,
    );

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByText("Delete Event")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });

    rerender(
      <CommandPaletteProvider>
        <MemoryRouter>
          <CommandPalette />
        </MemoryRouter>
      </CommandPaletteProvider>,
    );

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.queryByText("Delete Event")).not.toBeInTheDocument();
  });

  it("opens when the open-command-palette custom event is dispatched", () => {
    renderWithProvider(<CommandPalette />);

    expect(screen.queryByPlaceholderText(/type a command or search/i)).not.toBeInTheDocument();
    window.dispatchEvent(new CustomEvent("open-command-palette"));
    expect(screen.getByPlaceholderText(/type a command or search/i)).toBeInTheDocument();
  });

  it("renders categorized result groups for events, clubs, and users", () => {
    vi.mocked(useCommandPaletteSearch).mockReturnValue({
      results: [
        { id: "e1", type: "event", label: "Tech Fest", sublabel: "Event", path: "/events/e1" },
        { id: "c1", type: "club", label: "Coding Club", sublabel: "Club", path: "/clubs/c1" },
        { id: "p1", type: "person", label: "Jane Doe", sublabel: "User", path: "/profile/jane" },
      ],
      isLoading: false,
    });

    renderWithProvider(<CommandPalette />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    fireEvent.change(screen.getByPlaceholderText(/type a command or search/i), {
      target: { value: "tech" },
    });

    expect(screen.getByText("Events")).toBeInTheDocument();
    expect(screen.getByText("Clubs")).toBeInTheDocument();
    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(screen.getByText("Tech Fest")).toBeInTheDocument();
    expect(screen.getByText("Coding Club")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });
});
