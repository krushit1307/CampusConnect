/**
 * AES-GCM WebCrypto Utility for End-to-End Encryption (E2EE)
 */

// Generate a random AES-GCM key. In a real app, this would be generated once
// by a club admin and securely distributed to members out-of-band.
export const generateSymmetricKey = async (): Promise<CryptoKey> => {
  return await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true, // extractable (so we can save/share it)
    ['encrypt', 'decrypt']
  );
};

// Helper: Convert CryptoKey to base64 for local storage mocking
export const exportKey = async (key: CryptoKey): Promise<string> => {
  const exported = await window.crypto.subtle.exportKey('raw', key);
  const exportedArray = Array.from(new Uint8Array(exported));
  return btoa(String.fromCharCode.apply(null, exportedArray));
};

// Helper: Convert base64 back to CryptoKey
export const importKey = async (base64Key: string): Promise<CryptoKey> => {
  const binaryString = atob(base64Key);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return await window.crypto.subtle.importKey(
    'raw',
    bytes.buffer,
    'AES-GCM',
    true,
    ['encrypt', 'decrypt']
  );
};

// Buffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Base64 to Buffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export const encryptMessage = async (
  plainText: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plainText);
  
  // The Initialization Vector must be unique for every encryption
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return {
    ciphertext: arrayBufferToBase64(encryptedBuffer),
    iv: arrayBufferToBase64(iv.buffer)
  };
};

export const decryptMessage = async (
  ciphertextB64: string,
  ivB64: string,
  key: CryptoKey
): Promise<string> => {
  const ciphertextBuffer = base64ToArrayBuffer(ciphertextB64);
  const ivBuffer = base64ToArrayBuffer(ivB64);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
    key,
    ciphertextBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
};
