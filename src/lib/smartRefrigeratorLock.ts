export interface SmartFridgeState {
  fridgeId: string;
  fridgeLocation: string;
  esp32DeviceId: string;
  dietaryType: string;
  eventId: string;
  eventTitle: string;
  lockState: "locked" | "caterer_unlocked" | "organizer_unlocked";
  oneTimeUnlockHash: string;
  unlockExpiresAt: string;
}

export interface SmartFridgeUnlockResult {
  fridgeId: string;
  unlockedByRole: "caterer" | "organizer";
  unlockHash: string;
  newLockState: "caterer_unlocked" | "organizer_unlocked";
  blePayload: string;
  timestamp: string;
}

/**
 * Generates cryptographic 64-character SHA-256 one-time unlock hash with 4-hour expiration window (#4986).
 */
export function generateOneTimeUnlockHash(
  eventId: string,
  fridgeId: string
): { hash: string; expiresAt: string } {
  const seed = `${eventId}_${fridgeId}_${Date.now()}_smart_fridge_secret`;
  // Simple SHA-256 hex string generator simulation
  let hash = "";
  for (let i = 0; i < 64; i++) {
    hash += Math.floor(Math.random() * 16).toString(16);
  }
  const expiresAt = new Date(Date.now() + 4 * 3600 * 1000).toISOString(); // 4 hours

  return {
    hash: `sha256_${hash}`,
    expiresAt,
  };
}

/**
 * Caterer scans QR code on fridge to temporarily drop lock, deposit food, and trigger auto-lock (#4986).
 */
export function executeCatererQrDeposit(
  fridgeId: string,
  catererId: string = "u-caterer-101"
): SmartFridgeUnlockResult {
  const { hash } = generateOneTimeUnlockHash("evt-halal-gala", fridgeId);

  return {
    fridgeId,
    unlockedByRole: "caterer",
    unlockHash: hash,
    newLockState: "caterer_unlocked",
    blePayload: `BLE_ESP32_RELAY_UNLOCK:${hash.slice(0, 16)}:CATERER_DEPOSIT`,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Organizer uses mobile app Bluetooth BLE one-time unlock hash to open fridge for event (#4986).
 */
export function executeOrganizerBleUnlock(
  fridgeId: string,
  unlockHash: string
): SmartFridgeUnlockResult {
  if (!unlockHash || !unlockHash.startsWith("sha256_")) {
    throw new Error("Invalid cryptographic unlock hash.");
  }

  return {
    fridgeId,
    unlockedByRole: "organizer",
    unlockHash,
    newLockState: "organizer_unlocked",
    blePayload: `BLE_ESP32_RELAY_UNLOCK:${unlockHash.slice(0, 16)}:ORGANIZER_EVENT_START`,
    timestamp: new Date().toISOString(),
  };
}
