import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import WatchLogin from "./login";
import WatchDashboard from "./dashboard";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

const mockSupabase = {
  auth: {
    getSession: vi.fn(),
    setSession: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  },
  rpc: vi.fn(),
  from: vi.fn().mockImplementation((table) => {
    if (table === "events") {
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [
                { id: "event-1", title: "Smartwatch Hackathon", max_attendees: 50 },
              ],
              error: null,
            }),
          }),
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { max_attendees: 50 },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "event_rsvps") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 42, error: null }),
          }),
        }),
      };
    }
    return {
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
  }),
  channel: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(),
  }),
  removeChannel: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Watch Companion Route Tests", () => {
  describe("WatchLogin Component", () => {
    it("renders keypad elements and submits pairing code", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: "mock-access-token-999", error: null });

      render(
        <MemoryRouter>
          <WatchLogin />
        </MemoryRouter>
      );

      expect(screen.getByText("Enter Pair Code")).toBeInTheDocument();

      // Tap 1, 2, 3, 4
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: "3" }));
      fireEvent.click(screen.getByRole("button", { name: "4" }));

      // Tap OK
      fireEvent.click(screen.getByRole("button", { name: "OK" }));

      await waitFor(() => {
        expect(mockSupabase.rpc).toHaveBeenCalledWith("verify_watch_pairing", {
          p_pairing_code: "1234",
        });
        expect(mockSupabase.auth.setSession).toHaveBeenCalledWith({
          access_token: "mock-access-token-999",
          refresh_token: "",
        });
        expect(localStorage.getItem("watch_session_token")).toBe("mock-access-token-999");
        expect(mockNavigate).toHaveBeenCalledWith("/watch/dashboard");
      });
    });
  });

  describe("WatchDashboard Component", () => {
    it("renders events list and navigates to capacity view when selected", async () => {
      localStorage.setItem("watch_session_token", "active-token");

      render(
        <MemoryRouter>
          <WatchDashboard />
        </MemoryRouter>
      );

      // Verify it checks the auth session and loads events
      await waitFor(() => {
        expect(screen.getByText("Select Event")).toBeInTheDocument();
        expect(screen.getByText("Smartwatch Hackathon")).toBeInTheDocument();
      });

      // Tap on the event
      fireEvent.click(screen.getByText("Smartwatch Hackathon"));

      // Verify it loads metrics monitor and capacity values
      await waitFor(() => {
        expect(screen.getByText("42")).toBeInTheDocument(); // Occupancy
        expect(screen.getByText("Limit: 50")).toBeInTheDocument(); // Capacity
        expect(screen.getByRole("button", { name: "+10 Capacity" })).toBeInTheDocument();
      });
    });

    it("displays pulsing capacity alert when capacity is full/exceeded", async () => {
      localStorage.setItem("watch_session_token", "active-token");
      
      // Mock occupancy to be 50 (equal to capacity)
      vi.spyOn(mockSupabase, "from").mockImplementation((table) => {
        if (table === "events") {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [{ id: "event-1", title: "Smartwatch Hackathon", max_attendees: 50 }],
                  error: null,
                }),
              }),
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { max_attendees: 50 },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "event_rsvps") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 50, error: null }),
              }),
            }),
          };
        }
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      });

      render(
        <MemoryRouter>
          <WatchDashboard />
        </MemoryRouter>
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText("Smartwatch Hackathon"));
      });

      await waitFor(() => {
        expect(screen.getByText("CAPACITY FULL")).toBeInTheDocument();
      });
    });
  });
});
