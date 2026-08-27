import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import { EventLiveChat } from "./EventLiveChat";
import {
  useEventLiveChat,
  type ChatMessage,
  type UseEventLiveChatResult,
} from "@/hooks/useEventLiveChat";

vi.mock("@/hooks/useEventLiveChat", () => ({
  useEventLiveChat: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedUseEventLiveChat = vi.mocked(useEventLiveChat);

const signedOutUser = null;
const signedInUser = { id: "u-1", email: "student@campus.edu" } as unknown as User;

const chatMessage: ChatMessage = {
  id: "m1",
  eventId: "evt-1",
  userId: "u-1",
  content: "Hello from the chat!",
  createdAt: "2026-08-09T17:00:00Z",
  author: { id: "u-1", full_name: "Alex Student", handle: "alex" },
};

function mockHook(overrides: Partial<UseEventLiveChatResult> = {}): UseEventLiveChatResult {
  const base: UseEventLiveChatResult = {
    messages: [],
    loading: false,
    sending: false,
    connected: true,
    error: null,
    sendMessage: vi.fn().mockResolvedValue(chatMessage),
  };
  mockedUseEventLiveChat.mockReturnValue({ ...base, ...overrides });
  return base;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EventLiveChat", () => {
  it("shows a loading state while the history is loading", () => {
    mockHook({ loading: true });
    render(<EventLiveChat eventId="evt-1" user={signedInUser} />);
    expect(screen.getByText(/loading messages/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no messages", () => {
    mockHook();
    render(<EventLiveChat eventId="evt-1" user={signedInUser} />);
    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
  });

  it("renders messages with author names and content", () => {
    mockHook({ messages: [chatMessage] });
    render(<EventLiveChat eventId="evt-1" user={signedInUser} />);
    expect(screen.getByText("Hello from the chat!")).toBeInTheDocument();
    expect(screen.getByText(/Alex Student/i)).toBeInTheDocument();
  });

  it("falls back to the handle when a message has no full name", () => {
    const authorless: ChatMessage = {
      ...chatMessage,
      author: { id: "u-2", full_name: null, handle: "jdoe" },
    };
    mockHook({ messages: [authorless] });
    render(<EventLiveChat eventId="evt-1" user={signedInUser} />);
    expect(screen.getByText(/jdoe/i)).toBeInTheDocument();
  });

  it("shows the live indicator when connected and a connecting state otherwise", () => {
    const { rerender } = render(<EventLiveChat eventId="evt-1" user={signedInUser} />);
    expect(screen.getByText("Live")).toBeInTheDocument();

    mockHook({ connected: false });
    rerender(<EventLiveChat eventId="evt-1" user={signedInUser} />);
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it("prompts signed-out visitors to sign in and hides the composer", () => {
    mockHook();
    render(<EventLiveChat eventId="evt-1" user={signedOutUser} />);
    expect(screen.getByText(/sign in to join the conversation/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("sends the typed message and clears the composer on success", async () => {
    const sendMessage = vi.fn().mockResolvedValue(chatMessage);
    mockHook({ sendMessage });

    render(<EventLiveChat eventId="evt-1" user={signedInUser} />);

    const input = screen.getByRole("textbox", { name: /chat message/i });
    fireEvent.change(input, { target: { value: "Hello!" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith("Hello!"));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe(""));
  });

  it("surfaces an error toast when sending fails", async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error("Rate limited"));
    mockHook({ sendMessage });

    render(<EventLiveChat eventId="evt-1" user={signedInUser} />);

    const input = screen.getByRole("textbox", { name: /chat message/i });
    fireEvent.change(input, { target: { value: "Hello!" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(sendMessage).toHaveBeenCalled());
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("Rate limited");
  });

  it("does not send empty messages", async () => {
    const sendMessage = vi.fn().mockResolvedValue(chatMessage);
    mockHook({ sendMessage });

    render(<EventLiveChat eventId="evt-1" user={signedInUser} />);

    const input = screen.getByRole("textbox", { name: /chat message/i });
    fireEvent.change(input, { target: { value: "   " } });

    const sendButton = screen.getByRole("button", { name: /send/i });
    expect(sendButton).toBeDisabled();
    fireEvent.click(sendButton);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
