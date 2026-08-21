/**
 * Simple CBOR decoder for WebAuthn public keys.
 * Handles COSE key format (RFC 8152).
 */

export function decodeCBOR(bytes: Uint8Array): Map<number, unknown> {
  let offset = 0;

  function read(): unknown {
    if (offset >= bytes.length) {
      throw new Error("CBOR: Unexpected end of input");
    }

    const byte = bytes[offset++];
    const majorType = (byte & 0xe0) >> 5;
    const additionalInfo = byte & 0x1f;

    switch (majorType) {
      case 0: // Unsigned integer
        if (additionalInfo < 24) return additionalInfo;
        if (additionalInfo === 24) return bytes[offset++];
        if (additionalInfo === 25) {
          const val = (bytes[offset] << 8) | bytes[offset + 1];
          offset += 2;
          return val;
        }
        if (additionalInfo === 26) {
          const val =
            (bytes[offset] << 24) |
            (bytes[offset + 1] << 16) |
            (bytes[offset + 2] << 8) |
            bytes[offset + 3];
          offset += 4;
          return val;
        }
        throw new Error(`CBOR: Unsupported integer encoding: ${additionalInfo}`);

      case 1: // Negative integer
        if (additionalInfo < 24) return -(additionalInfo + 1);
        if (additionalInfo === 24) return -(bytes[offset++] + 1);
        if (additionalInfo === 25) {
          const val = (bytes[offset] << 8) | bytes[offset + 1];
          offset += 2;
          return -(val + 1);
        }
        if (additionalInfo === 26) {
          const val =
            (bytes[offset] << 24) |
            (bytes[offset + 1] << 16) |
            (bytes[offset + 2] << 8) |
            bytes[offset + 3];
          offset += 4;
          return -(val + 1);
        }
        throw new Error(`CBOR: Unsupported negative integer encoding: ${additionalInfo}`);

      case 2: // Byte string
        let length = additionalInfo;
        if (additionalInfo === 24) length = bytes[offset++];
        else if (additionalInfo === 25) length = (bytes[offset++] << 8) | bytes[offset++];
        else if (additionalInfo === 26)
          length =
            (bytes[offset++] << 24) |
            (bytes[offset++] << 16) |
            (bytes[offset++] << 8) |
            bytes[offset++];
        else if (additionalInfo === 31)
          throw new Error("CBOR: Indefinite-length byte strings not supported");

        const byteStr = bytes.slice(offset, offset + length);
        offset += length;
        return byteStr;

      case 3: // Text string
        let textLength = additionalInfo;
        if (additionalInfo === 24) textLength = bytes[offset++];
        else if (additionalInfo === 25) textLength = (bytes[offset++] << 8) | bytes[offset++];
        else if (additionalInfo === 26)
          textLength =
            (bytes[offset++] << 24) |
            (bytes[offset++] << 16) |
            (bytes[offset++] << 8) |
            bytes[offset++];
        else if (additionalInfo === 31)
          throw new Error("CBOR: Indefinite-length text strings not supported");

        const textStr = new TextDecoder().decode(bytes.slice(offset, offset + textLength));
        offset += textLength;
        return textStr;

      case 5: // Map
        let mapSize = additionalInfo;
        if (additionalInfo === 24) mapSize = bytes[offset++];
        else if (additionalInfo === 25) mapSize = (bytes[offset++] << 8) | bytes[offset++];
        else if (additionalInfo === 26)
          mapSize =
            (bytes[offset++] << 24) |
            (bytes[offset++] << 16) |
            (bytes[offset++] << 8) |
            bytes[offset++];
        else if (additionalInfo === 31)
          throw new Error("CBOR: Indefinite-length maps not supported");

        const map = new Map<number, unknown>();
        for (let i = 0; i < mapSize; i++) {
          const key = read();
          const value = read();
          if (typeof key === "number") {
            map.set(key, value);
          }
        }
        return map;

      default:
        throw new Error(`CBOR: Unsupported major type: ${majorType}`);
    }
  }

  const result = read();
  if (result instanceof Map) {
    return result;
  }
  throw new Error("CBOR: Expected a CBOR map");
}

/**
 * Encodes a CBOR map back to bytes.
 */
export function encodeCBOR(map: Map<number, unknown>): Uint8Array {
  const parts: Uint8Array[] = [];

  // Encode map header
  const size = map.size;
  if (size < 24) {
    parts.push(new Uint8Array([0xa0 | size]));
  } else if (size < 256) {
    parts.push(new Uint8Array([0xb8, size]));
  } else if (size < 65536) {
    parts.push(new Uint8Array([0xb9, (size >> 8) & 0xff, size & 0xff]));
  }

  // Encode map entries
  for (const [key, value] of map) {
    // Encode key (integer)
    if (key < 0) {
      const absKey = Math.abs(key) - 1;
      if (absKey < 24) {
        parts.push(new Uint8Array([0x20 | absKey]));
      } else {
        parts.push(new Uint8Array([0x38, absKey]));
      }
    } else {
      if (key < 24) {
        parts.push(new Uint8Array([key]));
      } else if (key < 256) {
        parts.push(new Uint8Array([0x18, key]));
      } else {
        parts.push(new Uint8Array([0x19, (key >> 8) & 0xff, key & 0xff]));
      }
    }

    // Encode value
    if (typeof value === "number") {
      if (value < 0) {
        const absVal = Math.abs(value) - 1;
        if (absVal < 24) {
          parts.push(new Uint8Array([0x20 | absVal]));
        } else if (absVal < 256) {
          parts.push(new Uint8Array([0x38, absVal]));
        }
      } else {
        if (value < 24) {
          parts.push(new Uint8Array([value]));
        } else if (value < 256) {
          parts.push(new Uint8Array([0x18, value]));
        } else {
          parts.push(new Uint8Array([0x19, (value >> 8) & 0xff, value & 0xff]));
        }
      }
    } else if (value instanceof Uint8Array) {
      // Byte string
      const len = value.length;
      if (len < 24) {
        parts.push(new Uint8Array([0x40 | len]));
      } else if (len < 256) {
        parts.push(new Uint8Array([0x58, len]));
      } else {
        parts.push(new Uint8Array([0x59, (len >> 8) & 0xff, len & 0xff]));
      }
      parts.push(value);
    }
  }

  // Combine all parts
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}
