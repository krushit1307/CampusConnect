import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import { createClient } from "@/lib/supabase/client";

export interface UserPasskey {
  id: string;
  user_id: string;
  credential_id: string;
  name: string;
  device_type: string;
  backed_up: boolean;
  transports: string[];
  created_at: string;
  last_used_at: string | null;
}

export function isWebAuthnSupported(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.PublicKeyCredential !== "undefined" &&
      browserSupportsWebAuthn()
    );
  } catch {
    return false;
  }
}

export async function registerPasskey(
  name?: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isWebAuthnSupported()) {
    return {
      success: false,
      error: "WebAuthn / Passkeys are not supported on this browser or device.",
    };
  }

  const supabase = createClient();

  const { data: options, error: optionsErr } = await supabase.functions.invoke(
    "webauthn-register",
    {
      body: { action: "generate-options" },
    },
  );

  if (optionsErr || !options) {
    return {
      success: false,
      error: optionsErr?.message || options?.error || "Failed to generate registration options.",
    };
  }

  if (options.error) {
    return { success: false, error: options.error };
  }

  try {
    const registrationResponse = await startRegistration({ optionsJSON: options });

    const { data: verifyResult, error: verifyErr } = await supabase.functions.invoke(
      "webauthn-register",
      {
        body: {
          action: "verify",
          registrationResponse,
          name: name || "Passkey",
        },
      },
    );

    if (verifyErr || !verifyResult?.verified) {
      return {
        success: false,
        error: verifyErr?.message || verifyResult?.error || "Passkey verification failed.",
      };
    }

    return { success: true };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Passkey registration failed or was cancelled.";
    return { success: false, error: message };
  }
}

export async function authenticateWithPasskey(
  email?: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isWebAuthnSupported()) {
    return {
      success: false,
      error: "WebAuthn / Passkeys are not supported on this browser or device.",
    };
  }

  const supabase = createClient();

  const { data: options, error: optionsErr } = await supabase.functions.invoke(
    "webauthn-authenticate",
    {
      body: { action: "generate-options", email },
    },
  );

  if (optionsErr || !options) {
    return {
      success: false,
      error: optionsErr?.message || options?.error || "Failed to generate authentication options.",
    };
  }

  if (options.error) {
    return { success: false, error: options.error };
  }

  try {
    const authenticationResponse = await startAuthentication({ optionsJSON: options });

    const { data: verifyResult, error: verifyErr } = await supabase.functions.invoke(
      "webauthn-authenticate",
      {
        body: {
          action: "verify",
          authenticationResponse,
          email,
        },
      },
    );

    if (verifyErr || !verifyResult?.verified) {
      return {
        success: false,
        error: verifyErr?.message || verifyResult?.error || "Passkey authentication failed.",
      };
    }

    if (verifyResult.token_hash) {
      const { error: otpErr } = await supabase.auth.verifyOtp({
        token_hash: verifyResult.token_hash,
        type: "magiclink",
      });

      if (otpErr) {
        if (verifyResult.email_otp && verifyResult.email) {
          const { error: fallbackErr } = await supabase.auth.verifyOtp({
            email: verifyResult.email,
            token: verifyResult.email_otp,
            type: "email",
          });
          if (fallbackErr) throw fallbackErr;
        } else {
          throw otpErr;
        }
      }
    } else if (verifyResult.email_otp && verifyResult.email) {
      const { error: otpErr } = await supabase.auth.verifyOtp({
        email: verifyResult.email,
        token: verifyResult.email_otp,
        type: "email",
      });
      if (otpErr) throw otpErr;
    }

    return { success: true };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Passkey authentication cancelled or failed.";
    return { success: false, error: message };
  }
}

export async function getUserPasskeys(): Promise<UserPasskey[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_passkeys")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching passkeys:", error);
    return [];
  }

  return (data as UserPasskey[]) || [];
}

export async function deletePasskey(passkeyId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("user_passkeys").delete().eq("id", passkeyId);
  return !error;
}
