/**
 * WaitlistManager
 *
 * Admin component for managing event waitlists.
 * Allows promoting users, viewing queue, and configuring settings.
 */

import { useState, useCallback } from "react";
import { useEventWaitlist } from "@/hooks/useEventWaitlist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatWaitlistPosition, formatWaitDuration, calculateWaitlistStats } from "@/lib/waitlist-utils";
import type { WaitlistConfig, WaitlistEntry } from "@/types/waitlist";
import {
  Loader2,
  UserCheck,
  UserMinus,
  Settings,
  Users,
  BarChart3,
  Clock,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

interface WaitlistManagerProps {
  /** Event ID */
  eventId: string;
  /** Current user ID */
  userId: string;
  /** Max attendees for the event */
  maxAttendees?: number | null;
  /** Current RSVP count */
  currentRsvpCount: number;
}

type ManagerTab = "queue" | "settings" | "stats";

export function WaitlistManager({
  eventId,
  userId,
  maxAttendees,
  currentRsvpCount,
}: WaitlistManagerProps) {
  const [activeTab, setActiveTab] = useState<ManagerTab>("queue");

  const {
    entries,
    config,
    isLoading,
    error,
    joinWaitlist,
    leaveWaitlist,
    refresh,
    promoteNext,
  } = useEventWaitlist({
    eventId,
    userId,
    maxAttendees,
    currentRsvpCount,
  });

  const stats = calculateWaitlistStats(entries);
  const waitingEntries = entries
    .filter((e) => e.status === "waiting")
    .sort((a, b) => a.position - b.position);

  const tabs: { id: ManagerTab; label: string; icon: React.ReactNode }[] = [
    { id: "queue", label: "Queue", icon: <Users className="h-4 w-4" /> },
    { id: "stats", label: "Stats", icon: <BarChart3 className="h-4 w-4" /> },
    { id: "settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="neu-border bg-white">
      {/* Header */}
      <div className="p-4 border-b border-black/10">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-black">
            Waitlist Management
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isLoading}
            className="neu-border font-mono text-xs"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <TrendingUp className="h-3 w-3 mr-1" />
            )}
            Refresh
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="mt-3 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors",
                activeTab === tab.id
                  ? "bg-black text-cream"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <p className="font-mono text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Queue Tab */}
      {activeTab === "queue" && (
        <div className="p-4">
          {waitingEntries.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-gray-300" />
              <p className="mt-2 font-mono text-sm text-gray-500">
                No one is on the waitlist
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="font-mono text-xs text-gray-600">
                  {waitingEntries.length} user{waitingEntries.length !== 1 ? "s" : ""} waiting
                </p>
                <Button
                  onClick={promoteNext}
                  disabled={isLoading || waitingEntries.length === 0}
                  className="bg-lime text-black font-mono text-xs font-bold uppercase neu-border"
                  size="sm"
                >
                  {isLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <UserCheck className="h-3 w-3 mr-1" />
                  )}
                  Promote Next
                </Button>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {waitingEntries.map((entry, index) => (
                  <WaitlistQueueRow
                    key={entry.id}
                    entry={entry}
                    position={index + 1}
                    isCurrentUser={entry.user_id === userId}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === "stats" && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Waiting"
              value={stats.total_waiting}
              icon={<Users className="h-4 w-4" />}
              color="bg-orange-100 text-orange-700"
            />
            <StatCard
              label="Promoted"
              value={stats.total_promoted}
              icon={<UserCheck className="h-4 w-4" />}
              color="bg-green-100 text-green-700"
            />
            <StatCard
              label="Avg Wait"
              value={stats.average_wait_minutes > 0 ? `${stats.average_wait_minutes}m` : "N/A"}
              icon={<Clock className="h-4 w-4" />}
              color="bg-blue-100 text-blue-700"
            />
            <StatCard
              label="Max Wait"
              value={stats.max_wait_minutes > 0 ? `${stats.max_wait_minutes}m` : "N/A"}
              icon={<AlertTriangle className="h-4 w-4" />}
              color="bg-purple-100 text-purple-700"
            />
          </div>

          {entries.length > 0 && (
            <div>
              <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-black mb-2">
                Activity Log
              </h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {entries
                  .filter((e) => e.status !== "waiting")
                  .slice(0, 10)
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <span className="font-mono text-[10px] text-gray-600">
                        User {entry.user_id.slice(0, 8)}...
                      </span>
                      <span
                        className={cn(
                          "font-mono text-[10px] font-bold uppercase px-2 py-0.5",
                          entry.status === "promoted" && "bg-green-100 text-green-700",
                          entry.status === "cancelled" && "bg-gray-100 text-gray-700",
                          entry.status === "expired" && "bg-red-100 text-red-700"
                        )}
                      >
                        {entry.status}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="p-4 space-y-4">
          <WaitlistSettings config={config} eventId={eventId} />
        </div>
      )}
    </div>
  );
}

/** Individual row in the waitlist queue */
function WaitlistQueueRow({
  entry,
  position,
  isCurrentUser,
}: {
  entry: WaitlistEntry;
  position: number;
  isCurrentUser: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded border",
        isCurrentUser ? "bg-lime/20 border-lime" : "bg-white border-gray-200"
      )}
    >
      <div className="flex items-center gap-3">
        <span className="neu-border bg-peach px-2 py-1 font-mono text-xs font-bold">
          #{position}
        </span>
        <div>
          <p className="font-mono text-xs font-bold">
            User {entry.user_id.slice(0, 8)}...
            {isCurrentUser && (
              <span className="ml-1 text-lime-700">(You)</span>
            )}
          </p>
          <p className="font-mono text-[10px] text-gray-500">
            Waiting {formatWaitDuration(entry.joined_at)}
          </p>
          {entry.message && (
            <p className="font-mono text-[10px] text-gray-400 mt-1 italic">
              &quot;{entry.message}&quot;
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Statistics card */
function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="neu-border p-3 bg-white">
      <div className="flex items-center gap-2">
        <div className={cn("p-1.5 rounded", color)}>{icon}</div>
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-gray-500">
          {label}
        </span>
      </div>
      <p className="mt-2 font-mono text-xl font-black text-black">{value}</p>
    </div>
  );
}

/** Settings panel */
function WaitlistSettings({
  config,
  eventId,
}: {
  config: WaitlistConfig;
  eventId: string;
}) {
  const [maxSize, setMaxSize] = useState(config.max_waitlist_size);
  const [promoWindow, setPromoWindow] = useState(config.promotion_window_minutes);
  const [autoPromote, setAutoPromote] = useState(config.auto_promote);
  const [enabled, setEnabled] = useState(config.enabled);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-black">
            Enable Waitlist
          </p>
          <p className="font-mono text-[10px] text-gray-500">
            Allow users to join waitlist when event is full
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div className="space-y-2">
        <label className="font-mono text-xs font-bold uppercase tracking-wider text-black">
          Max Waitlist Size
        </label>
        <Input
          type="number"
          value={maxSize}
          onChange={(e) => setMaxSize(Number(e.target.value))}
          min={1}
          max={200}
          className="neu-border font-mono"
        />
      </div>

      <div className="space-y-2">
        <label className="font-mono text-xs font-bold uppercase tracking-wider text-black">
          Promotion Window (minutes)
        </label>
        <Input
          type="number"
          value={promoWindow}
          onChange={(e) => setPromoWindow(Number(e.target.value))}
          min={15}
          max={1440}
          className="neu-border font-mono"
        />
        <p className="font-mono text-[10px] text-gray-500">
          How long promoted users have to confirm ({promoWindow} min ={" "}
          {promoWindow >= 60
            ? `${Math.floor(promoWindow / 60)}h ${promoWindow % 60}m`
            : `${promoWindow}m`}
          )
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-black">
            Auto-Promote
          </p>
          <p className="font-mono text-[10px] text-gray-500">
            Automatically promote next person on cancel
          </p>
        </div>
        <Switch checked={autoPromote} onCheckedChange={setAutoPromote} />
      </div>

      <Button
        className="w-full bg-black text-cream font-mono text-xs font-bold uppercase neu-border"
        onClick={() => {
          // Would save to Supabase in production
        }}
      >
        Save Settings
      </Button>
    </div>
  );
}
