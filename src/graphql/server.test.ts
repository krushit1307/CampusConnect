import { describe, it, expect, vi } from "vitest";
import { yoga, schema } from "../../graphql/server";
import {
  encodeCursor,
  decodeCursor,
  publishNotification,
  LRUCache,
  clubsCache,
  CLUBS_CACHE_KEY,
} from "../../graphql/resolvers";

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
      channel: vi.fn().mockImplementation(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      })),
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
          const result = {
            data: [{ id: "club-1", name: "Robotics Club" }],
            error: null,
          };
          const selectObj = {
            in: vi.fn().mockResolvedValue(result),
            then: (resolve: (value: typeof result) => void) => resolve(result),
          };
          return {
            select: vi.fn().mockReturnValue(selectObj),
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
      rpc: vi
        .fn()
        .mockImplementation(
          (fnName: string, args: { p_event_id: string; p_user_id: string; p_action: string }) => {
            if (fnName === "manage_event_rsvp") {
              if (args.p_event_id === "evt-full") {
                return Promise.resolve({
                  data: {
                    success: false,
                    code: "EVENT_FULL",
                    message: "Event is fully booked. No available spots remaining.",
                    available_spots: 0,
                    version: 5,
                  },
                  error: null,
                });
              }
              return Promise.resolve({
                data: {
                  success: true,
                  code: "RSVP_SUCCESS",
                  message: "RSVP confirmed!",
                  status: "CONFIRMED",
                  available_spots: 10,
                  version: 2,
                },
                error: null,
              });
            }
            return Promise.resolve({ data: null, error: null });
          },
        ),
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

  it("creates and publishes mention notification cleanly", () => {
    const notif = publishMentionNotification({
      mentionedUserId: "user-mention-123",
      authorName: "Alice",
      discussionTitle: "AI Project Ideas",
      link: "/discussions/456",
    });

    expect(notif.user_id).toBe("user-mention-123");
    expect(notif.type).toBe("mention");
    expect(notif.title).toBe("Mentioned in Discussion");
    expect(notif.message).toContain('Alice mentioned you in "AI Project Ideas"');
    expect(notif.link).toBe("/discussions/456");
  });

  it("creates and publishes event update notifications to all attendee IDs", () => {
    const attendeeUserIds = ["user-1", "user-2", "user-3"];
    const notifs = publishEventUpdateNotification({
      eventId: "event-789",
      eventTitle: "Annual Tech Symposium",
      updateSummary: "Location updated to Auditorium B",
      attendeeUserIds,
    });

    expect(notifs).toHaveLength(3);
    expect(notifs[0].user_id).toBe("user-1");
    expect(notifs[1].user_id).toBe("user-2");
    expect(notifs[2].user_id).toBe("user-3");
    expect(notifs[0].type).toBe("event_update");
    expect(notifs[0].title).toBe("Event Updated: Annual Tech Symposium");
    expect(notifs[0].message).toBe("Location updated to Auditorium B");
    expect(notifs[0].link).toBe("/events/event-789");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GraphQL rsvpToEvent Mutation Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("GraphQL rsvpToEvent Mutation", () => {
  it("schema includes rsvpToEvent mutation field and RsvpPayload type", () => {
    const mutationType = schema.getMutationType();
    expect(mutationType).toBeDefined();
    const field = mutationType!.getFields()["rsvpToEvent"];
    expect(field).toBeDefined();
    expect(field.type.toString()).toBe("RsvpPayload!");

    const payloadType = schema.getType("RsvpPayload");
    expect(payloadType).toBeDefined();
    // @ts-expect-error getFields is available on object types
    const fields = payloadType!.getFields();
    expect(fields).toHaveProperty("success");
    expect(fields).toHaveProperty("code");
    expect(fields).toHaveProperty("message");
    expect(fields).toHaveProperty("availableSpots");
    expect(fields).toHaveProperty("status");
    expect(fields).toHaveProperty("version");
  });

  it("executes rsvpToEvent mutation successfully via GraphQL Yoga", async () => {
    const query = /* GraphQL */ `
      mutation RsvpTest {
        rsvpToEvent(eventId: "evt-1", userId: "usr-1", action: "RSVP") {
          success
          code
          message
          availableSpots
          status
          version
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
    expect(result.data.rsvpToEvent).toEqual({
      success: true,
      code: "RSVP_SUCCESS",
      message: "RSVP confirmed!",
      availableSpots: 10,
      status: "CONFIRMED",
      version: 2,
    });
  });

  it("returns EVENT_FULL code when event is fully booked", async () => {
    const query = /* GraphQL */ `
      mutation RsvpFullTest {
        rsvpToEvent(eventId: "evt-full", userId: "usr-99", action: "RSVP") {
          success
          code
          message
          availableSpots
          version
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
    expect(result.data.rsvpToEvent).toEqual({
      success: false,
      code: "EVENT_FULL",
      message: "Event is fully booked. No available spots remaining.",
      availableSpots: 0,
      version: 5,
    });
  });
});

describe("In-Memory LRUCache Utility", () => {
  it("stores and retrieves values type-safely", () => {
    const cache = new LRUCache<string, number>(3);
    cache.set("x", 10);
    expect(cache.get("x")).toBe(10);
  });

  it("updates value and refreshes key placement on set/get", () => {
    const cache = new LRUCache<string, string>(2);
    cache.set("a", "alpha");
    cache.set("b", "beta");

    // Access "a" to make it the most recently used
    cache.get("a");

    // Set "c", which exceeds limit (2). Oldest "b" should be evicted
    cache.set("c", "gamma");

    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe("alpha");
    expect(cache.get("c")).toBe("gamma");
  });

  it("clears and deletes entries correctly", () => {
    const cache = new LRUCache<string, string>(5);
    cache.set("key", "val");
    expect(cache.size()).toBe(1);

    cache.delete("key");
    expect(cache.get("key")).toBeUndefined();
    expect(cache.size()).toBe(0);

    cache.set("k1", "v1");
    cache.set("k2", "v2");
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});

describe("GraphQL clubs Query Cached Resolver", () => {
  it("populates the LRU cache on first query, and returns cached values subsequently", async () => {
    // Clear any leftover state in the global cache
    clubsCache.clear();

    const query = /* GraphQL */ `
      query GetClubs {
        clubs {
          id
          name
        }
      }
    `;

    // 1. Initial query: cache is empty
    expect(clubsCache.get(CLUBS_CACHE_KEY)).toBeUndefined();
    const res1 = await yoga.fetch("http://localhost:4000/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const body1 = await res1.json();
    expect(body1.errors).toBeUndefined();
    expect(body1.data.clubs).toBeDefined();

    // The cache should now be populated with the mock clubs data
    const cachedData = clubsCache.get(CLUBS_CACHE_KEY);
    expect(cachedData).toBeDefined();
    expect(cachedData).toHaveLength(1);
    expect(cachedData![0].name).toBe("Robotics Club");

    // 2. Manipulate the cache directly to verify the resolver reads from cache
    const fakeCachedClub = [{ id: "fake-id", name: "Fake Cached Club" }];
    clubsCache.set(CLUBS_CACHE_KEY, fakeCachedClub);

    const res2 = await yoga.fetch("http://localhost:4000/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const body2 = await res2.json();
    expect(body2.errors).toBeUndefined();
    expect(body2.data.clubs).toEqual(fakeCachedClub);

    // 3. Clear cache and verify it falls back to fetching fresh database mock values
    clubsCache.delete(CLUBS_CACHE_KEY);
    const res3 = await yoga.fetch("http://localhost:4000/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const body3 = await res3.json();
    expect(body3.errors).toBeUndefined();
    expect(body3.data.clubs[0].name).toBe("Robotics Club");
  });
});
