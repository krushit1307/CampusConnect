import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CatererAlertView from "./caterer.alert.$token";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/services/catererDietaryAlert", () => ({
  acknowledgeCatererDietaryAlert: vi.fn().mockResolvedValue({ success: true }),
}));

describe("caterer.alert.$token", () => {
  const mockSupabase = {
    rpc: vi.fn(),
    from: vi.fn(),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as any).mockReturnValue(mockSupabase);
  });

  const renderRoute = (token: string) => {
    return render(
      <MemoryRouter initialEntries={[`/caterer/alert/${token}`]}>
        <Routes>
          <Route path="/caterer/alert/:token" element={<CatererAlertView />} />
        </Routes>
      </MemoryRouter>,
    );
  };

  it("loads chat via rpc and renders messages", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [
        {
          id: "chat-123",
          alert_id: "alert-1",
          event_id: "evt-1",
          status: "active",
          dietary_tag: "Gluten Free",
        },
      ],
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: "msg-1", sender_type: "caterer", content: "Hello attendee!" },
          { id: "msg-2", sender_type: "attendee", content: "Hi caterer." },
        ],
        error: null,
      }),
    });

    renderRoute("test-token");

    await waitFor(() => {
      expect(screen.getByText("Caterer Alert Portal")).toBeInTheDocument();
      expect(screen.getByText("Gluten Free")).toBeInTheDocument();
      expect(screen.getByText("Hello attendee!")).toBeInTheDocument();
      expect(screen.getByText("Hi caterer.")).toBeInTheDocument();
    });
  });

  it("calls send_caterer_message rpc when sending a message", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [{ id: "chat-123", status: "active", dietary_tag: "Halal" }],
      error: null,
    });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    renderRoute("test-token");

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Ask the attendee about their restriction..."),
      ).toBeInTheDocument();
    });

    mockSupabase.rpc.mockResolvedValueOnce({ data: { success: true }, error: null });

    const input = screen.getByPlaceholderText("Ask the attendee about their restriction...");
    fireEvent.change(input, { target: { value: "Can you eat eggs?" } });
    fireEvent.submit(input);

    await waitFor(() => {
      expect(mockSupabase.rpc).toHaveBeenCalledWith("send_caterer_message", {
        p_token: "test-token",
        p_content: "Can you eat eggs?",
      });
    });
  });
});
