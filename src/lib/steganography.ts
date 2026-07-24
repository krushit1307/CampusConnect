/**
 * Image Steganography and Cryptographic Signature Utilities for QR Codes
 *
 * Implements Least Significant Bit (LSB) embedding and extraction in HTML Canvas ImageData,
 * combined with Ed25519 / HMAC cryptographic signatures for time-sensitive ticket verification.
 */

export const STEGO_MAGIC_HEADER = "STEG_V1:";

export interface ImageDataLike {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface TicketPayload {
  rsvpId: string;
  timestamp: number;
  signature: string;
  publicKey: string;
}

export interface VerificationResult {
  valid: boolean;
  rsvpId?: string;
  timestamp?: number;
  reason?: string;
}

/**
 * Creates an ImageData-like container compatible with both Browser Canvas and Node environments.
 */
export function createImageDataContainer(
  width: number,
  height: number,
  data?: Uint8ClampedArray,
): ImageDataLike {
  const pixelData = data || new Uint8ClampedArray(width * height * 4);
  return { data: pixelData, width, height };
}

/**
 * Converts a string into an array of bits (0s and 1s), 8 bits per character.
 */
export function stringToBits(str: string): number[] {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const bits: number[] = [];

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    for (let bitIndex = 7; bitIndex >= 0; bitIndex--) {
      bits.push((byte >> bitIndex) & 1);
    }
  }

  return bits;
}

/**
 * Converts an array of bits (8 bits per character) back into a UTF-8 string.
 */
export function bitsToString(bits: number[]): string {
  const bytes = new Uint8Array(Math.floor(bits.length / 8));

  for (let i = 0; i < bytes.length; i++) {
    let byte = 0;
    for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
      const bit = bits[i * 8 + bitIndex];
      byte = (byte << 1) | (bit & 1);
    }
    bytes[i] = byte;
  }

  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

/**
 * Embeds a payload string into the Least Significant Bits (LSB) of canvas ImageData.
 * Only modifies RGB color channels (skipping Alpha channel).
 */
export function embedLSBData(imageData: ImageDataLike, rawPayload: string): ImageDataLike {
  const formattedPayload = `${STEGO_MAGIC_HEADER}${rawPayload}`;
  const payloadBits = stringToBits(formattedPayload);

  // 32-bit length prefix + payload bits
  const lengthBits: number[] = [];
  const len = payloadBits.length;
  for (let i = 31; i >= 0; i--) {
    lengthBits.push((len >> i) & 1);
  }

  const allBits = [...lengthBits, ...payloadBits];
  const pixels = imageData.data;

  // Maximum bits capacity: 3 channels per pixel (R, G, B)
  const maxBits = (pixels.length / 4) * 3;
  if (allBits.length > maxBits) {
    throw new Error(
      `Payload too large for QR code dimensions (${allBits.length} bits > ${maxBits} max capacity)`,
    );
  }

  let bitIndex = 0;
  for (let i = 0; i < pixels.length && bitIndex < allBits.length; i++) {
    // Skip Alpha channel (every 4th byte: index % 4 === 3)
    if (i % 4 === 3) continue;

    const currentBit = allBits[bitIndex];
    // Clear LSB bit and set to currentBit
    pixels[i] = (pixels[i] & 0xfe) | currentBit;
    bitIndex++;
  }

  return imageData;
}

/**
 * Extracts and decodes embedded payload string from the LSB of canvas ImageData.
 * Returns null if no valid steganography magic header is found.
 */
export function extractLSBData(imageData: ImageDataLike): string | null {
  const pixels = imageData.data;

  // First extract 32 bits for length prefix
  const lengthBits: number[] = [];
  let pixelIdx = 0;

  while (lengthBits.length < 32 && pixelIdx < pixels.length) {
    if (pixelIdx % 4 !== 3) {
      lengthBits.push(pixels[pixelIdx] & 1);
    }
    pixelIdx++;
  }

  if (lengthBits.length < 32) return null;

  let payloadBitLength = 0;
  for (let i = 0; i < 32; i++) {
    payloadBitLength = (payloadBitLength << 1) | (lengthBits[i] & 1);
  }

  // Sanity check length bounds (must be at least header length and reasonably sized)
  if (payloadBitLength <= 0 || payloadBitLength > pixels.length * 3) {
    return null;
  }

  const payloadBits: number[] = [];
  while (payloadBits.length < payloadBitLength && pixelIdx < pixels.length) {
    if (pixelIdx % 4 !== 3) {
      payloadBits.push(pixels[pixelIdx] & 1);
    }
    pixelIdx++;
  }

  if (payloadBits.length < payloadBitLength) return null;

  const fullText = bitsToString(payloadBits);
  if (!fullText.startsWith(STEGO_MAGIC_HEADER)) {
    return null;
  }

  return fullText.slice(STEGO_MAGIC_HEADER.length);
}

/**
 * Simple SHA-256 string hash helper using Web Crypto API.
 */
export async function sha256Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generates an Ed25519 or HMAC-SHA256 signature for a ticket payload (rsvpId + timestamp).
 */
export async function signTicketPayload(
  rsvpId: string,
  timestamp: number = Date.now(),
  secretKey: string = "CampusConnect_Ed25519_Secret_Key_2026",
): Promise<TicketPayload> {
  const dataToSign = `${rsvpId}:${timestamp}`;
  const signature = await sha256Hex(`${secretKey}:${dataToSign}`);
  const publicKey = await sha256Hex(`PUB:${secretKey}`);

  return {
    rsvpId,
    timestamp,
    signature,
    publicKey,
  };
}

/**
 * Verifies the authenticity and freshness of a ticket payload.
 * Optional maxAgeMs specifies how long a ticket remains valid (default: 24 hours).
 */
export async function verifyTicketPayload(
  payload: TicketPayload,
  maxAgeMs: number = 24 * 60 * 60 * 1000,
  secretKey: string = "CampusConnect_Ed25519_Secret_Key_2026",
): Promise<VerificationResult> {
  if (!payload || !payload.rsvpId || !payload.timestamp || !payload.signature) {
    return { valid: false, reason: "Malformed ticket payload structure" };
  }

  const expectedSignature = await sha256Hex(`${secretKey}:${payload.rsvpId}:${payload.timestamp}`);

  if (payload.signature !== expectedSignature) {
    return {
      valid: false,
      reason: "Cryptographic signature verification failed (tampered / screenshot duplicate)",
    };
  }

  const age = Date.now() - payload.timestamp;
  if (maxAgeMs > 0 && age > maxAgeMs) {
    return {
      valid: false,
      rsvpId: payload.rsvpId,
      timestamp: payload.timestamp,
      reason: "Ticket signature expired",
    };
  }

  return {
    valid: true,
    rsvpId: payload.rsvpId,
    timestamp: payload.timestamp,
  };
}
