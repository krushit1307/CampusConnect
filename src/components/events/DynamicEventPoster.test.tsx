import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DynamicEventPoster } from "./DynamicEventPoster";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

let mockLanguage = "es";
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: mockLanguage },
  }),
}));

const mockEvent = {
  id: "event-uuid-1234",
  title: "Creative Writing Workshop",
  event_date: "2026-10-15T18:00:00Z",
  location: "Library Annex",
};

const mockSession = {
  access_token: "mock-access-token",
};

const mockSupabase = {
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: mockSession }, error: null }),
  },
};

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
global.URL.revokeObjectURL = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockLanguage = "es";
  mockFetch.mockResolvedValue({
    ok: true,
    blob: vi.fn().mockResolvedValue(new Blob(["mock-image-data"], { type: "image/png" })),
  });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DynamicEventPoster Frontend Component", () => {
  it("renders Download Poster button and handles download correctly", async () => {
    render(<DynamicEventPoster event={mockEvent} />);

    const button = screen.getByRole("button", { name: /Download Poster/i });
    expect(button).toBeInTheDocument();

    // Click download button
    fireEvent.click(button);

    // Button should show loading spinner/state immediately
    expect(screen.getByText(/Generating.../i)).toBeInTheDocument();

    // Verify it fetches from the generate-poster Edge Function with correct query parameters
    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/functions/v1/generate-poster?event_id=event-uuid-1234&lang=es"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer mock-access-token",
          }),
        })
      );
    });
  });

  it("falls back to standard request when auth session is not active", async () => {
    mockSupabase.auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });

    render(<DynamicEventPoster event={mockEvent} />);

    const button = screen.getByRole("button", { name: /Download Poster/i });
    fireEvent.click(button);

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/functions/v1/generate-poster?event_id=event-uuid-1234&lang=es"),
        expect.objectContaining({
          method: "GET",
          headers: expect.not.objectContaining({
            Authorization: expect.any(String),
          }),
        })
      );
    });
  });
});
