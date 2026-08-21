import { useState, useEffect } from "react";
import { getPendingOfflineMutations, replayOfflineMutations } from "@/lib/offlineMutationQueue";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateStatus = async () => {
      setIsOnline(navigator.onLine);
      const items = await getPendingOfflineMutations();
      setPendingCount(items.length);
    };

    updateStatus();

    const handleOnline = async () => {
      setIsOnline(true);
      await replayOfflineMutations();
      const items = await getPendingOfflineMutations();
      setPendingCount(items.length);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline, pendingCount };
}
