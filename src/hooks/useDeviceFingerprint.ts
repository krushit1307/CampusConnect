import { useEffect, useState, useCallback } from "react";
import { fingerprintService } from "@/lib/fingerprint";

/**
 * useDeviceFingerprint Hook
 * Manages the lifecycle of device fingerprint generation.
 * Caches the visitorId in memory to avoid redundant hashing on every request.
 */
export const useDeviceFingerprint = () => {
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initializeFingerprint = async () => {
      try {
        setIsLoading(true);
        await fingerprintService.init();
        const id = await fingerprintService.getVisitorId();
        if (isMounted) {
          setVisitorId(id);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Failed to generate device fingerprint:", err);
          setError(err instanceof Error ? err : new Error("Unknown fingerprint error"));
          // Fallback to a generic ID to prevent breaking the app
          setVisitorId("fallback-anonymous-id");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeFingerprint();

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshFingerprint = useCallback(async () => {
    setIsLoading(true);
    fingerprintService.reset();
    try {
      await fingerprintService.init();
      const id = await fingerprintService.getVisitorId();
      setVisitorId(id);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Refresh failed"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { visitorId, isLoading, error, refreshFingerprint };
};
