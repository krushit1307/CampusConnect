/**
 * useWebAuthn – React hook for WebAuthn / Passkey operations.
 *
 * Provides state management and API calls for:
 * - Registering a new passkey
 * - Authenticating with a passkey
 * - Listing a user's registered passkeys
 * - Deleting a passkey
 * - Detecting browser support
 */

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  createPasskeyCredential,
  getPasskeyCredential,
  getRpId,
  getOrigin,
  getWebAuthnErrorMessage,
} from "@/lib/webauthn";

export interface PasskeyCredential {
  id: string;
  credential_id: string;
  device_name: string;
  transports: string[];
  created_at: string;
  last_used_at: string | null;
  backed_up: boolean;
}

interface UseWebAuthnReturn {
  /** Whether the browser supports WebAuthn */
  isSupported: boolean;
  /** Whether the device has a platform authenticator (biometrics) */
  hasPlatformAuth: boolean;
  /** Whether a registration or authentication operation is in progress */
  isLoading: boolean;
  /** Current error message, if any */
  error: string | null;
  /** List of user's registered passkeys */
  passkeys: PasskeyCredential[];
  /** Whether passkeys are being fetched */
  isLoadingPasskeys: boolean;
  /** Register a new passkey for the current user */
  registerPasskey: (deviceName?: string) => Promise<boolean>;
  /** Authenticate with a passkey (no existing session needed) */
  authenticateWithPasskey: (email?: string) => Promise<{
    success: boolean;
    email?: string;
    /** Set when authentication succeeded and a session was created in-place. */
    sessionEstablished?: boolean;
    /** Set when token_hash verification failed — the browser will navigate here to complete login. */
    actionLink?: string;
  }>;
  /** Fetch the user's registered passkeys */
  fetchPasskeys: () => Promise<void>;
  /** Delete a passkey by credential table ID */
  deletePasskey: (id: string) => Promise<boolean>;
  /** Rename a passkey */
  renamePasskey: (id: string, newName: string) => Promise<boolean>;
  /** Clear the current error */
  clearError: () => void;
}

export function useWebAuthn(): UseWebAuthnReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [hasPlatformAuth, setHasPlatformAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyCredential[]>([]);
  const [isLoadingPasskeys, setIsLoadingPasskeys] = useState(false);

  const supabase = createClient();

  // Detect browser capabilities on mount
  useEffect(() => {
    const detect = async () => {
      const supported = isWebAuthnSupported();
      setIsSupported(supported);

      if (supported) {
        const platformAvail = await isPlatformAuthenticatorAvailable();
        setHasPlatformAuth(platformAvail);
      }
    };
    detect();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  /**
   * Fetches the current user's registered passkeys from the database.
   */
  const fetchPasskeys = useCallback(async () => {
    setIsLoadingPasskeys(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from("webauthn_credentials")
        .select("id, credential_id, device_name, transports, created_at, last_used_at, backed_up")
        .order("created_at", { ascending: false });

      if (fetchErr) {
        console.error("Failed to fetch passkeys:", fetchErr);
        return;
      }

      setPasskeys((data as PasskeyCredential[]) || []);
    } catch (err) {
      console.error("Failed to fetch passkeys:", err);
    } finally {
      setIsLoadingPasskeys(false);
    }
  }, [supabase]);

  /**
   * Registers a new passkey for the current authenticated user.
   */
  const registerPasskey = useCallback(
    async (deviceName?: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Get the user's auth session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setError("You must be signed in to register a passkey.");
          return false;
        }

        const rpId = getRpId();
        const origin = getOrigin();

        // 2. Request registration options from Edge Function
        const supabaseUrl =
          import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;

        const optionsRes = await fetch(
          `${supabaseUrl}/functions/v1/webauthn-registration-options`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ rpId, deviceName }),
          },
        );

        if (!optionsRes.ok) {
          const errorData = await optionsRes.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to get registration options");
        }

        const { options } = await optionsRes.json();

        // 3. Create credential using browser API
        const credential = await createPasskeyCredential(options);

        // 4. Send credential to Edge Function for verification
        const verifyRes = await fetch(`${supabaseUrl}/functions/v1/webauthn-registration-verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            ...credential,
            deviceName: deviceName || "Passkey",
            rpId,
            origin,
          }),
        });

        if (!verifyRes.ok) {
          const errorData = await verifyRes.json().catch(() => ({}));
          console.error("verifyRes NOT OK - errorData:", errorData);
          throw new Error(errorData.error || "Failed to verify registration");
        }

        // 5. Refresh the passkeys list
        await fetchPasskeys();

        return true;
      } catch (err) {
        const message = getWebAuthnErrorMessage(err);
        setError(message);
        console.error("Passkey registration error:", err);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [supabase, fetchPasskeys],
  );

  /**
   * Authenticates a user using a passkey (no existing session required).
   *
   * Session creation strategy:
   *   1. Backend verifies the WebAuthn assertion and calls admin.generateLink().
   *   2. Frontend calls verifyOtp({ token_hash, type: "magiclink" }) to exchange
   *      hashed_token for an active Supabase session — this is the correct API.
   *   3. If verifyOtp fails (e.g. token already consumed or expired), falls back
   *      to navigating the browser to action_link, which Supabase handles natively.
   */
  const authenticateWithPasskey = useCallback(
    async (
      email?: string,
    ): Promise<{
      success: boolean;
      email?: string;
      sessionEstablished?: boolean;
      actionLink?: string;
    }> => {
      setIsLoading(true);
      setError(null);

      try {
        const rpId = getRpId();
        const origin = getOrigin();

        const supabaseUrl =
          import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;

        const supabaseAnonKey =
          import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        // 1. Request authentication options from Edge Function
        const optionsRes = await fetch(`${supabaseUrl}/functions/v1/webauthn-auth-options`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseAnonKey,
          },
          body: JSON.stringify({ rpId, email }),
        });

        if (!optionsRes.ok) {
          const errData = await optionsRes.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to get authentication options");
        }

        const { options } = await optionsRes.json();

        // 2. Get credential assertion from the browser / authenticator
        const credential = await getPasskeyCredential(options);

        // 3. Send assertion to Edge Function for cryptographic verification
        const verifyRes = await fetch(`${supabaseUrl}/functions/v1/webauthn-auth-verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseAnonKey,
          },
          body: JSON.stringify({
            ...credential,
            rpId,
            origin,
          }),
        });

        if (!verifyRes.ok) {
          const errData = await verifyRes.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to verify authentication");
        }

        const result = await verifyRes.json();

        if (!result.success) {
          throw new Error(result.error || "Authentication failed");
        }

        // 4. Exchange hashed_token for a Supabase session.
        //
        //    The correct API for a token_hash from admin.generateLink() is:
        //      verifyOtp({ token_hash: <hash>, type: "magiclink" })
        //    WITHOUT an email parameter — the hash is self-identifying.
        //
        //    DO NOT use: verifyOtp({ email, token, type }) — that expects a
        //    6-digit numeric OTP, not a magic-link hash.
        if (result.tokenHash) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: result.tokenHash,
            type: "magiclink",
          });

          if (!verifyError) {
            // Session successfully created via token_hash exchange.
            // Confirm a valid session is actually present before signalling success.
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (session) {
              return { success: true, email: result.email, sessionEstablished: true };
            }
          }

          // verifyOtp failed or session missing — log for diagnostics.
          console.warn(
            "[WebAuthn] verifyOtp token_hash exchange failed:",
            verifyError?.message ?? "no session after verifyOtp",
          );
        }

        // 5. Fallback: navigate to action_link.
        //    Supabase generates a complete magic-link URL. When the browser
        //    navigates there, Supabase Auth handles the session creation
        //    automatically and redirects back to redirectTo (/auth/passkey-callback).
        if (result.actionLink) {
          // Return the link to the caller rather than navigating immediately,
          // so the caller (PasskeyLoginButton) can show a transitional UI.
          return {
            success: true,
            email: result.email,
            sessionEstablished: false,
            actionLink: result.actionLink as string,
          };
        }

        // Neither token_hash nor actionLink worked — treat as failure.
        throw new Error(
          "Authentication verified but session could not be established. Please try again.",
        );
      } catch (err) {
        const message = getWebAuthnErrorMessage(err);
        setError(message);
        console.error("Passkey authentication error:", err);
        return { success: false };
      } finally {
        setIsLoading(false);
      }
    },
    [supabase],
  );

  /**
   * Deletes a passkey by its database ID.
   */
  const deletePasskey = useCallback(
    async (id: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const { error: deleteErr } = await supabase
          .from("webauthn_credentials")
          .delete()
          .eq("id", id);

        if (deleteErr) {
          throw new Error(deleteErr.message);
        }

        setPasskeys((prev) => prev.filter((p) => p.id !== id));
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete passkey";
        setError(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [supabase],
  );

  /**
   * Renames a passkey.
   */
  const renamePasskey = useCallback(
    async (id: string, newName: string): Promise<boolean> => {
      setError(null);

      try {
        const { error: updateErr } = await supabase
          .from("webauthn_credentials")
          .update({ device_name: newName })
          .eq("id", id);

        if (updateErr) {
          throw new Error(updateErr.message);
        }

        setPasskeys((prev) => prev.map((p) => (p.id === id ? { ...p, device_name: newName } : p)));
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to rename passkey";
        setError(message);
        return false;
      }
    },
    [supabase],
  );

  return {
    isSupported,
    hasPlatformAuth,
    isLoading,
    error,
    passkeys,
    isLoadingPasskeys,
    registerPasskey,
    authenticateWithPasskey,
    fetchPasskeys,
    deletePasskey,
    renamePasskey,
    clearError,
  };
}
