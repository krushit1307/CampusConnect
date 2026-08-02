import { createPublicKey, verify } from "node:crypto";

/**
 * Checks that a Supabase Auth access token is signed with RS256 and that its
 * public key is published by the issuer's JWKS endpoint.
 *
 * Usage:
 *   SUPABASE_URL=https://<project-ref>.supabase.co JWT=<access-token> npm run auth:verify-jwks
 */

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const jwt = process.env.JWT;

if (!supabaseUrl || !jwt) {
  console.error(
    "SUPABASE_URL (or VITE_SUPABASE_URL) and JWT must both be set. See docs/JWT_SIGNING_KEY_ROTATION.md.",
  );
  process.exit(1);
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

function parseJwt(token) {
  const [encodedHeader, payload, signature, ...extra] = token.split(".");
  if (!encodedHeader || !payload || !signature || extra.length > 0) {
    throw new Error("JWT must contain exactly three dot-separated segments.");
  }

  return {
    header: JSON.parse(decodeBase64Url(encodedHeader).toString("utf8")),
    signedContent: `${encodedHeader}.${payload}`,
    signature: decodeBase64Url(signature),
  };
}

let parsedJwt;
try {
  parsedJwt = parseJwt(jwt);
} catch (error) {
  console.error(`Unable to read JWT header: ${error.message}`);
  process.exit(1);
}

const { header } = parsedJwt;

if (header.alg !== "RS256") {
  console.error(`Expected JWT alg to be RS256, received ${String(header.alg)}.`);
  process.exit(1);
}

if (typeof header.kid !== "string" || header.kid.length === 0) {
  console.error("JWT header does not contain a non-empty kid.");
  process.exit(1);
}

const issuer = new URL(supabaseUrl);
issuer.pathname = `${issuer.pathname.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`;

let response;
try {
  response = await fetch(issuer, { headers: { Accept: "application/json" } });
} catch (error) {
  console.error(`Could not fetch ${issuer}: ${error.message}`);
  process.exit(1);
}

if (!response.ok) {
  console.error(`JWKS request failed with ${response.status} ${response.statusText}.`);
  process.exit(1);
}

let jwks;
try {
  jwks = await response.json();
} catch (error) {
  console.error(`JWKS response was not valid JSON: ${error.message}`);
  process.exit(1);
}

const matchingKey = Array.isArray(jwks.keys)
  ? jwks.keys.find((key) => key.kid === header.kid)
  : undefined;

if (!matchingKey) {
  console.error(`JWKS does not contain the token kid (${header.kid}).`);
  process.exit(1);
}

if (matchingKey.kty !== "RSA" || matchingKey.alg !== "RS256") {
  console.error(
    `JWKS key ${header.kid} must be an RSA RS256 verification key; received ${matchingKey.kty}/${matchingKey.alg}.`,
  );
  process.exit(1);
}

if ("d" in matchingKey) {
  console.error("JWKS unexpectedly exposes private key material.");
  process.exit(1);
}

try {
  const publicKey = createPublicKey({ key: matchingKey, format: "jwk" });
  const validSignature = verify(
    "RSA-SHA256",
    Buffer.from(parsedJwt.signedContent),
    publicKey,
    parsedJwt.signature,
  );
  if (!validSignature) {
    throw new Error("JWT signature does not match the published public key.");
  }
} catch (error) {
  console.error(`Unable to verify JWT signature: ${error.message}`);
  process.exit(1);
}

console.log(`Verified RS256 JWT kid ${header.kid} against ${issuer}.`);
