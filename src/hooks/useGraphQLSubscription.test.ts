import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useGraphQLSubscription } from "./useGraphQLSubscription";

describe("useGraphQLSubscription hook (#1454)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("does not initiate fetch when operation is null or skip is true", () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    const { result } = renderHook(() => useGraphQLSubscription(null, { skip: false }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.connected).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("handles HTTP failure cleanly and sets error state", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const { result } = renderHook(() =>
      useGraphQLSubscription(
        {
          query: 'subscription { notificationReceived(userId: "user-1") { id } }',
        },
        { endpoint: "/api/graphql" },
      ),
    );

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.error?.message).toContain("GraphQL subscription HTTP error: 500");
    expect(result.current.connected).toBe(false);
  });

  it("decodes incoming SSE stream payload data into state", async () => {
    const mockPayload = {
      data: {
        notificationReceived: {
          id: "notif-99",
          userId: "user-123",
          type: "MENTION",
          title: "Mention Title",
          message: "You were mentioned in discussion",
          link: "/posts/1",
          isRead: false,
          createdAt: "2026-07-31T10:00:00Z",
        },
      },
    };

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(mockPayload)}\n\n`));
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    });

    const { result } = renderHook(() =>
      useGraphQLSubscription<{
        notificationReceived: {
          id: string;
          title: string;
        };
      }>({
        query: 'subscription { notificationReceived(userId: "user-123") { id title } }',
      }),
    );

    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    expect(result.current.data?.notificationReceived.id).toBe("notif-99");
    expect(result.current.data?.notificationReceived.title).toBe("Mention Title");
  });
});
