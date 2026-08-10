import { describe, it, expect } from "vitest";
import { encodeRelayCursor, decodeRelayCursor } from "@/lib/relayPagination";

describe("relayPagination utilities", () => {
  it("encodes and decodes a timestamp and UUID cursor correctly", () => {
    const createdAt = "2026-07-31T09:00:00.000Z";
    const id = "123e4567-e89b-12d3-a456-426614174000";

    const cursor = encodeRelayCursor(createdAt, id);
    expect(cursor).toBeTypeOf("string");
    expect(cursor.length).toBeGreaterThan(0);

    const decoded = decodeRelayCursor(cursor);
    expect(decoded).not.toBeNull();
    expect(decoded?.createdAt).toBe(createdAt);
    expect(decoded?.id).toBe(id);
  });

  it("returns null when decoding an invalid or empty cursor", () => {
    expect(decodeRelayCursor("")).toBeNull();
    expect(decodeRelayCursor("invalid-base64-string!@#$%")).toBeNull();
  });
});
