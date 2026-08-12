import { describe, it, expect } from "vitest";
import { encodeRelayCursor, decodeRelayCursor } from "@/lib/relayPagination";

describe("relayPagination utilities", () => {
  it("generates the correct URL-safe Base64 cursor for 10 items", () => {
    const items = Array.from({ length: 10 }, (_, index) => ({
      id: `user-${index + 1}`,
      created_at: `2024-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
    }));

    const lastItem = items[items.length - 1];

    const cursor = encodeRelayCursor(lastItem.created_at, lastItem.id);

    const expectedPayload = `${lastItem.created_at},${lastItem.id}`;
    const expectedBase64 = btoa(unescape(encodeURIComponent(expectedPayload)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    expect(cursor).toBe(expectedBase64);
    expect(cursor).not.toMatch(/[+/=]/);

    const decoded = decodeRelayCursor(cursor);

    expect(decoded).toEqual({
      createdAt: lastItem.created_at,
      id: lastItem.id,
    });
  });

  it("returns null when the final page contains fewer items than the limit", () => {
    const items = Array.from({ length: 5 }, (_, index) => ({
      id: `user-${index + 1}`,
      created_at: `2024-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
    }));

    const limit = 10;

    const nextCursor =
      items.length === limit
        ? encodeRelayCursor(
            items[items.length - 1].created_at,
            items[items.length - 1].id,
          )
        : null;

    expect(nextCursor).toBeNull();
  });

  it("safely ignores a corrupted Base64 cursor", () => {
    expect(() => decodeRelayCursor("INVALID_BASE64!@#")).not.toThrow();
    expect(decodeRelayCursor("INVALID_BASE64!@#")).toBeNull();
  });

  it("safely ignores a cursor containing malformed JSON", () => {
    const malformedCursor = "eyJpZCI6fQ==";

    expect(() => decodeRelayCursor(malformedCursor)).not.toThrow();
    expect(decodeRelayCursor(malformedCursor)).toBeNull();
  });

  it("safely ignores an empty cursor", () => {
    expect(decodeRelayCursor("")).toBeNull();
  });

  it("correctly handles Unicode characters in cursor values", () => {
    const createdAt = "2024-01-01T12:00:00.000Z";
    const id = "学生-🚀-café-नमस्ते";

    const cursor = encodeRelayCursor(createdAt, id);

    expect(cursor).not.toMatch(/[+/=]/);

    expect(decodeRelayCursor(cursor)).toEqual({
      createdAt,
      id,
    });
  });

  it("returns null when the decoded cursor is missing its ID", () => {
    const payload = "2024-01-01T12:00:00.000Z,";

    const cursor = btoa(unescape(encodeURIComponent(payload)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    expect(decodeRelayCursor(cursor)).toBeNull();
  });

  it("returns null when the decoded cursor is missing its timestamp", () => {
    const payload = ",123";

    const cursor = btoa(payload)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    expect(decodeRelayCursor(cursor)).toBeNull();
  });

  it("preserves IDs containing commas", () => {
    const createdAt = "2024-01-01T12:00:00.000Z";
    const id = "student,123,abc";

    const cursor = encodeRelayCursor(createdAt, id);

    expect(decodeRelayCursor(cursor)).toEqual({
      createdAt,
      id,
    });
  });
});