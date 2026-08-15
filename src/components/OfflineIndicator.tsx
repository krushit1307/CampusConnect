import { useState, useEffect } from "react";
import WifiOff from "lucide-react/dist/esm/icons/wifi-off";
import { toast } from "sonner";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Back online! Syncing data...", {
        duration: 4000,
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("You are offline. Viewing cached data.", {
        description: "Your RSVPs and actions will sync when you reconnect.",
        duration: 5000,
      });
    };

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
