import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
import ClubManagePage from "./clubs.$slug.manage";

vi.mock("@/components/site/SiteShell", () => ({
  SiteShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/DashboardWidgetSkeleton", () => ({
  ClubManageSkeleton: () => <div data-testid="manage-skeleton" />,
}));

const mockUpdate = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-123" } } }),
    },
    from: vi.fn().mockImplementation((table) => {
      if (table === "clubs") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: mockSingle,
            }),
          }),
          update: mockUpdate,
        };
      }
      if (table === "club_members") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ user_id: "admin-123", role: "admin" }],
              error: null,
            }),
          }),
        };
      }
      return {};
    }),
  }),
}));

function makeClub(overrides: Record<string, unknown> = {}) {
  return {
    id: "club-1",
    name: "Coding Club",
    slug: "coding-club",
    description: "Build software together.",
    banner_url: null,
    logo_url: null,
    promo_video_url: null,
    visibility: "public",
    github_repo_url: null,
    social_links: {},
    social_links_order: [],
    version: 1,
    club_members: [{ id: "cm-1", role: "admin", status: "approved", user_id: "admin-123" }],
    ...overrides,
  };
}

const renderPage = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/clubs/coding-club/manage"]}>
        <Routes>
          <Route path="/clubs/:slug/manage" element={<ClubManagePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("Club brand color persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("initializes the color pickers from the persisted club colors on load/refetch", async () => {
    mockSingle.mockResolvedValue({
      data: makeClub({ primary_color: "#123456", secondary_color: "#DDF25C" }),
      error: null,
    });

    renderPage();

    await screen.findByText("Club Settings");

    const primary = screen.getByLabelText("Primary Color hex value") as HTMLInputElement;
    const secondary = screen.getByLabelText("Secondary Color hex value") as HTMLInputElement;
    expect(primary.value).toBe("#123456");
    expect(secondary.value).toBe("#DDF25C");
  });

  it("falls back to empty pickers for clubs without custom colors", async () => {
    mockSingle.mockResolvedValue({
      data: makeClub({ primary_color: null, secondary_color: null }),
      error: null,
    });

    renderPage();

    await screen.findByText("Club Settings");

    const primary = screen.getByLabelText("Primary Color hex value") as HTMLInputElement;
    const secondary = screen.getByLabelText("Secondary Color hex value") as HTMLInputElement;
    // react-colorful renders a prefixed empty state ("#") when no color is set.
    expect(primary.value).toBe("#");
    expect(secondary.value).toBe("#");
  });

  it("blocks saving an invalid hex color before any database write", async () => {
    mockSingle.mockResolvedValue({
      data: makeClub({ primary_color: null, secondary_color: null }),
      error: null,
    });

    renderPage();

    await screen.findByText("Club Settings");

    fireEvent.change(screen.getByLabelText("Primary Color hex value"), {
      target: { value: "#12345" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));

    await waitFor(() => {
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  it("saves primary and secondary colors, then reloads them after refetch", async () => {
    mockSingle.mockImplementation(() => {
      const persisted = mockUpdate.mock.calls.length > 0;
      return Promise.resolve({
        data: persisted
          ? makeClub({ primary_color: "#123456", secondary_color: "#DDF25C" })
          : makeClub(),
        error: null,
      });
    });

    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [makeClub({ primary_color: "#123456", secondary_color: "#DDF25C" })],
            error: null,
          }),
        }),
      }),
    });

    renderPage();

    await screen.findByText("Club Settings");

    fireEvent.change(screen.getByLabelText("Primary Color hex value"), {
      target: { value: "#123456" },
    });
    fireEvent.change(screen.getByLabelText("Secondary Color hex value"), {
      target: { value: "#DDF25C" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.primary_color).toBe("#123456");
    expect(payload.secondary_color).toBe("#DDF25C");
    expect(payload.description).toBe("Build software together.");

    const primary = screen.getByLabelText("Primary Color hex value") as HTMLInputElement;
    const secondary = screen.getByLabelText("Secondary Color hex value") as HTMLInputElement;
    await waitFor(() => {
      expect(primary.value).toBe("#123456");
      expect(secondary.value).toBe("#DDF25C");
    });
  });
});
