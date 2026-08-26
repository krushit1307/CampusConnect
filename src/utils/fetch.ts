import { getCsrfToken } from "../lib/csrf";
import { createClient } from "../lib/supabase/client";

interface FetchOptions extends RequestInit {
  isStaticMetadata?: boolean;
}

async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);

  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await window.crypto.subtle.sign("HMAC", cryptoKey, messageData);

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function customFetch(url: string, options: FetchOptions = {}) {
  const { isStaticMetadata, ...init } = options;

  const requestUrl = url;

  if (isStaticMetadata) {
    init.cache = "default";
  }

  const headers = new Headers(init.headers);

  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (token) {
      const timestamp = Date.now().toString();
      const nonce =
        Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const method = (init.method || "GET").toUpperCase();

      const urlObj = new URL(requestUrl, window.location.origin);
      const path = urlObj.pathname;

      let bodyText = "";
      if (init.body) {
        if (typeof init.body === "string") {
          bodyText = init.body;
        } else {
          bodyText = JSON.stringify(init.body);
        }
      }

      const message = `${method}:${path}:${timestamp}:${nonce}:${bodyText}`;
      const signature = await hmacSha256(token, message);

      headers.set("X-Request-Signature", signature);
      headers.set("X-Request-Timestamp", timestamp);
      headers.set("X-Request-Nonce", nonce);
    }
  } catch (err) {
    console.error("[customFetch] Failed to generate request signature:", err);
  }

  init.headers = headers;
  init.credentials = "include";

  const response = await fetch(requestUrl, init);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}
