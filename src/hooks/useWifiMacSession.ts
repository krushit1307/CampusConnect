import { useEffect, useState, useCallback } from 'react';
import {
  validateMacSession,
  extendSessionExpiry,
  rotateMacAddress,
  MacSession,
} from '@/lib/network/macRandomizationSessionManager';
import { isTokenExpiringSoon } from '@/lib/network/wifiJwtTokenManager';

const MAC_ROTATION_CHECK_INTERVAL = parseInt(
  import.meta.env.VITE_MAC_ROTATION_CHECK_INTERVAL || '30000'
);

export interface UseWifiMacSessionResult {
  sessionId: string | null;
  currentMac: string | null;
  isMacValid: boolean;
  sessionExpiry: string | null;
  remainingTime: number;
  isExpiringSoon: boolean;
  rotationDetected: boolean;
  lastRotationTime: string | null;
  error: string | null;
  refreshSession: () => Promise<void>;
  manualRotation: (newMac: string) => Promise<void>;
}

/**
 * Hook to manage WiFi MAC session with automatic rotation detection
 */
export function useWifiMacSession(): UseWifiMacSessionResult {
  const [session, setSession] = useState<MacSession | null>(null);
  const [currentMac, setCurrentMac] = useState<string | null>(null);
  const [isMacValid, setIsMacValid] = useState(false);
  const [rotationDetected, setRotationDetected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect device MAC address
  const detectMacAddress = useCallback(async (): Promise<string | null> => {
    try {
      // This requires a backend endpoint that returns the device's MAC
      const response = await fetch('/api/network/detect-mac', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.mac || null;
    } catch (err) {
      console.error('Failed to detect MAC:', err);
      return null;
    }
  }, []);

  // Get session from localStorage
  const getStoredSession = useCallback((): {
    sessionId: string;
    jwtToken: string;
    campusId: string;
  } | null => {
    try {
      const stored = localStorage.getItem('wifi_session');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  // Validate current MAC against session
  const validateCurrentSession = useCallback(async () => {
    const stored = getStoredSession();
    if (!stored || !session) {
      setIsMacValid(false);
      return;
    }

    const mac = await detectMacAddress();
    if (!mac) {
      setIsMacValid(false);
      return;
    }

    try {
      const result = await validateMacSession(stored.sessionId, mac, stored.jwtToken);
      setIsMacValid(result.isValid);

      if (result.isValid && mac !== session.currentMacAddress) {
        // MAC has rotated
        setRotationDetected(true);
      }
    } catch (err) {
      console.error('Session validation error:', err);
      setIsMacValid(false);
    }
  }, [session, getStoredSession, detectMacAddress]);

  // Monitor for MAC rotation
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    const checkMacRotation = async () => {
      const mac = await detectMacAddress();

      if (mac && session && mac !== session.currentMacAddress) {
        setRotationDetected(true);

        // Attempt to rotate MAC in session
        try {
          const stored = getStoredSession();
          if (stored) {
            await rotateMacAddress(stored.sessionId, mac);
            setSession((prev) =>
              prev ? { ...prev, currentMacAddress: mac } : null
            );
            setCurrentMac(mac);
            setRotationDetected(false);
          }
        } catch (err) {
          console.error('MAC rotation failed:', err);
          // Keep rotation detected flag to trigger re-authentication
        }
      }
    };

    if (session) {
      intervalId = setInterval(checkMacRotation, MAC_ROTATION_CHECK_INTERVAL);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [session, getStoredSession, detectMacAddress]);

  // Refresh session expiry
  const refreshSession = useCallback(async () => {
    const stored = getStoredSession();
    if (!stored) {
      setError('No active session');
      return;
    }

    try {
      await extendSessionExpiry(stored.sessionId);
      setError(null);
    } catch (err) {
      setError(`Failed to refresh session: ${err}`);
    }
  }, [getStoredSession]);

  // Handle manual MAC rotation
  const manualRotation = useCallback(
    async (newMac: string) => {
      const stored = getStoredSession();
      if (!stored) {
        setError('No active session');
        return;
      }

      try {
        const updatedSession = await rotateMacAddress(stored.sessionId, newMac);
        setSession(updatedSession);
        setCurrentMac(newMac);
        setError(null);
      } catch (err) {
        setError(`MAC rotation failed: ${err}`);
      }
    },
    [getStoredSession]
  );

  // Initialize session on mount
  useEffect(() => {
    const stored = getStoredSession();
    if (stored) {
      // Restore session from storage
      detectMacAddress().then((mac) => {
        if (mac) {
          setCurrentMac(mac);
          validateCurrentSession();
        }
      });
    }
  }, []);

  // Calculate remaining time
  const remainingTime = session
    ? Math.max(
        0,
        (new Date(session.jwtExpiresAt).getTime() - new Date().getTime()) / 1000
      )
    : 0;

  const isExpiringSoon = session
    ? isTokenExpiringSoon(session.jwtExpiresAt, 5)
    : false;

  return {
    sessionId: session?.sessionId || null,
    currentMac,
    isMacValid,
    sessionExpiry: session?.jwtExpiresAt || null,
    remainingTime: Math.floor(remainingTime),
    isExpiringSoon,
    rotationDetected,
    lastRotationTime: session?.lastRotationAt || null,
    error,
    refreshSession,
    manualRotation,
  };
}

export default useWifiMacSession;