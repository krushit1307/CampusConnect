/**
 * WebAuthn cryptographic operations.
 * Handles COSE public key verification for ES256 and RS256.
 *
 * RFC references:
 *   COSE key params:  RFC 8152 (COSE), RFC 8230 (RSA in COSE)
 *   WebAuthn sig fmt: W3C WebAuthn §6.3 (ECDSA signatures are DER-encoded)
 */

import { decodeCBOR } from "./cbor.ts";

/**
 * COSE Algorithm Identifiers
 */
export const COSE_ALGS = {
    ES256: -7,   // ECDSA with SHA-256
    RS256: -257, // RSASSA-PKCS1-v1_5 with SHA-256
};

/**
 * Verifies a WebAuthn assertion signature.
 *
 * @param publicKeyBytes - COSE-encoded public key (Uint8Array from authenticator)
 * @param signature      - DER-encoded assertion signature from authenticator
 * @param clientDataHash - SHA-256 hash of clientDataJSON
 * @param authenticatorData - Raw assertion authenticator data bytes
 * @returns true if signature is valid
 */
export async function verifySignature(
    publicKeyBytes: Uint8Array,
    signature: Uint8Array,
    clientDataHash: Uint8Array,
    authenticatorData: Uint8Array,
): Promise<boolean> {
    try {
        // Decode COSE public key
        const coseKey = decodeCBOR(publicKeyBytes) as Map<number, unknown>;

        // COSE key type (kty): 2 = EC, 3 = RSA
        const kty = coseKey.get(1);
        if (typeof kty !== "number") {
            throw new Error("Invalid COSE key: missing kty");
        }

        // COSE algorithm identifier
        const alg = coseKey.get(3);
        if (typeof alg !== "number") {
            throw new Error("Invalid COSE key: missing alg");
        }

        // Signed data = authenticatorData || clientDataHash  (W3C WebAuthn §7.2 step 20)
        const signedData = new Uint8Array(authenticatorData.length + clientDataHash.length);
        signedData.set(authenticatorData);
        signedData.set(clientDataHash, authenticatorData.length);

        if (kty === 2 && alg === COSE_ALGS.ES256) {
            return await verifyES256(coseKey, signature, signedData);
        } else if (kty === 3 && alg === COSE_ALGS.RS256) {
            return await verifyRS256(coseKey, signature, signedData);
        } else {
            throw new Error(`Unsupported key type (${kty}) or algorithm (${alg})`);
        }
    } catch (err) {
        console.error("Signature verification error:", err);
        return false;
    }
}

/**
 * Verifies an ES256 (ECDSA P-256 / SHA-256) WebAuthn assertion.
 *
 * Authenticators produce DER-encoded ECDSA signatures (SEQUENCE { INTEGER r, INTEGER s }).
 * WebCrypto's ECDSA verify() expects IEEE P1363 format: raw 64-byte R || S.
 * We parse the DER to extract R and S and reassemble before calling verify().
 */
async function verifyES256(
    coseKey: Map<number, unknown>,
    signature: Uint8Array,
    data: Uint8Array,
): Promise<boolean> {
    try {
        // COSE EC2 key parameters (RFC 8152 §13.1.1):
        //   -1 = crv  (1 = P-256)
        //   -2 = x    (x-coordinate, 32 bytes)
        //   -3 = y    (y-coordinate, 32 bytes)
        const crv = coseKey.get(-1);
        const x = coseKey.get(-2);
        const y = coseKey.get(-3);

        if (typeof crv !== "number" || crv !== 1) {
            throw new Error("Invalid EC curve (expected P-256, crv=1)");
        }

        if (!(x instanceof Uint8Array) || !(y instanceof Uint8Array)) {
            throw new Error("Invalid EC public key coordinates");
        }

        if (x.length !== 32 || y.length !== 32) {
            throw new Error("Invalid P-256 coordinate length (expected 32 bytes each)");
        }

        // Reconstruct uncompressed public key: 0x04 || X || Y
        const rawPublicKey = new Uint8Array(65);
        rawPublicKey[0] = 0x04;
        rawPublicKey.set(x, 1);
        rawPublicKey.set(y, 33);

        const publicKey = await crypto.subtle.importKey(
            "raw",
            rawPublicKey,
            { name: "ECDSA", namedCurve: "P-256" },
            false,
            ["verify"],
        );

        // Authenticator signatures are DER-encoded (SEQUENCE { INTEGER r, INTEGER s }).
        // WebCrypto expects IEEE P1363 format: 64 bytes = R (32 bytes) || S (32 bytes).
        // Parse the DER to extract R and S, then zero-pad each to 32 bytes.
        const { r, s } = parseDERSignature(signature);

        const p1363Sig = new Uint8Array(64);
        // Right-align R and S into 32-byte slots (zero-pad on the left if short)
        p1363Sig.set(r.length <= 32 ? r : r.slice(r.length - 32), 32 - Math.min(r.length, 32));
        p1363Sig.set(s.length <= 32 ? s : s.slice(s.length - 32), 64 - Math.min(s.length, 32));

        const isValid = await crypto.subtle.verify(
            { name: "ECDSA", hash: "SHA-256" },
            publicKey,
            p1363Sig,
            data,
        );

        return isValid;
    } catch (err) {
        console.error("ES256 verification error:", err);
        return false;
    }
}

/**
 * Verifies an RS256 (RSASSA-PKCS1-v1_5 / SHA-256) WebAuthn assertion.
 *
 * COSE RSA key parameters (RFC 8230 §4):
 *   -1 = n  (RSA modulus)
 *   -2 = e  (RSA public exponent)
 */
async function verifyRS256(
    coseKey: Map<number, unknown>,
    signature: Uint8Array,
    data: Uint8Array,
): Promise<boolean> {
    try {
        // RFC 8230 §4: n is at label -1, e is at label -2
        const n = coseKey.get(-1);
        const e = coseKey.get(-2);

        if (!(n instanceof Uint8Array)) {
            throw new Error("Invalid RSA modulus (COSE label -1 missing or wrong type)");
        }

        if (!(e instanceof Uint8Array)) {
            throw new Error("Invalid RSA exponent (COSE label -2 missing or wrong type)");
        }

        const publicKey = await crypto.subtle.importKey(
            "jwk",
            {
                kty: "RSA",
                n: bufferToBase64Url(n),
                e: bufferToBase64Url(e),
                alg: "RS256",
                ext: true,
            },
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            false,
            ["verify"],
        );

        const isValid = await crypto.subtle.verify(
            "RSASSA-PKCS1-v1_5",
            publicKey,
            signature,
            data,
        );

        return isValid;
    } catch (err) {
        console.error("RS256 verification error:", err);
        return false;
    }
}

// ---------------------------------------------------------------------------
// DER / ASN.1 helpers
// ---------------------------------------------------------------------------

/**
 * Parses a DER-encoded ECDSA signature:
 *   SEQUENCE (0x30) { INTEGER r (0x02), INTEGER s (0x02) }
 *
 * Returns the raw (unsigned) big-endian bytes of R and S with any ASN.1
 * sign-padding byte (0x00) already stripped.
 */
function parseDERSignature(der: Uint8Array): { r: Uint8Array; s: Uint8Array } {
    let offset = 0;

    function readByte(): number {
        if (offset >= der.length) throw new Error("DER: unexpected end of input");
        return der[offset++];
    }

    function readLength(): number {
        const first = readByte();
        if (first < 0x80) return first;                        // short form
        const numBytes = first & 0x7f;
        if (numBytes === 0 || numBytes > 4) {
            throw new Error(`DER: unsupported length encoding (${numBytes} octets)`);
        }
        let len = 0;
        for (let i = 0; i < numBytes; i++) {
            len = (len << 8) | readByte();
        }
        return len;
    }

    function readInteger(): Uint8Array {
        const tag = readByte();
        if (tag !== 0x02) throw new Error(`DER: expected INTEGER tag (0x02), got 0x${tag.toString(16)}`);
        const len = readLength();
        const bytes = der.slice(offset, offset + len);
        offset += len;
        // Strip any leading 0x00 sign-padding byte added by DER for positive integers
        let start = 0;
        while (start < bytes.length - 1 && bytes[start] === 0x00) {
            start++;
        }
        return bytes.slice(start);
    }

    // Outer SEQUENCE
    const seqTag = readByte();
    if (seqTag !== 0x30) throw new Error(`DER: expected SEQUENCE tag (0x30), got 0x${seqTag.toString(16)}`);
    readLength(); // consume sequence length (we don't need it)

    const r = readInteger();
    const s = readInteger();

    return { r, s };
}

/**
 * Builds a DER-encoded ECDSA signature from raw R and S byte arrays.
 * Used only during registration — kept here for completeness, not used
 * in assertion verification (we parse DER, not build it).
 *
 * Handles ASN.1 long-form length encoding for SEQUENCE lengths ≥ 128.
 */
export function encodeDERSignature(r: Uint8Array, s: Uint8Array): Uint8Array {
    const rDER = encodeIntegerDER(r);
    const sDER = encodeIntegerDER(s);

    const seqContent = rDER.length + sDER.length;
    const lengthBytes = encodeDERLength(seqContent);

    const result = new Uint8Array(1 + lengthBytes.length + seqContent);
    let pos = 0;
    result[pos++] = 0x30; // SEQUENCE tag
    result.set(lengthBytes, pos);
    pos += lengthBytes.length;
    result.set(rDER, pos);
    pos += rDER.length;
    result.set(sDER, pos);

    return result;
}

/**
 * Encodes a non-negative integer as a DER INTEGER (tag 0x02 + length + value).
 * Adds a 0x00 sign byte when the high bit of the first value byte is set.
 */
function encodeIntegerDER(value: Uint8Array): Uint8Array {
    // Strip unnecessary leading zeros (keep at least one byte)
    let start = 0;
    while (start < value.length - 1 && value[start] === 0x00 && (value[start + 1] & 0x80) === 0) {
        start++;
    }
    const trimmed = value.slice(start);

    // Prepend 0x00 if the high bit is set (DER positive integer)
    const needsPad = (trimmed[0] & 0x80) !== 0;
    const valueBytes = needsPad
        ? new Uint8Array([0x00, ...trimmed])
        : trimmed;

    const lengthBytes = encodeDERLength(valueBytes.length);
    const result = new Uint8Array(1 + lengthBytes.length + valueBytes.length);
    let pos = 0;
    result[pos++] = 0x02; // INTEGER tag
    result.set(lengthBytes, pos);
    pos += lengthBytes.length;
    result.set(valueBytes, pos);

    return result;
}

/**
 * Encodes a DER length field, supporting both short-form (< 128)
 * and long-form (≥ 128) per ASN.1/DER spec.
 */
function encodeDERLength(length: number): Uint8Array {
    if (length < 0x80) {
        // Short form: single byte
        return new Uint8Array([length]);
    } else if (length <= 0xff) {
        // Long form: 0x81 + one length byte
        return new Uint8Array([0x81, length]);
    } else if (length <= 0xffff) {
        // Long form: 0x82 + two length bytes
        return new Uint8Array([0x82, (length >> 8) & 0xff, length & 0xff]);
    } else {
        throw new Error(`DER: length ${length} exceeds supported range`);
    }
}

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

/**
 * Converts a Uint8Array to base64url (no padding).
 * Safe for large buffers — avoids String.fromCharCode spread limit.
 */
function bufferToBase64Url(buffer: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < buffer.length; i++) {
        binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

// ---------------------------------------------------------------------------
// Authenticator Data Helpers
// ---------------------------------------------------------------------------

/**
 * Parses the WebAuthn authenticator data (authData) structure.
 * 
 * Works for both registration (includes attested credential data / COSE public key)
 * and authentication (only flags, rpIdHash, signCount).
 */
export function parseAuthenticatorData(authData: Uint8Array) {
    if (authData.length < 37) {
        throw new Error("Invalid authenticator data: too short");
    }

    const rpIdHash = authData.slice(0, 32);
    const flags = authData[32];
    const userPresent = (flags & 0x01) !== 0;
    const userVerified = (flags & 0x04) !== 0;
    const backupEligible = (flags & 0x08) !== 0;
    const backupState = (flags & 0x10) !== 0;
    const attestedCredentialDataPresent = (flags & 0x40) !== 0;

    // SignCount: big-endian uint32 at bytes 33–36
    const signCount =
        ((authData[33] << 24) |
            (authData[34] << 16) |
            (authData[35] << 8) |
            authData[36]) >>> 0; // >>> 0 coerces to unsigned 32-bit integer

    let aaguid: string | null = null;
    let credentialId: Uint8Array | null = null;
    let publicKeyBytes: Uint8Array | null = null;

    if (attestedCredentialDataPresent) {
        if (authData.length < 55) {
            throw new Error("Invalid authenticator data: missing attested credential data");
        }

        // AAGUID is 16 bytes starting at offset 37
        const aaguidBytes = authData.slice(37, 53);
        aaguid = (Array.from(aaguidBytes) as number[])
            .map((b: number) => b.toString(16).padStart(2, "0"))
            .join("");

        // Credential ID length is 2 bytes (big-endian) at offset 53
        const credIdLength = (authData[53] << 8) | authData[54];

        // Credential ID starts at offset 55
        if (authData.length < 55 + credIdLength) {
            throw new Error("Invalid authenticator data: credential ID truncated");
        }
        credentialId = authData.slice(55, 55 + credIdLength);

        // Everything after credential ID is the COSE public key (CBOR encoded)
        publicKeyBytes = authData.slice(55 + credIdLength);
    }

    return {
        rpIdHash,
        userPresent,
        userVerified,
        backupEligible,
        backupState,
        attestedCredentialDataPresent,
        signCount,
        aaguid,
        credentialId,
        publicKeyBytes,
    };
}

/**
 * Constant-time comparison of two equal-length Uint8Arrays.
 * Returns true if every byte matches.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a[i] ^ b[i];
    }
    return diff === 0;
}

/**
 * Verifies the RP ID hash embedded in authenticator data against the
 * expected rpId string (W3C WebAuthn §7.2 step 16).
 */
export async function verifyRpIdHash(
    rpIdHash: Uint8Array,
    expectedRpId: string,
): Promise<boolean> {
    const rpIdBytes = new TextEncoder().encode(expectedRpId);
    const expectedHash = new Uint8Array(
        await crypto.subtle.digest("SHA-256", rpIdBytes),
    );
    return timingSafeEqual(rpIdHash, expectedHash);
}
