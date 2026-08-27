// =============================================================================
// Utility: End-to-End Encryption (E2EE) Engine
//Issue: #2905 - Implement 'End-to-End Encryption' for Sensitive Club Direct Messages
//Description: Wraps the native Web Crypto API to handle RSA - OAEP keypair
//generation, AES - GCM symmetric encryption for messages, and key wrapping.
//Ensures zero - knowledge architecture where the server only sees ciphertext.
// =============================================================================

// Constants for crypto algorithms
const RSA_ALGORITHM = {
    name: 'RSA-OAEP',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), // 65537
    hash: 'SHA-256',
};

const AES_ALGORITHM = {
    name: 'AES-GCM',
    length: 256,
};

/**
 * Generates a new RSA-OAEP keypair for the user's current device.
 * The private key MUST be stored securely (e.g., IndexedDB) and never sent to the server.
 */
export async function generateRSAKeypair(): Promise<CryptoKeyPair> {
    return await window.crypto.subtle.generateKey(
        RSA_ALGORITHM,
        true, // Extractable (needed for backup/export)
        ['encrypt', 'decrypt']
    );
}

/**
 * Generates a random symmetric AES-GCM key for a new Secure Channel.
 */
export async function generateAESKey(): Promise<CryptoKey> {
    return await window.crypto.subtle.generateKey(
        AES_ALGORITHM,
        true, // Extractable so we can wrap it for participants
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypts a plaintext string using the symmetric AES key.
 * Prepends the Initialization Vector (IV) to the ciphertext for decryption.
 * 
 * @param plaintext - The message content
 * @param aesKey - The shared symmetric key
 * @returns Base64 encoded string containing IV + Ciphertext
 */
export async function encryptMessage(plaintext: string, aesKey: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // Generate a random 12-byte IV for AES-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        aesKey,
        data
    );

    // Combine IV and Ciphertext into a single ArrayBuffer
    const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.byteLength);

    // Convert to Base64 for safe database storage
    return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a Base64 encoded ciphertext string using the symmetric AES key.
 * Extracts the IV from the first 12 bytes.
 * 
 * @param ciphertextBase64 - The Base64 encoded string (IV + Ciphertext)
 * @param aesKey - The shared symmetric key
 * @returns The decrypted plaintext string
 */
export async function decryptMessage(ciphertextBase64: string, aesKey: CryptoKey): Promise<string> {
    try {
        // Decode Base64 to Uint8Array
        const binaryString = atob(ciphertextBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Extract IV (first 12 bytes) and Ciphertext (rest)
        const iv = bytes.slice(0, 12);
        const ciphertext = bytes.slice(12);

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            aesKey,
            ciphertext
        );

        const decoder = new TextDecoder();
        return decoder.decode(decryptedBuffer);
    } catch (error) {
        console.error('[E2EE] Decryption failed. Key mismatch or corrupted data.', error);
        throw new Error('Failed to decrypt message. You may be missing the required keys for this channel.');
    }
}

/**
 * Wraps (encrypts) the symmetric AES key using a recipient's RSA Public Key.
 * This allows us to store the shared channel key securely in the database 
// for each participant.
 * 
 * @param aesKey - The symmetric key to wrap
 * @param recipientPublicKey - The recipient's RSA Public Key (imported)
 * @returns Base64 encoded wrapped key
 */
export async function wrapAESKey(aesKey: CryptoKey, recipientPublicKey: CryptoKey): Promise<string> {
    // We use AES-KW or RSA-OAEP to wrap the key. Here we use RSA-OAEP directly.
    const wrappedKeyBuffer = await window.crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        recipientPublicKey,
        await window.crypto.subtle.exportKey('raw', aesKey)
    );

    return btoa(String.fromCharCode(...new Uint8Array(wrappedKeyBuffer)));
}

/**
 * Unwraps (decrypts) the symmetric AES key using the user's RSA Private Key.
 * 
 * @param wrappedKeyBase64 - The Base64 encoded wrapped key from the database
 * @param privateKey - The user's RSA Private Key
 * @returns The unwrapped CryptoKey (AES-GCM)
 */
export async function unwrapAESKey(wrappedKeyBase64: string, privateKey: CryptoKey): Promise<CryptoKey> {
    const binaryString = atob(wrappedKeyBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return await window.crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        privateKey,
        bytes.buffer
    ).then(rawKey => {
        return window.crypto.subtle.importKey(
            'raw',
            rawKey,
            AES_ALGORITHM,
            false, // Non-extractable for security once unwrapped
            ['encrypt', 'decrypt']
        );
    });
}

/**
 * Exports a CryptoKey to a Base64 string for secure backup/download.
 */
export async function exportKeyToBase64(key: CryptoKey): Promise<string> {
    const exported = await window.crypto.subtle.exportKey('pkcs8', key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

/**
 * Imports a Base64 string back into a CryptoKey (Private Key).
 */
export async function importPrivateKeyFromBase64(base64: string): Promise<CryptoKey> {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return await window.crypto.subtle.importKey(
        'pkcs8',
        bytes.buffer,
        RSA_ALGORITHM,
        true,
        ['decrypt']
    );
}

/**
 * Imports a Base64 string back into a CryptoKey (Public Key).
 */
export async function importPublicKeyFromBase64(base64: string): Promise<CryptoKey> {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return await window.crypto.subtle.importKey(
        'spki',
        bytes.buffer,
        RSA_ALGORITHM,
        true,
        ['encrypt']
    );
}
