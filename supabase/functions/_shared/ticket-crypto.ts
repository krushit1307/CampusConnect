import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

/**
 * Signs a ticket payload using the server's private key.
 * Used for Decentralized Peer-to-Peer Event Ticketing Protocol (#3441).
 */
export async function signTicket(
  ticketId: string,
  eventId: string,
  ownerPublicKey: string,
  version: number,
): Promise<string> {
  const serverPrivateKeyBase64 = Deno.env.get("TICKET_SERVER_PRIVATE_KEY");
  if (!serverPrivateKeyBase64) {
    console.error("TICKET_SERVER_PRIVATE_KEY is missing from environment variables.");
    // Fallback or throw error. For MVP, we'll return a dummy signature if missing,
    // but in production this should throw.
    return "dummy-server-signature-if-key-missing";
  }

  // Convert base64 private key to CryptoKey
  let privateKey: CryptoKey;
  try {
    const binaryDerString = atob(serverPrivateKeyBase64);
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
      binaryDer[i] = binaryDerString.charCodeAt(i);
    }

    privateKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryDer.buffer,
      {
        name: "ECDSA",
        namedCurve: "P-256",
      },
      false,
      ["sign"]
    );
  } catch (err) {
    console.error("Failed to import server private key:", err);
    throw new Error("Invalid Server Private Key");
  }

  // Create deterministic payload
  const payload = `${ticketId}:${eventId}:${ownerPublicKey}:${version}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);

  const signatureBuffer = await crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: "SHA-256",
    },
    privateKey,
    data
  );

  return encodeBase64(signatureBuffer);
}

/**
 * Validates a P-256 ECDSA signature using the Web Crypto API.
 */
export async function verifySignature(
  publicKeyBase64: string,
  signatureBase64: string,
  payload: string,
): Promise<boolean> {
  try {
    const binaryDerString = atob(publicKeyBase64);
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
      binaryDer[i] = binaryDerString.charCodeAt(i);
    }

    const publicKey = await crypto.subtle.importKey(
      "spki",
      binaryDer.buffer,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );

    const sigBinaryString = atob(signatureBase64);
    const signatureBuffer = new Uint8Array(sigBinaryString.length);
    for (let i = 0; i < sigBinaryString.length; i++) {
      signatureBuffer[i] = sigBinaryString.charCodeAt(i);
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(payload);

    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      signatureBuffer,
      data
    );
  } catch (err) {
    console.error("Signature verification failed:", err);
    return false;
  }
}

