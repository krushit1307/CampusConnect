import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CatererChatModal } from "./CatererChatModal";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

describe("CatererChatModal", () => {
  const mockSupabase = {
    from: vi.fn(),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as any).mockReturnValue(mockSupabase);
  });

  it("renders the modal and loads chat details", async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === "caterer_attendee_chats") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "chat-123",
              status: "active",
              event: { title: "Spring Gala" },
              alert: { dietary_tag: "Severe Peanut Allergy" },
            },
            error: null,
          }),
        };
      }
      if (table === "caterer_attendee_chat_messages") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              { id: "m1", sender_type: "caterer", content: "Is shared oil okay?" },
              { id: "m2", sender_type: "attendee", content: "No, please use separate." },
            ],
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    render(<CatererChatModal chatId="chat-123" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Spring Gala/)).toBeInTheDocument();
      expect(screen.getByText(/Severe Peanut Allergy/)).toBeInTheDocument();
      expect(screen.getByText("Is shared oil okay?")).toBeInTheDocument();
      expect(screen.getByText("No, please use separate.")).toBeInTheDocument();
    });
  });

  it("shows an archived message and disables input if chat is archived", async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === "caterer_attendee_chats") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "chat-123",
              status: "archived",
              event: { title: "Old Gala" },
              alert: { dietary_tag: "Vegan" },
            },
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    render(<CatererChatModal chatId="chat-123" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Chat archived/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Reply to caterer...")).toBeDisabled();
    });
  });

  it("blocks profanity in messages", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockImplementation((table) => {
      if (table === "caterer_attendee_chats") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "chat-123",
              status: "active",
              event: { title: "" },
              alert: { dietary_tag: "" },
            },
            error: null,
          }),
        };
      }
      if (table === "caterer_attendee_chat_messages") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          insert: mockInsert,
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    render(<CatererChatModal chatId="chat-123" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Reply to caterer...")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Reply to caterer...");
    fireEvent.change(input, { target: { value: "You idiot!" } });

    // Submit form
    fireEvent.submit(input);

    await waitFor(() => {
      // The profanity filter should flag it, meaning supabase.from().insert is NOT called.
    });

    expect(mockInsert).not.toHaveBeenCalled();
  });
});
