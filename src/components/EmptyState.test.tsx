import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState Component", () => {
  it("renders title and description correctly", () => {
    render(
      <EmptyState
        title="No upcoming events"
        description="This club hasn't scheduled anything yet."
      />,
    );

    expect(screen.getByRole("heading", { name: /no upcoming events/i })).toBeInTheDocument();
    expect(screen.getByText("This club hasn't scheduled anything yet.")).toBeInTheDocument();
  });

  it("renders action button and handles onClick event", () => {
    const handleClick = vi.fn();

    render(
      <EmptyState
        title="No search results"
        action={{ label: "Retry Search", onClick: handleClick }}
      />,
    );

    const button = screen.getByRole("button", { name: /retry search/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders action link with correct href attribute", () => {
    render(
      <EmptyState title="No clubs found" action={{ label: "Explore Clubs", href: "/clubs" }} />,
    );

    const link = screen.getByRole("link", { name: /explore clubs/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/clubs");
  });
});
