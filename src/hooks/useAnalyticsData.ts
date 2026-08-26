import { useState, useEffect, useRef, useCallback } from "react";
import type { RawEventData, AggregatedStats } from "@/workers/analytics.worker";

/**
 * useAnalyticsData Hook
 * Manages the lifecycle of the Web Worker, sending raw data and
 * receiving aggregated statistics without blocking the main React thread.
 */
export const useAnalyticsData = (rawData: RawEventData[] | null) => {
  const [stats, setStats] = useState<AggregatedStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use ref to store the worker instance to prevent recreation on re-renders
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize worker using modern Vite-compatible syntax
    // This tells the bundler to output a separate file, preventing 404s in production
    workerRef.current = new Worker(new URL("../workers/analytics.worker.ts", import.meta.url), {
      type: "module",
    });

    // Listen for responses from the worker
    workerRef.current.onmessage = (event: MessageEvent) => {
      const { type, payload } = event.data;

      if (type === "SUCCESS") {
        setStats(payload);
        setIsLoading(false);
        setError(null);
      } else if (type === "ERROR") {
        setError(payload);
        setIsLoading(false);
        setStats(null);
      }
    };

    workerRef.current.onerror = (err: ErrorEvent) => {
      console.error("Web Worker error:", err);
      setError("Failed to initialize analytics worker");
      setIsLoading(false);
    };

    // Cleanup: terminate worker on component unmount
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // Send data to worker whenever rawData changes
  useEffect(() => {
    if (rawData && workerRef.current) {
      setIsLoading(true);
      setError(null);
      // postMessage transfers the data to the worker thread
      workerRef.current.postMessage(rawData);
    } else {
      setStats(null);
      setIsLoading(false);
    }
  }, [rawData]);

  const retry = useCallback(() => {
    if (rawData && workerRef.current) {
      setIsLoading(true);
      setError(null);
      workerRef.current.postMessage(rawData);
    }
  }, [rawData]);

  return { stats, isLoading, error, retry };
};
