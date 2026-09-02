import { describe, it, expect } from "vitest";
import {
  generateOneTimeUnlockHash,
  executeCatererQrDeposit,
  executeOrganizerBleUnlock,
} from "./smartRefrigeratorLock";

describe("Interactive Dietary Restriction Smart Refrigerator Lock Utility (#4986)", () => {
  it("generates 64-character cryptographic SHA-256 one-time unlock hash with 4-hour expiry window", () => {
    const { hash, expiresAt } = generateOneTimeUnlockHash("evt-halal-1", "fridge-union-1");

    expect(hash).toContain("sha256_");
    expect(hash.length).toBeGreaterThan(60);
    expect(expiresAt).toBeDefined();

    const expDate = new Date(expiresAt);
    const now = new Date();
    const diffHours = Math.round((expDate.getTime() - now.getTime()) / (1000 * 3600));
    expect(diffHours).toBe(4);
  });

  it("executes Caterer QR deposit scan and drops lock for food staging", () => {
    const result = executeCatererQrDeposit("fridge-union-1", "u-caterer-101");

    expect(result.unlockedByRole).toBe("caterer");
    expect(result.newLockState).toBe("caterer_unlocked");
    expect(result.blePayload).toContain("BLE_ESP32_RELAY_UNLOCK");
  });

  it("executes Organizer Bluetooth BLE unlock with valid cryptographic hash", () => {
    const { hash } = generateOneTimeUnlockHash("evt-halal-1", "fridge-union-1");
    const result = executeOrganizerBleUnlock("fridge-union-1", hash);

    expect(result.unlockedByRole).toBe("organizer");
    expect(result.newLockState).toBe("organizer_unlocked");
    expect(result.blePayload).toContain("ORGANIZER_EVENT_START");
  });
});
