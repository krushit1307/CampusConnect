import { describe, it, expect } from "vitest";
import { GenericRadarThreatProvider } from "../radar/radarThreatProvider";

describe("GenericRadarThreatProvider", () => {
  const provider = new GenericRadarThreatProvider();
  const secretKey = "radar_secret_test_key_99";

  it("verifies valid HMAC SHA-256 webhook payloads and timestamp headers", async () => {
    const timestampHeader = Date.now().toString();
    const payloadObj = {
      eventId: "radar_evt_101",
      provider: "evolv_radar",
      venueId: "v_north_gate",
      building: "Science Building",
      checkpointId: "cp_turnstile_1",
      threatSeverity: "WEAPON_DETECTED",
      confidenceScore: 0.99,
    };
    const payloadRaw = JSON.stringify(payloadObj);

    const validSignature = await provider.computeHmacSha256(
      `${timestampHeader}.${payloadRaw}`,
      secretKey,
    );

    const result = await provider.verifyWebhook(
      payloadRaw,
      validSignature,
      timestampHeader,
      secretKey,
    );

    expect(result.isValid).toBe(true);
    expect(result.event).toBeDefined();
    expect(result.event?.eventId).toBe("radar_evt_101");
    expect(result.event?.threatSeverity).toBe("WEAPON_DETECTED");
  });

  it("rejects webhooks with expired timestamps to prevent replay attacks", async () => {
    const expiredTimestampHeader = (Date.now() - 600 * 1000).toString(); // 10 minutes old
    const payloadRaw = JSON.stringify({ eventId: "radar_evt_old" });

    const signature = await provider.computeHmacSha256(
      `${expiredTimestampHeader}.${payloadRaw}`,
      secretKey,
    );

    const result = await provider.verifyWebhook(
      payloadRaw,
      signature,
      expiredTimestampHeader,
      secretKey,
    );

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain("expired");
  });

  it("rejects webhooks with invalid HMAC signatures", async () => {
    const timestampHeader = Date.now().toString();
    const payloadRaw = JSON.stringify({ eventId: "radar_evt_fake" });

    const result = await provider.verifyWebhook(
      payloadRaw,
      "invalid_signature_string",
      timestampHeader,
      secretKey,
    );

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain("mismatch");
  });
});
