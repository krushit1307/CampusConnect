import { describe, it, expect, vi } from "vitest";

// Mock the client before importing the server
vi.mock("../lib/supabase/client", () => {
  const mSupabase = {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  };
  return {
    supabase: mSupabase,
    createClient: vi.fn(() => mSupabase),
  };
});

import { yoga } from "../../graphql/server";
import { supabase } from "../lib/supabase/client";

describe("GraphQL Auth Directive", () => {
  it("Unauthenticated request should return Unauthorized", async () => {
    const response = await yoga.fetch("http://localhost:4000/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "query { allUsers { id } }" }),
    });
    const json = await response.json();
    expect(json.errors[0].message).toBe("Not authenticated");
    expect(json.errors[0].extensions.code).toBe("UNAUTHENTICATED");
  });

  it("Authenticated USER should be rejected from ADMIN field", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: "user-123" } },
    } as any);
    vi.mocked(supabase.from).mockReturnValue({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { role: "USER" }, error: null }),
        }),
      }),
    } as any);

    const response = await yoga.fetch("http://localhost:4000/api/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token-user",
      },
      body: JSON.stringify({ query: "query { allUsers { id } }" }),
    });
    const json = await response.json();
    expect(json.errors[0].message).toBe("Not authorized");
    expect(json.errors[0].extensions.code).toBe("UNAUTHORIZED");
  });

  it("Authenticated ADMIN should receive data", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: "admin-123" } },
    } as any);

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => {
            const queryObj = Promise.resolve({
              data: [{ id: "user-123" }, { id: "admin-123" }],
              error: null,
            });
            (queryObj as any).eq = () => ({
              single: async () => ({ data: { role: "ADMIN" }, error: null }),
            });
            return queryObj;
          },
        } as any;
      }
      return {} as any;
    });

    const response = await yoga.fetch("http://localhost:4000/api/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token-admin",
      },
      body: JSON.stringify({ query: "query { allUsers { id } }" }),
    });
    const json = await response.json();
    expect(json.data.allUsers).toBeDefined();
    expect(json.data.allUsers.length).toBe(2);
  });

  it("Ensure existing queries continue working (clubs)", async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "clubs") {
        return {
          select: () => Promise.resolve({ data: [{ id: "club-1", name: "Club 1" }], error: null }),
        } as any;
      }
      return {} as any;
    });

    const response = await yoga.fetch("http://localhost:4000/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "query { clubs { id name } }" }),
    });
    const json = await response.json();
    expect(json.data.clubs).toBeDefined();
    expect(json.data.clubs[0].id).toBe("club-1");
  });
});
