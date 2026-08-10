import { WebhookPayload } from "./types.ts";

export function buildPayload(eventName: string, clubId: string, record: any): WebhookPayload {
  // Add mapping logic based on event type if necessary
  return {
    event: eventName,
    timestamp: new Date().toISOString(),
    club: {
      id: clubId,
    },
    data: record,
  };
}
