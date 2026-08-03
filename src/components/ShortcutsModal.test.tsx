import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ShortcutsModal from "./ShortcutsModal";

describe("ShortcutsModal Component", () => {
  it("does not render modal contents when open is false", () => {
    render(<ShortcutsModal open={false} onOpenChange={vi.fn()} />);

    expect(screen.queryByText("Keyboard Shortcuts")).not.toBeInTheDocument();
  });

  it("renders keyboard shortcuts list when open is true", () => {
    render(<ShortcutsModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
    expect(screen.getByText("Available shortcuts in CampusConnect")).toBeInTheDocument();

    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("/")).toBeInTheDocument();

    expect(screen.getByText("Close modals")).toBeInTheDocument();
    expect(screen.getByText("Esc")).toBeInTheDocument();

    expect(screen.getByText("Open keyboard shortcuts")).toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});
