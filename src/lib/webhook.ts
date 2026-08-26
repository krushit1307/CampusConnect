export interface WebhookResult {
  success: boolean;
  error?: string;
  status?: number;
}

export function isSSRFBlocked(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Reject localhost
    if (hostname === "localhost") return true;

    // Reject 127.0.0.0/8
    if (hostname.startsWith("127.")) return true;

    // Reject 10.0.0.0/8
    if (hostname.startsWith("10.")) return true;

    // Reject AWS metadata endpoint
    if (hostname === "169.254.169.254") return true;

    // IPv6 localhost mapping
    if (hostname === "[::1]" || hostname === "::1") return true;

    return false;
  } catch {
    // Reject invalid URLs
    return true;
  }
}

export async function dispatchWebhook(url: string, payload: unknown): Promise<WebhookResult> {
  if (isSSRFBlocked(url)) {
    return { success: false, error: "Blocked by SSRF protection" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    return { success: response.ok, status: response.status };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("Webhook Delivery Timeout");
      return { success: false, error: "Webhook Delivery Timeout" };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    clearTimeout(timeout);
  }
}
