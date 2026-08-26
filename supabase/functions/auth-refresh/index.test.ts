import { hashToken, generateRefreshToken } from "./index.ts";

Deno.test("hashToken - computes SHA-256 hex string deterministically", async () => {
  const token = "sample_refresh_token_12345";
  const hash1 = await hashToken(token);
  const hash2 = await hashToken(token);

  if (hash1 !== hash2) {
    throw new Error(`Expected identical hashes but got ${hash1} vs ${hash2}`);
  }

  if (hash1.length !== 64) {
    throw new Error(`Expected 64 hex characters for SHA-256 hash, got ${hash1.length}`);
  }
});

Deno.test("hashToken - produces different hashes for different tokens", async () => {
  const hashA = await hashToken("token_A");
  const hashB = await hashToken("token_B");

  if (hashA === hashB) {
    throw new Error("Hashes for distinct tokens should not match");
  }
});

Deno.test("generateRefreshToken - creates formatted token string", () => {
  const token = generateRefreshToken();

  if (!token.startsWith("rt_")) {
    throw new Error(`Expected token to start with rt_, got ${token}`);
  }

  if (token.length < 30) {
    throw new Error(`Expected token to be sufficiently long, got length ${token.length}`);
  }
});
