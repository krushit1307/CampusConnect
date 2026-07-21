import { describe, expect, it, vi } from "vitest";
import { buildQuery, executeQuery } from "./queryBuilder";

describe("queryBuilder", () => {
  it("builds a simple SELECT query with table name", () => {
    const result = buildQuery({ table: "users" });
    expect(result.sql).toBe('SELECT * FROM "users"');
    expect(result.params).toEqual([]);
  });

  it("handles selected columns, orderBy, limit, and offset", () => {
    const result = buildQuery({
      table: "events",
      select: ["id", "title", "created_at"],
      orderBy: { column: "created_at", ascending: false },
      limit: 10,
      offset: 20,
    });

    expect(result.sql).toBe(
      'SELECT "id", "title", "created_at" FROM "events" ORDER BY "created_at" DESC LIMIT $1 OFFSET $2',
    );
    expect(result.params).toEqual([10, 20]);
  });

  it("recursively builds nested AND / OR filter trees with parameters", () => {
    const result = buildQuery({
      table: "memberships",
      filter: {
        operator: "AND",
        conditions: [
          { field: "club_id", operator: "eq", value: "club_123" },
          {
            operator: "OR",
            conditions: [
              { field: "role", operator: "eq", value: "admin" },
              { field: "role", operator: "eq", value: "moderator" },
            ],
          },
        ],
      },
    });

    expect(result.sql).toBe(
      'SELECT * FROM "memberships" WHERE ("club_id" = $1 AND ("role" = $2 OR "role" = $3))',
    );
    expect(result.params).toEqual(["club_123", "admin", "moderator"]);
  });

  it("throws error for invalid table or column names to prevent SQL injection", () => {
    expect(() => buildQuery({ table: "users; DROP TABLE users;--" })).toThrow(
      'Invalid identifier name: "users; DROP TABLE users;--"',
    );

    expect(() =>
      buildQuery({
        table: "users",
        select: ["id", "name; SELECT * FROM secret;--"],
      }),
    ).toThrow('Invalid identifier name: "name; SELECT * FROM secret;--"');
  });

  it("handles IN and null operators correctly", () => {
    const result = buildQuery({
      table: "profiles",
      filter: {
        operator: "AND",
        conditions: [
          { field: "status", operator: "in", value: ["active", "pending"] },
          { field: "deleted_at", operator: "is_null" },
        ],
      },
    });

    expect(result.sql).toBe(
      'SELECT * FROM "profiles" WHERE ("status" IN ($1, $2) AND "deleted_at" IS NULL)',
    );
    expect(result.params).toEqual(["active", "pending"]);
  });

  it("calls Supabase rpc execute_raw properly in executeQuery", async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null });
    const mockSupabase = { rpc: mockRpc } as unknown as Parameters<typeof executeQuery>[0];

    const built = buildQuery({ table: "clubs" });
    const response = await executeQuery(mockSupabase, built);

    expect(mockRpc).toHaveBeenCalledWith("execute_raw", {
      query_text: 'SELECT * FROM "clubs"',
      query_params: [],
    });
    expect(response.data).toEqual([{ id: 1 }]);
    expect(response.error).toBeNull();
  });
});
