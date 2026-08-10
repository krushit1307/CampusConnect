import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sliders, Bell, Mail, Smartphone, Volume2, Moon, ShieldCheck, Check } from "lucide-react";
import { toast } from "sonner";

interface NotificationPreferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationPreferenceModal: React.FC<NotificationPreferenceModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [emailDigest, setEmailDigest] = useState<"instant" | "daily" | "weekly" | "never">("daily");
  const [eventAlerts, setEventAlerts] = useState(true);
  const [clubAnnouncements, setClubAnnouncements] = useState(true);
  const [directMentions, setDirectMentions] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("07:00");

  const [saving, setSaving] = useState(false);

  const handleSavePreferences = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success("Notification preferences saved successfully!");
      onClose();
    }, 800);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg border-2 border-black bg-white p-6 shadow-[6px_6px_0_0_var(--color-ink)]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-lime">
              <Sliders className="h-6 w-6 text-black" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-black font-display">
                Notification Preferences
              </DialogTitle>
              <DialogDescription className="font-mono text-xs text-gray-600">
                Customize how and when you receive campus activity alerts.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          {/* Email Digest Frequency */}
          <div className="p-4 border-2 border-black bg-cream space-y-2">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-black" />
              <h4 className="font-bold text-sm text-black">Email Digest Frequency</h4>
            </div>
            <p className="font-mono text-xs text-gray-600">
              Control the rate of summary emails sent to your registered address.
            </p>
            <Select
              value={emailDigest}
              onValueChange={(val: "instant" | "daily" | "weekly" | "never") => setEmailDigest(val)}
            >
              <SelectTrigger className="border-2 border-black bg-white font-mono text-xs">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent className="border-2 border-black bg-white font-mono text-xs">
                <SelectItem value="instant">Instant Notifications (Realtime)</SelectItem>
                <SelectItem value="daily">Daily Summary Digest (8:00 AM)</SelectItem>
                <SelectItem value="weekly">Weekly Campus Newsletter (Mondays)</SelectItem>
                <SelectItem value="never">Unsubscribe / Off</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category Channel Switches */}
          <div className="space-y-3 p-4 border-2 border-black bg-white">
            <h4 className="font-mono text-xs font-bold uppercase text-black">
              Category Alert Channels
            </h4>

            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="font-bold text-xs text-black">Campus Events & RSVPs</p>
                  <p className="font-mono text-[10px] text-gray-500">
                    Upcoming event reminders and registration updates.
                  </p>
                </div>
              </div>
              <Switch checked={eventAlerts} onCheckedChange={setEventAlerts} />
            </div>

            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="font-bold text-xs text-black">Club Broadcasts</p>
                  <p className="font-mono text-[10px] text-gray-500">
                    Announcements from student organizations you join.
                  </p>
                </div>
              </div>
              <Switch checked={clubAnnouncements} onCheckedChange={setClubAnnouncements} />
            </div>

            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-green-600" />
                <div>
                  <p className="font-bold text-xs text-black">Direct Mentions & Replies</p>
                  <p className="font-mono text-[10px] text-gray-500">
                    When someone tags @you in discussion threads.
                  </p>
                </div>
              </div>
              <Switch checked={directMentions} onCheckedChange={setDirectMentions} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="font-bold text-xs text-black">Security & Device Alerts</p>
                  <p className="font-mono text-[10px] text-gray-500">
                    New login locations or device token revocations.
                  </p>
                </div>
              </div>
              <Switch checked={securityAlerts} onCheckedChange={setSecurityAlerts} />
            </div>
          </div>

          {/* Sound & Quiet Hours */}
          <div className="p-4 border-2 border-black bg-sky/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-black" />
                <span className="font-bold text-xs text-black">Audio & Sound Feedback</span>
              </div>
              <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
            </div>

            <div className="flex items-center justify-between border-t border-black/20 pt-3">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-black" />
                <div>
                  <p className="font-bold text-xs text-black">Quiet Hours (Do Not Disturb)</p>
                  <p className="font-mono text-[10px] text-gray-600">
                    Silence push sounds during nighttime hours.
                  </p>
                </div>
              </div>
              <Switch checked={quietHoursEnabled} onCheckedChange={setQuietHoursEnabled} />
            </div>

            {quietHoursEnabled && (
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="time"
                  value={quietStart}
                  onChange={(e) => setQuietStart(e.target.value)}
                  className="border border-black p-1 font-mono text-xs bg-white"
                />
                <span className="font-mono text-xs">to</span>
                <input
                  type="time"
                  value={quietEnd}
                  onChange={(e) => setQuietEnd(e.target.value)}
                  className="border border-black p-1 font-mono text-xs bg-white"
                />
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1 border-2 border-black font-mono text-xs uppercase"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={handleSavePreferences}
            className="flex-1 border-2 border-black bg-black text-cream hover:bg-black/90 font-mono text-xs uppercase shadow-[3px_3px_0_0_var(--color-ink)]"
          >
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
