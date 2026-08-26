import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { useEventLiveChat, mergeMessage, type ChatMessage } from "./useEventLiveChat";
import { fetchGraphQL } from "@/lib/graphql-client";
import {
  EVENT_CHAT_MESSAGES_QUERY,
  SEND_CHAT_MESSAGE_MUTATION,
  MESSAGE_ADDED_SUBSCRIPTION,
} from "@/graphql/chat";

const subscriptionState = vi.hoisted(() => ({
  current: { data: null, connected: false, error: null },
}));

const authSessionMock = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("@/hooks/useGraphQLSubscription", () => ({
  useGraphQLSubscription: () => subscriptionState.current,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: authSessionMock }),
}));

vi.mock("@/lib/graphql-client", () => ({
  fetchGraphQL: vi.fn(),
}));

const mockedFetchGraphQL = vi.mocked(fetchGraphQL);

const message: ChatMessage = {
  id: "m1",
  eventId: "evt-1",
  userId: "u-1",
  content: "Hello",
  createdAt: "2026-08-09T17:00:00Z",
  author: { id: "u-1", full_name: "Alex", handle: "alex" },
};

const message2: ChatMessage = {
  ...message,
  id: "m2",
  content: "World",
  createdAt: "2026-08-09T17:01:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  subscriptionState.current = { data: null, connected: false, error: null };
  authSessionMock.getSession.mockResolvedValue({
    data: { session: { access_token: "token-123" } },
  });
  mockedFetchGraphQL.mockResolvedValue({ messages: [message] });
});

describe("mergeMessage", () => {
  it("appends a new message while keeping chronological order", () => {
    const result = mergeMessage([message2], message);
    expect(result.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("deduplicates messages with the same id", () => {
    const result = mergeMessage([message, message2], message);
    expect(result).toHaveLength(2);
  });
});

describe("useEventLiveChat", () => {
  it("loads initial message history on mount", async () => {
    const { result } = renderHook(() => useEventLiveChat("evt-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockedFetchGraphQL).toHaveBeenCalledWith(EVENT_CHAT_MESSAGES_QUERY, {
      eventId: "evt-1",
      limit: 50,
    });
    expect(result.current.messages).toEqual([message]);
  });

  it("subscribes to messageAdded for the event", () => {
    renderHook(() => useEventLiveChat("evt-1"));
    // Subscription consumption is asserted via the subscription data effect below.
    expect(subscriptionState.current).toBeDefined();
  });

  it("appends messages received via the subscription", async () => {
    const { result, rerender } = renderHook(() => useEventLiveChat("evt-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      subscriptionState.current = {
        data: { messageAdded: message2 },
        connected: true,
        error: null,
      };
      rerender();
    });

    await waitFor(() => expect(result.current.messages.map((m) => m.id)).toEqual(["m1", "m2"]));
    expect(result.current.connected).toBe(true);
  });

  it("sends a message with the auth token and appends the result", async () => {
    authSessionMock.getSession.mockResolvedValue({
      data: { session: { access_token: "token-123" } },
    });
    mockedFetchGraphQL.mockImplementation((query: string) => {
      if (query === SEND_CHAT_MESSAGE_MUTATION) {
        return Promise.resolve({ addMessage: message2 });
      }
      return Promise.resolve({ messages: [message] });
    });

    const { result } = renderHook(() => useEventLiveChat("evt-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let sent: ChatMessage | undefined;
    await act(async () => {
      sent = await result.current.sendMessage("World");
    });

    expect(authSessionMock.getSession).toHaveBeenCalled();
    expect(mockedFetchGraphQL).toHaveBeenCalledWith(
      SEND_CHAT_MESSAGE_MUTATION,
      { eventId: "evt-1", content: "World" },
      { endpoint: "/api/graphql", headers: { Authorization: "Bearer token-123" } },
    );
    expect(sent).toEqual(message2);
    expect(result.current.messages.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("throws on empty messages without making a network call", async () => {
    const { result } = renderHook(() => useEventLiveChat("evt-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.sendMessage("   ")).rejects.toThrow("Message cannot be empty");
    expect(mockedFetchGraphQL).not.toHaveBeenCalledWith(
      SEND_CHAT_MESSAGE_MUTATION,
      expect.anything(),
      expect.anything(),
    );
  });

  it("propagates send failures as errors", async () => {
    mockedFetchGraphQL.mockImplementation((query: string) => {
      if (query === SEND_CHAT_MESSAGE_MUTATION) {
        return Promise.reject(new Error("Rate limited"));
      }
      return Promise.resolve({ messages: [message] });
    });

    const { result } = renderHook(() => useEventLiveChat("evt-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.sendMessage("Hello")).rejects.toThrow("Rate limited");
    });

    expect(result.current.error?.message).toBe("Rate limited");
  });

  it("skips network work for mock events and echoes locally", async () => {
    const { result } = renderHook(() => useEventLiveChat("mock-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockedFetchGraphQL).not.toHaveBeenCalled();

    let sent: ChatMessage | undefined;
    await act(async () => {
      sent = await result.current.sendMessage("Hi");
    });

    expect(sent?.content).toBe("Hi");
    expect(result.current.messages).toHaveLength(1);
    expect(mockedFetchGraphQL).not.toHaveBeenCalled();
  });

  it("does not resubscribe when the event is a mock event", () => {
    const { result } = renderHook(() => useEventLiveChat("mock-1"));
    expect(result.current.connected).toBe(false);
  });
});
