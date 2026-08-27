import { useState, useEffect } from "react";
import {
  checkSubscriptionStatus,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from "@/services/pushNotifications";
import { Switch } from "@/components/ui/switch";
import Bell from "lucide-react/dist/esm/icons/bell";
import BellOff from "lucide-react/dist/esm/icons/bell-off";
import { toast } from "sonner";

interface PushNotificationSettingsProps {
  userId: string;
}

export function PushNotificationSettings({ userId }: PushNotificationSettingsProps) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setIsSupported(false);
        setIsLoading(false);
        return;
      }

      const status = await checkSubscriptionStatus();
      setIsSubscribed(status);
      setIsLoading(false);
    }
    checkStatus();
  }, []);

  const handleToggle = async (checked: boolean) => {
    if (!userId) {
      toast.error("You must be logged in to manage notifications");
      return;
    }

    setIsLoading(true);

    try {
      if (checked) {
        const success = await subscribeToPushNotifications(userId);
        if (success) {
          setIsSubscribed(true);
          toast.success("Successfully subscribed to notifications");
        } else {
          toast.error(
            "Failed to subscribe. Please ensure notifications are allowed in your browser settings.",
          );
        }
      } else {
        const success = await unsubscribeFromPushNotifications();
        if (success) {
          setIsSubscribed(false);
          toast.success("Successfully unsubscribed from notifications");
        } else {
          toast.error("Failed to unsubscribe");
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="rounded-lg border-2 border-black p-4 text-sm font-mono">
        Push notifications are not supported in your current browser.
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        {isSubscribed ? (
          <Bell className="h-5 w-5 text-black" />
        ) : (
          <BellOff className="h-5 w-5 text-gray-500" />
        )}
        <div className="space-y-0.5">
          <label className="font-bold text-black">Campus Announcements (Push)</label>
          <p className="text-sm font-mono text-gray-500">
            Receive important updates and emergency alerts immediately.
          </p>
        </div>
      </div>
      <Switch checked={isSubscribed} onCheckedChange={handleToggle} disabled={isLoading} />
    </div>
  );
}
