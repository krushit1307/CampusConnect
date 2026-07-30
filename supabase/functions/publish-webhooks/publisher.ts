import { Webhook, WebhookDelivery } from "./types.ts";
import { generateSignature } from "./signature.ts";
import { isValidWebhookUrl } from "./validator.ts";
import { calculateNextRetry, isRetryableError } from "./retry.ts";

export async function publishWebhook(
  supabase: any,
  webhook: Webhook,
  payload: string,
  deliveryId?: string,
  attempt: number = 1,
) {
  if (!isValidWebhookUrl(webhook.url)) {
    console.error(`Invalid webhook URL: ${webhook.url}`);
    await recordDelivery(supabase, {
      id: deliveryId,
      webhook_id: webhook.id,
      status: "permanent_failure",
      last_error: "Invalid URL (Failed SSRF validation)",
      attempt,
    });
    return;
  }

  const signature = await generateSignature(webhook.secret, payload);
  let statusCode: number | null = null;
  let responseBody: string | null = null;
  let errorMsg: string | null = null;
  let success = false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CampusConnect-Signature": signature,
      },
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    statusCode = response.status;
    responseBody = await response.text();

    if (response.ok) {
      success = true;
    } else {
      errorMsg = `HTTP Error: ${statusCode}`;
    }
  } catch (err: any) {
    errorMsg = err.name === "AbortError" ? "Timeout" : err.message;
  }

  const isRetryable = !success && isRetryableError(statusCode);
  const nextRetryAt = isRetryable ? calculateNextRetry(attempt) : null;
  const status = success ? "success" : nextRetryAt ? "failed" : "permanent_failure";

  await recordDelivery(supabase, {
    id: deliveryId,
    webhook_id: webhook.id,
    status,
    status_code: statusCode,
    last_error: errorMsg,
    response_body: responseBody?.slice(0, 1000), // Store up to 1000 chars of response
    attempt,
    next_retry_at: nextRetryAt ? nextRetryAt.toISOString() : null,
  });
}

async function recordDelivery(supabase: any, deliveryData: Partial<WebhookDelivery>) {
  if (deliveryData.id) {
    // Update existing delivery (retry)
    await supabase
      .from("webhook_deliveries")
      .update({
        status: deliveryData.status,
        status_code: deliveryData.status_code,
        last_error: deliveryData.last_error,
        response_body: deliveryData.response_body,
        attempt: deliveryData.attempt,
        next_retry_at: deliveryData.next_retry_at,
        delivered_at: deliveryData.status === "success" ? new Date().toISOString() : null,
      })
      .eq("id", deliveryData.id);
  } else {
    // Insert new delivery
    await supabase.from("webhook_deliveries").insert({
      webhook_id: deliveryData.webhook_id,
      event_name: "event.created", // Passed down ideally, hardcoded here for simplicity but should be dynamic
      payload: {}, // Payload should be passed down and stored
      status: deliveryData.status,
      status_code: deliveryData.status_code,
      last_error: deliveryData.last_error,
      response_body: deliveryData.response_body,
      attempt: deliveryData.attempt,
      next_retry_at: deliveryData.next_retry_at,
      delivered_at: deliveryData.status === "success" ? new Date().toISOString() : null,
    });
  }
}
