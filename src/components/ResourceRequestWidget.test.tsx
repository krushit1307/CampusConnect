import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResourceRequestWidget } from "./ResourceRequestWidget";
import { useQuery } from "@/hooks/useReactQueryReplacement";

// Mock the hooks and supabase client
vi.mock("@/hooks/useReactQueryReplacement", () => ({
  useQuery: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({})),
}));

describe("ResourceRequestWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows nothing if there are no requests", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    } as any);

    const { container } = render(<ResourceRequestWidget eventId="123" />);
    expect(container.firstChild).toBeNull();
  });

  it("shows loading state when fetching", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    } as any);

    render(<ResourceRequestWidget eventId="123" />);
    expect(screen.getByTestId("resource-widget-loading")).toBeInTheDocument();
  });

  it("shows error state when query fails", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Test error"),
    } as any);

    render(<ResourceRequestWidget eventId="123" />);
    expect(screen.getByTestId("resource-widget-error")).toBeInTheDocument();
    expect(screen.getByText(/Failed to load resource requests/i)).toBeInTheDocument();
  });

  it("renders pending state correctly", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: {
        id: "req-1",
        resources: ["Projector", "HDMI Cable"],
        status: "pending",
      },
      isLoading: false,
      error: null,
    } as any);

    render(<ResourceRequestWidget eventId="123" />);

    expect(screen.getByTestId("resource-widget")).toBeInTheDocument();
    expect(screen.getByText(/Requested resources: Projector, HDMI Cable/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending IT Approval/i)).toBeInTheDocument();
  });

  it("renders submitted state with external ticket id", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: {
        id: "req-1",
        resources: ["PA System"],
        status: "submitted",
        external_ticket_id: "ZD-12345",
      },
      isLoading: false,
      error: null,
    } as any);

    render(<ResourceRequestWidget eventId="123" />);

    expect(screen.getByText(/Ticket Created/i)).toBeInTheDocument();
    expect(screen.getByText(/Ticket: ZD-12345/i)).toBeInTheDocument();
  });

  it("renders approved state correctly", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: {
        id: "req-1",
        resources: ["PA System"],
        status: "approved",
      },
      isLoading: false,
      error: null,
    } as any);

    render(<ResourceRequestWidget eventId="123" />);

    expect(screen.getByText(/Approved/i)).toBeInTheDocument();
  });
});
