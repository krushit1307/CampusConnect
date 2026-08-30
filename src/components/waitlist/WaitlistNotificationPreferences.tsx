/**
 * WaitlistNotificationPreferences
 *
 * Allows users to configure their notification preferences
 * for waitlist position changes and promotions.
 */

import { useState, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Bell, BellOff, Loader2, UserCheck, ArrowUpDown } from "lucide-react";

interface WaitlistNotificationPreferencesProps {
  /** Whether user wants promotion notifications */
  notifyOnPromotion: boolean;
  /** Whether user wants position change notifications */
  notifyOnPositionChange: boolean;
  /** Callback to update preferences */
  onUpdate: (promotions: boolean, positionChanges: boolean) => Promise<boolean>;
  /** Whether update is in progress */
  isLoading: boolean;
}

export function WaitlistNotificationPreferences({
  notifyOnPromotion,
  notifyOnPositionChange,
  onUpdate,
  isLoading,
}: WaitlistNotificationPreferencesProps) {
  const [promotions, setPromotions] = useState(notifyOnPromotion);
  const [positionChanges, setPositionChanges] = useState(notifyOnPositionChange);
  const [isSaving, setIsSaving] = useState(false);

  const handleTogglePromotions = useCallback(
    async (checked: boolean) => {
      setPromotions(checked);
      setIsSaving(true);
      await onUpdate(checked, positionChanges);
      setIsSaving(false);
    },
    [positionChanges, onUpdate]
  );

  const handleTogglePositionChanges = useCallback(
    async (checked: boolean) => {
      setPositionChanges(checked);
      setIsSaving(true);
      await onUpdate(promotions, checked);
      setIsSaving(false);
    },
    [promotions, onUpdate]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Bell className="h-4 w-4 text-black" />
        <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-black">
          Notification Preferences
        </h4>
        {isSaving && (
          <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
        )}
      </div>

      <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
        <div className="flex items-center gap-3">
          <div className="neu-border bg-green-100 p-1.5">
            <UserCheck className="h-3 w-3 text-green-700" />
          </div>
          <div>
            <p className="font-mono text-xs font-bold text-black">
              Promotion Alert
            </p>
            <p className="font-mono text-[10px] text-gray-500">
              Get notified when a spot opens up for you
            </p>
          </div>
        </div>
        <Switch
          checked={promotions}
          onCheckedChange={handleTogglePromotions}
          disabled={isLoading || isSaving}
        />
      </div>

      <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
        <div className="flex items-center gap-3">
          <div className="neu-border bg-blue-100 p-1.5">
            <ArrowUpDown className="h-3 w-3 text-blue-700" />
          </div>
          <div>
            <p className="font-mono text-xs font-bold text-black">
              Position Updates
            </p>
            <p className="font-mono text-[10px] text-gray-500">
              Get notified when your position changes
            </p>
          </div>
        </div>
        <Switch
          checked={positionChanges}
          onCheckedChange={handleTogglePositionChanges}
          disabled={isLoading || isSaving}
        />
      </div>

      {(!promotions && !positionChanges) && (
        <div className="p-3 bg-yellow-50 rounded flex items-start gap-2">
          <BellOff className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
          <p className="font-mono text-[10px] text-yellow-700">
            All notifications are disabled. You will not receive updates about
            your waitlist status. Consider enabling at least promotion alerts.
          </p>
        </div>
      )}
    </div>
  );
}
