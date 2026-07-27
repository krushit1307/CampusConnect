import {
  getVerificationEmailHtml,
  getVerificationEmailText,
  type VerificationEmailParams,
} from "./templates";

export interface SendVerificationEmailOptions extends VerificationEmailParams {
  to: string;
}

export interface EmailServiceResult {
  success: boolean;
  provider: "resend" | "sendgrid" | "mock";
  messageId?: string;
  error?: string;
}

/**
 * Resolves configured email provider from environment variables.
 */
function getEmailProvider(): "resend" | "sendgrid" | "mock" {
  const provider = (
    import.meta.env.VITE_EMAIL_PROVIDER ||
    (typeof process !== "undefined" ? process.env.VITE_EMAIL_PROVIDER : undefined) ||
    "mock"
  ).toLowerCase();

  if (provider === "resend") return "resend";
  if (provider === "sendgrid") return "sendgrid";
  return "mock";
}

/**
 * Resolves email API key from env fallback options.
 */
function getApiKey(): string | undefined {
  return (
    import.meta.env.VITE_EMAIL_API_KEY ||
    import.meta.env.RESEND_API_KEY ||
    import.meta.env.SENDGRID_API_KEY ||
    (typeof process !== "undefined"
      ? process.env.VITE_EMAIL_API_KEY || process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY
      : undefined)
  );
}

/**
 * Resolves default sender address.
 */
function getFromAddress(): string {
  return (
    import.meta.env.VITE_EMAIL_FROM_ADDRESS ||
    (typeof process !== "undefined" ? process.env.VITE_EMAIL_FROM_ADDRESS : undefined) ||
    "CampusConnect <noreply@campusconnect.edu>"
  );
}

/**
 * Sends an email verification link using Resend, SendGrid, or fallback Mock Logger.
 */
export async function sendVerificationEmail({
  to,
  recipientName,
  verificationUrl,
}: SendVerificationEmailOptions): Promise<EmailServiceResult> {
  const provider = getEmailProvider();
  const apiKey = getApiKey();
  const from = getFromAddress();
  const subject = "Verify your CampusConnect email address";
  const html = getVerificationEmailHtml({ recipientName, verificationUrl });
  const text = getVerificationEmailText({ recipientName, verificationUrl });

  // If no API key is set or provider is explicitly 'mock', log link & return mock success
  if (provider === "mock" || !apiKey) {
    console.log("--------------------------------------------------");
    console.log("✉️  [CampusConnect Email Service] Mock Email Sent!");
    console.log(`Provider: ${provider} (Fallback mode)`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Verification URL: ${verificationUrl}`);
    console.log("--------------------------------------------------");

    return {
      success: true,
      provider: "mock",
      messageId: `mock_${Date.now()}`,
    };
  }

  // Resend API integration
  if (provider === "resend") {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
          text,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || `Resend API returned status ${response.status}`,
        );
      }

      return {
        success: true,
        provider: "resend",
        messageId: data.id,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send email via Resend.";
      console.error("[CampusConnect Email Service] Resend error:", errorMessage);
      return {
        success: false,
        provider: "resend",
        error: errorMessage,
      };
    }
  }

  // SendGrid API integration
  if (provider === "sendgrid") {
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: to, name: recipientName }],
            },
          ],
          from: { email: from },
          subject,
          content: [
            { type: "text/plain", value: text },
            { type: "text/html", value: html },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `SendGrid API returned status ${response.status}`);
      }

      return {
        success: true,
        provider: "sendgrid",
        messageId: response.headers.get("x-message-id") || `sg_${Date.now()}`,
      };
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to send email via SendGrid.";
      console.error("[CampusConnect Email Service] SendGrid error:", errorMessage);
      return {
        success: false,
        provider: "sendgrid",
        error: errorMessage,
      };
    }
  }

  return {
    success: false,
    provider: "mock",
    error: "Unsupported email provider.",
  };
}
