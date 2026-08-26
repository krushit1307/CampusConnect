import { describe, it, expect } from "vitest";
import {
  generateUserKeyPair,
  encryptMessageForRecipient,
  decryptMessageFromSender,
  isBase64,
} from "./e2eeMessaging";

describe("E2EE Direct Messaging Module (#2632)", () => {
  it("generates valid key pair and JWK string representations", async () => {
    const keys = await generateUserKeyPair();

    expect(keys.publicKey).toBeDefined();
    expect(keys.privateKey).toBeDefined();
    expect(keys.publicJwk).toContain('"kty":"EC"');
    expect(keys.privateJwk).toContain('"kty":"EC"');
  });

  it("performs end-to-end encryption & decryption between Alice and Bob", async () => {
    const aliceKeys = await generateUserKeyPair();
    const bobKeys = await generateUserKeyPair();

    const originalMessage =
      "Hey Bob, let's meet at the CS Library at 4 PM for the study session! 🚀";

    // Alice encrypts for Bob
    const { ciphertext, iv } = await encryptMessageForRecipient(
      originalMessage,
      aliceKeys.privateKey,
      bobKeys.publicJwk,
    );

    // Verify ciphertext is base64 encoded and NOT plaintext
    expect(ciphertext).not.toBe(originalMessage);
    expect(isBase64(ciphertext)).toBe(true);
    expect(isBase64(iv)).toBe(true);

    // Bob decrypts from Alice
    const decrypted = await decryptMessageFromSender(
      ciphertext,
      iv,
      bobKeys.privateKey,
      aliceKeys.publicJwk,
    );

    expect(decrypted).toBe(originalMessage);
  });

  it("prevents untrusted third party (Eve) from decrypting message payloads", async () => {
    const aliceKeys = await generateUserKeyPair();
    const bobKeys = await generateUserKeyPair();
    const eveKeys = await generateUserKeyPair();

    const secretMessage = "Private exam review notes";

    const { ciphertext, iv } = await encryptMessageForRecipient(
      secretMessage,
      aliceKeys.privateKey,
      bobKeys.publicJwk,
    );

    // Eve attempts to decrypt with her private key pretending to be Bob
    await expect(
      decryptMessageFromSender(ciphertext, iv, eveKeys.privateKey, aliceKeys.publicJwk),
    ).rejects.toThrow();
  });
});
