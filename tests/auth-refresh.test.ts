import { describe, it, expect } from "vitest";

// Hashing helper implementation for testing in Node / Vitest environment
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateRefreshToken(): string {
  return "rt_" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

describe("Refresh Token Rotation Logic", () => {
  it("should compute SHA-256 token hash deterministically", async () => {
    const token = "sample_refresh_token_12345";
    const hash1 = await hashToken(token);
    const hash2 = await hashToken(token);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("should generate distinct hashes for different tokens", async () => {
    const hashA = await hashToken("token_alpha");
    const hashB = await hashToken("token_beta");

    expect(hashA).not.toBe(hashB);
  });

  it("should generate properly formatted refresh tokens", () => {
    const token = generateRefreshToken();
    expect(token.startsWith("rt_")).toBe(true);
    expect(token.length).toBeGreaterThan(30);
  });
});
