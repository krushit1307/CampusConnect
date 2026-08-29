/**
 * Radar Threat Webhook Service (Issue #5139).
 *
 * Handler for incoming weapon detection radar webhooks:
 * 1. Verifies HMAC SHA-256 signature headers.
 * 2. Deduplicates event IDs to prevent duplicate webhook processing.
 * 3. Validates threat severity.
 */

import { genericRadarThreatProvider, GenericRadarThreatProvider } from "./radarThreatProvider";
import { RadarThreatEvent, WebhookVerificationResult } from "@/types/radarSafety";

export class RadarThreatWebhookService {
  private processedEventIds: Set<string> = new Set();
  private provider: GenericRadarThreatProvider;

  constructor(provider: GenericRadarThreatProvider = genericRadarThreatProvider) {
    this.provider = provider;
  }

  /**
   * Process an incoming webhook request payload.
   */
  public async handleWebhook(
    payloadRaw: string,
    signatureHeader: string,
    timestampHeader: string,
    secretKey: string,
  ): Promise<WebhookVerificationResult> {
    const result = await this.provider.verifyWebhook(
      payloadRaw,
      signatureHeader,
      timestampHeader,
      secretKey,
    );

    if (!result.isValid || !result.event) {
      return result;
    }

    const event: RadarThreatEvent = result.event;

    // Deduplication check
    if (this.processedEventIds.has(event.eventId)) {
      return {
        isValid: false,
        reason: `Duplicate event ID ${event.eventId} rejected`,
        event,
      };
    }

    this.processedEventIds.add(event.eventId);
    return { isValid: true, event };
  }

  /**
   * Clears event ID cache (useful for testing).
   */
  public clearEventCache() {
    this.processedEventIds.clear();
  }
}

export const radarThreatWebhookService = new RadarThreatWebhookService();
