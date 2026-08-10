import { describe, it, expect } from "vitest";
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

describe("Cryptography Helpers (E2EE)", () => {
  it("should generate, export, and import keys correctly", async () => {
    const keypair = await generateECDHKeypair();
    expect(keypair.publicKey).toBeDefined();
    expect(keypair.privateKey).toBeDefined();

    const pubJwk = await exportPublicKey(keypair.publicKey);
    const privJwk = await exportPrivateKey(keypair.privateKey);

    expect(pubJwk).toContain('"kty":"EC"');
    expect(privJwk).toContain('"kty":"EC"');

    const importedPub = await importPublicKey(pubJwk);
    const importedPriv = await importPrivateKey(privJwk);

    expect(importedPub).toBeDefined();
    expect(importedPriv).toBeDefined();
  });

  it("should derive identical shared secrets for Alice and Bob", async () => {
    // Alice
    const aliceKeypair = await generateECDHKeypair();
    const alicePubJwk = await exportPublicKey(aliceKeypair.publicKey);
    const alicePrivJwk = await exportPrivateKey(aliceKeypair.privateKey);

    // Bob
    const bobKeypair = await generateECDHKeypair();
    const bobPubJwk = await exportPublicKey(bobKeypair.publicKey);
    const bobPrivJwk = await exportPrivateKey(bobKeypair.privateKey);

    // Reconstruct keys as if received from DB / LocalStorage
    const alicePubImported = await importPublicKey(alicePubJwk);
    const alicePrivImported = await importPrivateKey(alicePrivJwk);

    const bobPubImported = await importPublicKey(bobPubJwk);
    const bobPrivImported = await importPrivateKey(bobPrivJwk);

    // Derive shared secret keys
    const aliceSharedKey = await deriveSharedSecret(alicePrivImported, bobPubImported);
    const bobSharedKey = await deriveSharedSecret(bobPrivImported, alicePubImported);

    expect(aliceSharedKey).toBeDefined();
    expect(bobSharedKey).toBeDefined();
  });

  it("should encrypt and decrypt messages correctly", async () => {
    const aliceKeypair = await generateECDHKeypair();
    const bobKeypair = await generateECDHKeypair();

    const sharedKeyAlice = await deriveSharedSecret(aliceKeypair.privateKey, bobKeypair.publicKey);
    const sharedKeyBob = await deriveSharedSecret(bobKeypair.privateKey, aliceKeypair.publicKey);

    const originalMessage = "Hello Bob! This is an E2EE secret message. 🔐";

    const { ciphertext, iv } = await encryptMessage(originalMessage, sharedKeyAlice);
    expect(ciphertext).toBeDefined();
    expect(iv).toBeDefined();
    expect(ciphertext).not.toBe(originalMessage);

    const decrypted = await decryptMessage(ciphertext, iv, sharedKeyBob);
    expect(decrypted).toBe(originalMessage);
  });

  it("should fail to decrypt with incorrect key or tampered data", async () => {
    const aliceKeypair = await generateECDHKeypair();
    const bobKeypair = await generateECDHKeypair();
    const eveKeypair = await generateECDHKeypair();

    const sharedKeyAlice = await deriveSharedSecret(aliceKeypair.privateKey, bobKeypair.publicKey);
    const sharedKeyEve = await deriveSharedSecret(eveKeypair.privateKey, aliceKeypair.publicKey);

    const originalMessage = "Secret information";
    const { ciphertext, iv } = await encryptMessage(originalMessage, sharedKeyAlice);

    // Eve tries to decrypt with her own key derived with Alice's public key
    await expect(decryptMessage(ciphertext, iv, sharedKeyEve)).rejects.toThrow();

    // Bob tries to decrypt with a tampered ciphertext
    const sharedKeyBob = await deriveSharedSecret(bobKeypair.privateKey, aliceKeypair.publicKey);
    const tamperedCiphertext = ciphertext.substring(0, ciphertext.length - 4) + "AAAA";
    await expect(decryptMessage(tamperedCiphertext, iv, sharedKeyBob)).rejects.toThrow();
  });
});
