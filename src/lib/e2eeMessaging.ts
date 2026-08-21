import {
  generateECDHKeypair,
  exportPublicKey,
  exportPrivateKey,
  importPublicKey,
  importPrivateKey,
  deriveSharedSecret,
  encryptMessage,
  decryptMessage,
} from "./crypto";

export interface UserKeyPairResult {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicJwk: string;
  privateJwk: string;
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
}

/**
 * Generates a fresh ECDH P-256 key pair and exports JSON Web Keys (JWK).
 */
export async function generateUserKeyPair(): Promise<UserKeyPairResult> {
  const keypair = await generateECDHKeypair();
  const publicJwk = await exportPublicKey(keypair.publicKey);
  const privateJwk = await exportPrivateKey(keypair.privateKey);

  return {
    publicKey: keypair.publicKey,
    privateKey: keypair.privateKey,
    publicJwk,
    privateJwk,
  };
}

/**
 * Retrieves existing E2EE keys from client localStorage or generates a new key pair.
 */
export async function getOrGenerateUserKeyPair(userId: string): Promise<UserKeyPairResult> {
  const privKeyName = `cc_e2ee_private_key_${userId}`;
  const pubKeyName = `cc_e2ee_public_key_${userId}`;

  if (typeof window !== "undefined" && window.localStorage) {
    const privJwk = localStorage.getItem(privKeyName);
    const pubJwk = localStorage.getItem(pubKeyName);

    if (privJwk && pubJwk) {
      try {
        const publicKey = await importPublicKey(pubJwk);
        const privateKey = await importPrivateKey(privJwk);
        return {
          publicKey,
          privateKey,
          publicJwk: pubJwk,
          privateJwk: privJwk,
        };
      } catch (err) {
        console.warn("Failed to import existing keys, generating fresh key pair:", err);
      }
    }
  }

  const fresh = await generateUserKeyPair();
  if (typeof window !== "undefined" && window.localStorage) {
    localStorage.setItem(privKeyName, fresh.privateJwk);
    localStorage.setItem(pubKeyName, fresh.publicJwk);
  }

  return fresh;
}

/**
 * Encrypts a message payload for a recipient using ECDH key agreement and AES-GCM 256-bit encryption.
 */
export async function encryptMessageForRecipient(
  plainText: string,
  senderPrivateKey: CryptoKey,
  recipientPublicJwk: string,
): Promise<EncryptedPayload> {
  const recipientPublicKey = await importPublicKey(recipientPublicJwk);
  const sharedKey = await deriveSharedSecret(senderPrivateKey, recipientPublicKey);
  return await encryptMessage(plainText, sharedKey);
}

/**
 * Decrypts an encrypted message payload received from a sender using derived shared secret.
 */
export async function decryptMessageFromSender(
  ciphertextBase64: string,
  ivBase64: string,
  recipientPrivateKey: CryptoKey,
  senderPublicJwk: string,
): Promise<string> {
  const senderPublicKey = await importPublicKey(senderPublicJwk);
  const sharedKey = await deriveSharedSecret(recipientPrivateKey, senderPublicKey);
  return await decryptMessage(ciphertextBase64, ivBase64, sharedKey);
}

/**
 * Helper to check if a string is valid Base64 format.
 */
export function isBase64(str: string): boolean {
  if (!str || typeof str !== "string") return false;
  try {
    return btoa(atob(str)) === str;
  } catch {
    return false;
  }
}
