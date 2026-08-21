import { createClient } from "@/lib/supabase/client";

export interface RegisterDeviceSessionOptions {
  accessToken?: string;
  userAgent?: string;
}

/**
 * Registers (or refreshes) the current browser as an active device
 * session in `public.device_sessions`, keyed by the Supabase
 * `auth.sessions` id embedded in the access-token JWT. This is what
 * makes remote logout possible: each sign-in creates a row that can
 * later be revoked from the Security Hub.
 *
 * Fire-and-forget: failures never surface to the caller.
 */
export async function registerDeviceSession(
  options: RegisterDeviceSessionOptions = {},
): Promise<boolean> {
  const supabase = createClient();

  try {
    let accessToken = options.accessToken;
    if (!accessToken) {
      const { data } = await supabase.auth.getSession();
      accessToken = data.session?.access_token;
    }

    if (!accessToken) {
      return false;
    }

    const userAgent =
      options.userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : undefined);

    const { error } = await supabase.functions.invoke("register-device-session", {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { user_agent: userAgent },
    });

    return !error;
  } catch {
    return false;
  }
}
