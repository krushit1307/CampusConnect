import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import EmptyBookmarks from "./EmptyBookmarks";

describe("EmptyBookmarks Component", () => {
  it("renders the heading and description", () => {
    render(
      <MemoryRouter>
        <EmptyBookmarks />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /no bookmarked events/i })).toBeInTheDocument();
    expect(
      screen.getByText(/you haven't bookmarked any events yet/i),
    ).toBeInTheDocument();
  });

  it("renders the empty bookmark image with proper alt text", () => {
    render(
      <MemoryRouter>
        <EmptyBookmarks />
      </MemoryRouter>,
    );

    const image = screen.getByAltText("No bookmarks");
    expect(image).toBeInTheDocument();
  });

  it("renders a link to browse upcoming events", () => {
    render(
      <MemoryRouter>
        <EmptyBookmarks />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: /browse events/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/events");
  });
});
