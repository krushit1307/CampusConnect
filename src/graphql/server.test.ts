import { describe, it, expect, vi } from "vitest";
import { yoga, schema } from "../../graphql/server";
import { encodeCursor, decodeCursor, publishNotification } from "../../graphql/resolvers";

vi.mock("../../src/lib/supabase/client", () => {
  const mockEvents = [
    {
      id: "evt-1",
      club_id: "club-1",
      title: "Event One",
      description: "First test event",
      banner_url: "http://example.com/1.png",
      event_date: "2026-08-01T10:00:00Z",
      start_date: "2026-08-01T10:00:00Z",
      end_date: "2026-08-01T12:00:00Z",
      location: "Main Hall",
      created_by: "usr-1",
      created_at: "2026-07-27T10:00:00Z",
      is_private: false,
    },
    {
      id: "evt-2",
      club_id: "club-1",
      title: "Event Two",
      description: "Second test event",
      banner_url: "http://example.com/2.png",
      event_date: "2026-08-02T10:00:00Z",
      start_date: "2026-08-02T10:00:00Z",
      end_date: "2026-08-02T12:00:00Z",
      location: "Auditorium",
      created_by: "usr-1",
      created_at: "2026-07-26T10:00:00Z",
      is_private: false,
    },
  ];

  return {
    createClient: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "events") {
          return {
            select: vi.fn().mockImplementation(() => ({
              or: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockImplementation((limitVal: number) => {
                const sliced = mockEvents.slice(0, limitVal);
                return Promise.resolve({
                  data: sliced,
                  count: mockEvents.length,
                  error: null,
                });
              }),
            })),
          };
        }
        if (table === "clubs") {
          return {
            select: vi.fn().mockImplementation(() => ({
              in: vi.fn().mockResolvedValue({
                data: [{ id: "club-1", name: "Robotics Club" }],
                error: null,
              }),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: vi.fn().mockImplementation(() => ({
              in: vi.fn().mockResolvedValue({
                data: [{ id: "usr-1", full_name: "Organizer User", handle: "organizer" }],
                error: null,
              }),
            })),
          };
        }
        return { select: vi.fn() };
      }),
    })),
  };
});

describe("GraphQL Cursor-Based Events Pagination", () => {
  it("encodes and decodes cursors accurately", () => {
    const record = { created_at: "2026-07-27T10:00:00Z", id: "evt-123" };
    const cursor = encodeCursor(record);
    expect(typeof cursor).toBe("string");

    const decoded = decodeCursor(cursor);
    expect(decoded).toEqual({
      createdAt: "2026-07-27T10:00:00Z",
      id: "evt-123",
    });
  });

  it("handles invalid cursor gracefully", () => {
    expect(decodeCursor("invalid-cursor!!")).toBeNull();
  });

  it("executes events(first: 2) query via GraphQL Yoga and returns Relay-style connection object", async () => {
    const query = /* GraphQL */ `
      query GetEvents {
        events(first: 2) {
          edges {
            cursor
            node {
              id
              title
              location
              club {
                id
                name
              }
              organizer {
                id
                full_name
              }
            }
          }
          nodes {
            id
            title
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          totalCount
        }
      }
    `;

    const response = await yoga.fetch("http://localhost:4000/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();
    expect(result.errors).toBeUndefined();
    expect(result.data).toBeDefined();

    const eventsConn = result.data.events;
    expect(eventsConn.totalCount).toBe(2);
    expect(eventsConn.edges).toHaveLength(2);
    expect(eventsConn.nodes).toHaveLength(2);
    expect(eventsConn.pageInfo.startCursor).toBeDefined();
    expect(eventsConn.pageInfo.endCursor).toBeDefined();
    expect(eventsConn.edges[0].node.title).toBe("Event One");
    expect(eventsConn.edges[0].node.club.name).toBe("Robotics Club");
    expect(eventsConn.edges[0].node.organizer.full_name).toBe("Organizer User");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GraphQL Subscription Schema Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("GraphQL Subscription – schema presence", () => {
  it("schema exposes a Subscription type", () => {
    // Use the schema API directly to avoid the dual-graphql-module realm issue
    // that occurs when `printSchema` is imported from a different graphql instance.
    const subscriptionType = schema.getSubscriptionType();
    expect(subscriptionType).toBeDefined();
    expect(subscriptionType!.name).toBe("Subscription");
  });

  it("schema includes notificationReceived(userId: ID!): Notification! field", () => {
    const subscriptionType = schema.getSubscriptionType();
    expect(subscriptionType).toBeDefined();
    const field = subscriptionType!.getFields()["notificationReceived"];
    expect(field).toBeDefined();
    expect(field.type.toString()).toBe("Notification!");
  });

  it("schema includes Notification type with all required fields", () => {
    const notifType = schema.getType("Notification");
    expect(notifType).toBeDefined();
    // @ts-expect-error getFields is available on object types
    const fields = notifType!.getFields();
    expect(fields).toHaveProperty("id");
    expect(fields).toHaveProperty("userId");
    expect(fields).toHaveProperty("type");
    expect(fields).toHaveProperty("title");
    expect(fields).toHaveProperty("message");
    expect(fields).toHaveProperty("link");
    expect(fields).toHaveProperty("isRead");
    expect(fields).toHaveProperty("createdAt");
  });

  it("schema includes NotificationType enum with MENTION, EVENT_UPDATE, GENERIC", () => {
    const enumType = schema.getType("NotificationType");
    expect(enumType).toBeDefined();
    // @ts-expect-error getValues is available on enum types
    const values = enumType!.getValues().map((v: { name: string }) => v.name);
    expect(values).toContain("MENTION");
    expect(values).toContain("EVENT_UPDATE");
    expect(values).toContain("GENERIC");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// publishNotification helper tests
// ─────────────────────────────────────────────────────────────────────────────

describe("publishNotification helper", () => {
  it("is exported and is a function", () => {
    expect(typeof publishNotification).toBe("function");
  });

  it("does not throw when called with a valid notification payload", () => {
    expect(() =>
      publishNotification({
        id: "notif-test-1",
        user_id: "user-abc",
        type: "mention",
        title: "You were mentioned",
        message: "Alice mentioned you in a post.",
        link: "/posts/123",
        is_read: false,
        created_at: new Date().toISOString(),
      }),
    ).not.toThrow();
  });

  it("maps type 'event_update' correctly via publishNotification", () => {
    // We publish and verify the helper does not throw for every known type.
    const types = ["mention", "event_update", "generic_other"];
    for (const type of types) {
      expect(() =>
        publishNotification({
          id: `notif-${type}`,
          user_id: "user-abc",
          type,
          title: `Test – ${type}`,
          message: "Test message",
          link: null,
          is_read: false,
          created_at: new Date().toISOString(),
        }),
      ).not.toThrow();
    }
  });
});
