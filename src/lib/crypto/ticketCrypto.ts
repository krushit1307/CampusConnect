/**
 * Cryptographic utilities for Decentralized Peer-to-Peer Event Ticketing Protocol (#3441)
 * Utilizes Web Crypto API (ECDSA, P-256) for secure, browser-based key management and signing.
 */

// Key for storing the private key securely in IndexedDB
const IDB_DB_NAME = "campusconnect_crypto";
const IDB_STORE_NAME = "key_store";
const PRIVATE_KEY_ID = "ticket_private_key";

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_DB_NAME, 1);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storePrivateKey(privateKey: CryptoKey): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readwrite");
    const store = tx.objectStore(IDB_STORE_NAME);
    const request = store.put(privateKey, PRIVATE_KEY_ID);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getPrivateKey(): Promise<CryptoKey | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readonly");
    const store = tx.objectStore(IDB_STORE_NAME);
    const request = store.get(PRIVATE_KEY_ID);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    false, // extractable = false for better security
    ["sign", "verify"]
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("spki", publicKey);
  return arrayBufferToBase64(exported);
}

/**
 * Ensures the user has a local key pair.
 * If not, generates one and returns the exported public key.
 */
export async function ensureKeyPair(): Promise<{ publicKeyBase64: string | null; isNew: boolean }> {
  const existingKey = await getPrivateKey();
  if (existingKey) {
    return { publicKeyBase64: null, isNew: false };
  }

  const keyPair = await generateKeyPair();
  await storePrivateKey(keyPair.privateKey);
  const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);
  return { publicKeyBase64, isNew: true };
}

/**
 * Signs a challenge payload using the stored private key.
 * Used for dynamic QR code entry and ticket transfers.
 */
export async function signChallenge(challengePayload: string): Promise<string> {
  const privateKey = await getPrivateKey();
  if (!privateKey) {
    throw new Error("Private key not found. Cannot sign challenge.");
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(challengePayload);

  const signature = await window.crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: "SHA-256",
    },
    privateKey,
    data
  );

  return arrayBufferToBase64(signature);
}
