import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
import { BreadcrumbProvider } from "@/components/BreadcrumbsContext";
import ClubProfilePage from "./clubs.$slug";

vi.mock("@/components/site/SiteShell", () => ({
  SiteShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/usePresence", () => ({
  usePresence: () => ({ presenceMap: {} }),
  getPresenceBadgeClass: () => "bg-gray-400",
  PresenceProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/media/AudioReactiveBackground", () => ({
  AudioReactiveBackground: ({ className }: { className?: string }) => (
    <div className={className} data-testid="audio-bg" />
  ),
}));

vi.mock("@/components/notes/CollaborativeEditor", () => ({
  CollaborativeEditor: () => <div data-testid="collab-editor" />,
}));

vi.mock("@/components/ReportDialog", () => ({
  ReportDialog: () => null,
}));

const mockSingle = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: "user-1", email: "ada@test.io" } } }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "clubs") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ single: mockSingle }),
            }),
          }),
        };
      }
      if (table === "bookmarks") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
          }),
        };
      }
      if (table === "bulk_email_jobs") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    }),
  }),
}));

const mockClub = {
  id: "club-1",
  name: "Robotics Club",
  slug: "robotics-club",
  description: "We build robots.\n\n## Mission\n\nGo fast.",
  github_repo_url: "https://github.com/example/robotics",
  visibility: "public",
  promo_video_url: null,
  primary_color: "#1a2b3c",
  secondary_color: "#ddf25c",
  club_members: [
    {
      id: "m1",
      role: "admin",
      status: "approved",
      user_id: "user-1",
      club_roles: { title: "Admin" },
      profiles: {
        full_name: "Ada Lovelace",
        avatar_url: null,
        handle: "ada",
        bio: "Founding officer, robotics lead.",
      },
    },
    {
      id: "m2",
      role: "member",
      status: "approved",
      user_id: "user-2",
      club_roles: null,
      profiles: {
        full_name: "Grace Hopper",
        avatar_url: null,
        handle: "grace",
        bio: null,
      },
    },
  ],
  events: [{ id: "e1", title: "Kickoff", event_date: "2026-09-01T00:00:00Z" }],
  club_tags: [],
};

const renderClubProfile = (initialEntries = ["/clubs/robotics-club"]) =>
  render(
    <HelmetProvider>
      <BreadcrumbProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={initialEntries}>
            <Routes>
              <Route path="/clubs/:slug" element={<ClubProfilePage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </BreadcrumbProvider>
    </HelmetProvider>,
  );

describe("ClubProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    mockSingle.mockResolvedValue({ data: mockClub, error: null });
  });

  it("renders the club name, description and theme CSS variables", async () => {
    const { container } = renderClubProfile();

    expect(await screen.findByText("We build robots.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Robotics Club" })).toBeInTheDocument();

    const themed = container.querySelector("[style*='--theme-primary']");
    expect(themed).not.toBeNull();
    expect(themed).toHaveAttribute("style", expect.stringContaining("--theme-primary: #1a2b3c"));
    expect(themed).toHaveAttribute(
      "style",
      expect.stringContaining("--theme-secondary-foreground: #000000"),
    );
  });

  it("falls back to the CampusConnect defaults for clubs without custom colors", async () => {
    mockSingle.mockResolvedValue({
      data: { ...mockClub, primary_color: null, secondary_color: null },
      error: null,
    });

    const { container } = renderClubProfile();

    await screen.findByText("We build robots.");

    const themed = container.querySelector("[style*='--theme-primary']");
    expect(themed).not.toBeNull();
    expect(themed).toHaveAttribute("style", expect.stringContaining("--theme-primary: #6f8000"));
    expect(themed).toHaveAttribute("style", expect.stringContaining("--theme-secondary: #000000"));
    expect(themed).toHaveAttribute(
      "style",
      expect.stringContaining("--theme-secondary-foreground: #f3f1e4"),
    );
  });

  it("renders officers as 3D flip cards that flip on click", async () => {
    renderClubProfile();

    const flipButton = await screen.findByRole("button", { name: "Ada Lovelace's bio" });
    expect(within(flipButton).getAllByText("Ada Lovelace").length).toBeGreaterThan(0);
    expect(within(flipButton).getAllByText("Officer").length).toBeGreaterThan(0);

    expect(flipButton).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(flipButton);
    expect(flipButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(flipButton);
    expect(flipButton).toHaveAttribute("aria-pressed", "false");
  });

  it("renders approved members and the Leave Club action for the current user", async () => {
    renderClubProfile();

    expect(await screen.findByText("2 members total")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ada Lovelace" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Grace Hopper" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave Club" })).toBeInTheDocument();

    const searchInput = screen.getByLabelText("Search members by name or handle");
    fireEvent.change(searchInput, { target: { value: "grace" } });

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Grace Hopper" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("link", { name: "Ada Lovelace" })).not.toBeInTheDocument();
  });

  it("renders upcoming events and admin-only controls", async () => {
    renderClubProfile();

    await screen.findByText("Officers");
    expect(await screen.findByRole("heading", { name: "Upcoming events" })).toBeInTheDocument();
    expect(screen.getByText("Kickoff")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Tasks" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Meeting Notes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage Club" })).toBeInTheDocument();
    expect(screen.getByText("Club Newsletter Dispatcher")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Newsletter Now" })).toBeInTheDocument();
  });

  it("renders NotFound when the club cannot be loaded", async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });
    renderClubProfile();

    expect(await screen.findByRole("heading", { name: "Page Not Found" })).toBeInTheDocument();
  });
});
