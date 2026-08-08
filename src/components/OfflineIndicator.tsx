import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[10000] flex items-center gap-2 rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-lg border border-slate-700 animate-in fade-in slide-in-from-bottom-4">
      <WifiOff className="h-4 w-4" />
      <span>Offline &middot; Viewing cached data</span>
    </div>
  );
}
