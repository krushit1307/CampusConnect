// =============================================================================
// Utility: Vault Cryptography
// Issue: #4051 - Implement 'Automated "Club Transition" Document Vault'
// Description: Client-side AES-GCM encryption utilities to secure the payload 
// before it ever leaves the browser, ensuring zero-knowledge storage.
// =============================================================================

/**
 * Encrypts a JSON payload using AES-GCM with a key derived from a master secret.
 * In production, the master secret should be injected via environment variables 
 * or a secure key management service, never hardcoded.
 */
export async function encryptVaultPayload(payload: any, masterSecret: string): Promise<{ encrypted: string; iv: string }> {
    const jsonString = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonString);

    // Derive a 256-bit key from the master secret
    const keyData = await crypto.subtle.digest("SHA-256", encoder.encode(masterSecret));
    const key = await crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, ["encrypt"]);

    // Generate a random 12-byte IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the data
    const encryptedData = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        data
    );

    // Convert to Base64 for storage
    const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encryptedData)));
    const ivBase64 = btoa(String.fromCharCode(...iv));

    return { encrypted: encryptedBase64, iv: ivBase64 };
}

/**
 * Validates that the input contains sensitive-looking data (basic heuristic).
 */
export function hasSensitiveData(text: string): boolean {
    const patterns = [
        /password/i, /pass/i, /pin/i, /secret/i, /key/i, /token/i, /drive\.google\.com/i
    ];
    return patterns.some(pattern => pattern.test(text));
}
