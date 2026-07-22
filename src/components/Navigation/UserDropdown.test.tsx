import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { UserDropdown } from "./UserDropdown";

describe("UserDropdown", () => {
  it("renders the user trigger with correct ARIA attributes", () => {
    const mockUser = {
      id: "user-1",
      email: "test@example.com",
    } as import("@supabase/supabase-js").User;

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <UserDropdown user={mockUser} onSignOut={vi.fn()} />
      </MemoryRouter>,
    );

    // Verify it renders the initial
    expect(markup).toContain(">T</button>");

    // Verify basic ARIA attributes provided natively by Radix when using asChild
    expect(markup).toContain('aria-haspopup="menu"');
    expect(markup).toContain('aria-expanded="false"');

    // Verify it identifies as the User menu for screen readers
    expect(markup).toContain('aria-label="User menu"');
  });
});
