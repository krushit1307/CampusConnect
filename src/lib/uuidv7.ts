/**
 * UUIDv7 Generator Utility
 * 
 * Standard UUIDv4s are completely random, which causes severe B-Tree index
 * fragmentation in Postgres on massive tables like `events` and `posts`.
 * UUIDv7 solves this by using a 48-bit Unix timestamp in milliseconds as the
 * prefix, followed by 74 bits of randomness. This makes the IDs naturally
 * time-sortable and sequentially insertable, drastically speeding up write
 * performance and cursor-based pagination.
 * 
 * Since native Postgres doesn't fully support v7 out of the box without
 * custom extensions, we generate them securely on the client/backend using
 * the Web Crypto API.
 */

/**
 * Generates a time-sortable UUIDv7 string.
 * 
 * Structure:
 * - 48 bits: Unix timestamp in milliseconds
 * - 4 bits: Version (0111 for v7)
 * - 12 bits: Random data
 * - 2 bits: Variant (10 for RFC 4122)
 * - 62 bits: Random data
 * 
 * @returns A standard 36-character UUID string (e.g., '018f3b2c-1d4e-7a9b-8c3d-123456789abc')
 */
export function generateUUIDv7(): string {
    // 1. Get the current Unix timestamp in milliseconds (48 bits)
    const timestamp = Date.now();

    // 2. Allocate a 16-byte (128-bit) Uint8Array to hold the UUID
    const uuidBytes = new Uint8Array(16);

    // 3. Fill the array with cryptographically secure random bytes
    // We will overwrite the first 6 bytes with the timestamp later
    crypto.getRandomValues(uuidBytes);

    // 4. Inject the 48-bit timestamp into the first 6 bytes (Big Endian)
    // Byte 0: bits 47-40
    uuidBytes[0] = (timestamp / 0x10000000000) & 0xff;
    // Byte 1: bits 39-32
    uuidBytes[1] = (timestamp / 0x100000000) & 0xff;
    // Byte 2: bits 31-24
    uuidBytes[2] = (timestamp / 0x1000000) & 0xff;
    // Byte 3: bits 23-16
    uuidBytes[3] = (timestamp / 0x10000) & 0xff;
    // Byte 4: bits 15-8
    uuidBytes[4] = (timestamp / 0x100) & 0xff;
    // Byte 5: bits 7-0
    uuidBytes[5] = timestamp & 0xff;

    // 5. Set the Version bits (byte 6) to 0111 (7)
    // Clear the top 4 bits and set them to 0111
    uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x70;

    // 6. Set the Variant bits (byte 8) to 10
    // Clear the top 2 bits and set them to 10 (which is 0x80 in the top 2 bits)
    uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80;

    // 7. Convert the byte array to a standard hex string
    const hex = Array.from(uuidBytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');

    // 8. Format the hex string into the standard 8-4-4-4-12 UUID layout
    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32),
    ].join('-');
}

/**
 * Extracts the Unix timestamp in milliseconds from a UUIDv7 string.
 * This is useful for debugging or displaying the exact creation time
 * without needing a separate `created_at` column in the database.
 * 
 * @param uuid - The UUIDv7 string to parse
 * @returns The Unix timestamp in milliseconds, or null if the UUID is invalid/not v7
 */
export function extractTimestampFromUUIDv7(uuid: string): number | null {
    // Validate basic UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
        return null;
    }

    // Remove hyphens to get the raw hex string
    const hex = uuid.replace(/-/g, '');

    // Extract the first 12 hex characters (48 bits) which represent the timestamp
    const timestampHex = hex.slice(0, 12);

    // Parse the hex string to an integer
    const timestamp = parseInt(timestampHex, 16);

    // Basic sanity check: timestamp should be reasonably recent (after year 2020)
    // and not in the distant future (e.g., year 2100)
    const minValidTimestamp = 1577836800000; // Jan 1, 2020
    const maxValidTimestamp = 4102444800000; // Jan 1, 2100

    if (timestamp < minValidTimestamp || timestamp > maxValidTimestamp) {
        // It might be a UUIDv4 that accidentally passed validation, or corrupted
        return null;
    }

    return timestamp;
}

/**
 * Compares two UUIDv7 strings lexicographically to determine chronological order.
 * Because UUIDv7 prefixes the ID with the timestamp, a standard string
 * comparison (`idA > idB`) perfectly mirrors chronological order (`timeA > timeB`).
 * 
 * @param idA - First UUIDv7 string
 * @param idB - Second UUIDv7 string
 * @returns 1 if idA is newer, -1 if idB is newer, 0 if they are identical
 */
export function compareUUIDv7(idA: string, idB: string): number {
    if (idA === idB) return 0;
    return idA > idB ? 1 : -1;
}

/**
 * Generates a batch of UUIDv7s.
 * Useful for bulk inserts or optimistic UI updates where multiple
 * records are created in the same millisecond. We append a microsecond
 * offset to ensure strict monotonicity even within the same millisecond.
 * 
 * @param count - Number of UUIDs to generate
 * @returns Array of UUIDv7 strings
 */
export function generateBatchUUIDv7(count: number): string[] {
    const uuids: string[] = [];
    const baseTime = Date.now();

    for (let i = 0; i < count; i++) {
        // We slightly offset the timestamp for each item in the batch
        // to guarantee they sort correctly even if generated in the same ms
        const timestamp = baseTime + i;

        const uuidBytes = new Uint8Array(16);
        crypto.getRandomValues(uuidBytes);

        uuidBytes[0] = (timestamp / 0x10000000000) & 0xff;
        uuidBytes[1] = (timestamp / 0x100000000) & 0xff;
        uuidBytes[2] = (timestamp / 0x1000000) & 0xff;
        uuidBytes[3] = (timestamp / 0x10000) & 0xff;
        uuidBytes[4] = (timestamp / 0x100) & 0xff;
        uuidBytes[5] = timestamp & 0xff;

        uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x70;
        uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80;

        const hex = Array.from(uuidBytes)
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');

        uuids.push([
            hex.slice(0, 8),
            hex.slice(8, 12),
            hex.slice(12, 16),
            hex.slice(16, 20),
            hex.slice(20, 32),
        ].join('-'));
    }

    return uuids;
}
