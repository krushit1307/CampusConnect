/**
 * PushNotificationPrompt Component
 *
 * A clean, non-intrusive UI prompt that asks the user to enable Web Push Notifications
 * for direct messages. It respects user choice and persists the dismissal state.
 */

import * as React from "react";
import { Bell, X, Check } from "lucide-react";
import { isPushSupported, subscribeToPushNotifications } from "../../lib/push-notifications";

export const PushNotificationPrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  React.useEffect(() => {
    // Check if the user has already dismissed the prompt or enabled notifications
    const hasSeenPrompt = localStorage.getItem("cc_push_prompt_seen");
    const isSubscribed = localStorage.getItem("cc_push_subscribed");

    if (!hasSeenPrompt && !isSubscribed && isPushSupported()) {
      // Show prompt after a short delay to not interrupt initial load
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleEnable = async () => {
    setIsLoading(true);
    const result = await subscribeToPushNotifications();

    if (result.success) {
      setStatus("success");
      localStorage.setItem("cc_push_subscribed", "true");
      setTimeout(() => setShowPrompt(false), 2000);
    } else {
      setStatus("error");
      console.error(result.error);
    }
    setIsLoading(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("cc_push_prompt_seen", "true");
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
            <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Never miss a message
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Enable push notifications to get alerts for new direct messages, even when the app is
              closed.
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          aria-label="Dismiss notification prompt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-end space-x-2">
        <button
          onClick={handleDismiss}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          disabled={isLoading}
        >
          Not now
        </button>
        <button
          onClick={handleEnable}
          disabled={isLoading || status === "success"}
          className={`
            flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-white rounded-md transition-colors
            ${
              status === "success"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            }
            ${isLoading ? "opacity-70 cursor-not-allowed" : ""}
          `}
        >
          {isLoading ? (
            <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          ) : status === "success" ? (
            <>
              <Check className="h-3 w-3" />
              <span>Enabled</span>
            </>
          ) : (
            <span>Enable Notifications</span>
          )}
        </button>
      </div>

      {status === "error" && (
        <p className="mt-2 text-xs text-red-500 dark:text-red-400">
          Failed to enable. Please check your browser settings.
        </p>
      )}
    </div>
  );
};
