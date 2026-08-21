import { describe, expect, it } from "vitest";
import { REDACTED, SENSITIVE_KEYS, redactDeep, redactPaths } from "./logger";

describe("redactDeep", () => {
  it("redacts sensitive top-level keys", () => {
    const payload = { email: "user@campus.com", password: "hunter2" };
    expect(redactDeep(payload)).toEqual({
      email: REDACTED,
      password: REDACTED,
    });
  });

  it("redacts deeply nested sensitive keys", () => {
    const payload = {
      user: {
        profile: {
          email: "user@campus.com",
        },
        password: "hunter2",
      },
    };
    expect(redactDeep(payload)).toEqual({
      user: {
        profile: { email: REDACTED },
        password: REDACTED,
      },
    });
  });

  it("redacts sensitive keys inside arrays", () => {
    const payload = { users: [{ email: "user@campus.com" }] };
    expect(redactDeep(payload)).toEqual({ users: [{ email: REDACTED }] });
  });

  it("redacts header-style keys case-insensitively", () => {
    const payload = {
      Authorization: "Bearer secret",
      "X-Api-Token": "abc123",
      email: "user@campus.com",
    };
    expect(redactDeep(payload)).toEqual({
      Authorization: REDACTED,
      "X-Api-Token": REDACTED,
      email: REDACTED,
    });
  });

  it("redacts every key from the configured list", () => {
    const payload = Object.fromEntries(SENSITIVE_KEYS.map((key) => [key, "value"]));
    const sanitized = redactDeep(payload);
    for (const key of SENSITIVE_KEYS) {
      expect(sanitized[key]).toBe(REDACTED);
    }
  });

  it("does not mutate the original object", () => {
    const payload = { email: "user@campus.com", nested: { password: "hunter2" } };
    redactDeep(payload);
    expect(payload).toEqual({
      email: "user@campus.com",
      nested: { password: "hunter2" },
    });
  });

  it("preserves non-sensitive values", () => {
    const payload = { name: "Campus Connect", tags: ["alpha", "beta"], count: 42 };
    expect(redactDeep(payload)).toEqual(payload);
  });

  it("handles circular references without infinite recursion", () => {
    const payload: Record<string, unknown> = { name: "nested" };
    payload.self = payload;
    const result = redactDeep(payload);
    expect(result.name).toBe("nested");
    expect(result.self).toBe(result);
  });

  it("redacts a nested graph matching the issue's login payload", () => {
    const payload = {
      path: "/api/login",
      body: {
        email: "student@campus.com",
        password: "plaintext-password",
        card_number: "4111 1111 1111 1111",
      },
    };
    expect(redactDeep(payload)).toEqual({
      path: "/api/login",
      body: {
        email: REDACTED,
        password: REDACTED,
        card_number: REDACTED,
      },
    });
  });
});

describe("redactPaths", () => {
  it("builds nested wildcard paths for every sensitive key", () => {
    for (const key of SENSITIVE_KEYS) {
      expect(redactPaths).toContain(key);
      expect(redactPaths).toContain(`*.${key}`);
      expect(redactPaths).toContain(`**.*.${key}`);
    }
  });
});
