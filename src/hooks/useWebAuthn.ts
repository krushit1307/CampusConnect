import { useState, useEffect, useCallback } from "react";
import {
  isWebAuthnSupported,
  registerPasskey as apiRegisterPasskey,
  authenticateWithPasskey as apiAuthenticateWithPasskey,
  deletePasskey as apiDeletePasskey,
  getUserPasskeys,
  type UserPasskey,
} from "@/lib/webauthn";

export interface PasskeyCredential extends UserPasskey {
  device_name: string;
}

interface UseWebAuthnReturn {
  isSupported: boolean;
  hasPlatformAuth: boolean;
  isLoading: boolean;
  error: string | null;
  passkeys: PasskeyCredential[];
  isLoadingPasskeys: boolean;
  registerPasskey: (deviceName?: string) => Promise<boolean>;
  authenticateWithPasskey: (email?: string) => Promise<{
    success: boolean;
    email?: string;
    sessionEstablished?: boolean;
    actionLink?: string;
  }>;
  fetchPasskeys: () => Promise<void>;
  deletePasskey: (credentialId: string) => Promise<boolean>;
}

export function useWebAuthn(): UseWebAuthnReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [hasPlatformAuth, setHasPlatformAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyCredential[]>([]);
  const [isLoadingPasskeys, setIsLoadingPasskeys] = useState(false);

  useEffect(() => {
    setIsSupported(isWebAuthnSupported());
    // Platform auth check is simplified for now
    setHasPlatformAuth(isWebAuthnSupported());
  }, []);

  const fetchPasskeys = useCallback(async () => {
    setIsLoadingPasskeys(true);
    try {
      const keys = await getUserPasskeys();
      setPasskeys(
        keys.map((k) => ({
          ...k,
          device_name: k.name,
        })),
      );
    } catch (err) {
      console.error("Failed to fetch passkeys", err);
    } finally {
      setIsLoadingPasskeys(false);
    }
  }, []);

  const registerPasskey = useCallback(
    async (deviceName?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await apiRegisterPasskey(deviceName);
        if (result.success) {
          await fetchPasskeys();
          return true;
        } else {
          setError(result.error || "Failed to register passkey");
          return false;
        }
      } catch (err: any) {
        setError(err.message || "An error occurred");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchPasskeys],
  );

  const authenticateWithPasskey = useCallback(async (email?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiAuthenticateWithPasskey(email);
      if (result.success) {
        return { success: true, email, sessionEstablished: true };
      } else {
        setError(result.error || "Failed to authenticate");
        return { success: false, email };
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
      return { success: false, email };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deletePasskey = useCallback(
    async (credentialId: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await apiDeletePasskey(credentialId);
        if (result.success) {
          await fetchPasskeys();
          return true;
        } else {
          setError(result.error || "Failed to delete passkey");
          return false;
        }
      } catch (err: any) {
        setError(err.message || "An error occurred");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchPasskeys],
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
  };
}
