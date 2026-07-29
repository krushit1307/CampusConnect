import { describe, it, expect, vi } from "vitest";
import { yoga } from "../../graphql/server";
import { encodeCursor, decodeCursor } from "../../graphql/resolvers";

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
