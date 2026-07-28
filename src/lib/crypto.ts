/**
 * Cryptography helper module using WebCrypto API
 * for End-to-End Encryption (E2EE) using ECDH and AES-GCM.
 */

/**
 * Generates an ECDH keypair on P-256 curve
 */
export async function generateECDHKeypair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true, // extractable
    ["deriveKey", "deriveBits"],
  );
}

/**
 * Exports a public key as a JWK JSON string
 */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey("jwk", key);
  return JSON.stringify(jwk);
}

/**
 * Exports a private key as a JWK JSON string
 */
export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey("jwk", key);
  return JSON.stringify(jwk);
}

/**
 * Imports a public key from JWK JSON string
 */
export async function importPublicKey(jwkStr: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkStr);
  return await crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    [],
  );
}

/**
 * Imports a private key from JWK JSON string
 */
export async function importPrivateKey(jwkStr: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkStr);
  return await crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey"],
  );
}

/**
 * Derives an AES-GCM 256-bit key from own private key and recipient's public key
 */
export async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<CryptoKey> {
  return await crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: publicKey,
    },
    privateKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypts cleartext message with derived shared key, returning base64 ciphertext and IV
 */
export async function encryptMessage(
  plainText: string,
  sharedKey: CryptoKey,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    sharedKey,
    encoder.encode(plainText),
  );

  // Convert buffer to base64
  const ciphertextArray = Array.from(new Uint8Array(ciphertextBuffer));
  const ciphertextBase64 = btoa(String.fromCharCode(...ciphertextArray));
  const ivArray = Array.from(iv);
  const ivBase64 = btoa(String.fromCharCode(...ivArray));

  return {
    ciphertext: ciphertextBase64,
    iv: ivBase64,
  };
}

/**
 * Decrypts base64 ciphertext and IV with derived shared key
 */
export async function decryptMessage(
  ciphertextBase64: string,
  ivBase64: string,
  sharedKey: CryptoKey,
): Promise<string> {
  const ciphertext = new Uint8Array(btoaToBytes(ciphertextBase64));
  const iv = new Uint8Array(btoaToBytes(ivBase64));

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    sharedKey,
    ciphertext,
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Converts a base64 string to a Uint8Array
 */
function btoaToBytes(b64: string): Uint8Array {
  const binaryString = atob(b64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
