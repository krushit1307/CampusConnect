/**
 * WaitlistPanel
 *
 * A comprehensive panel showing waitlist status, position, and actions
 * for a specific event. Used in event detail pages.
 */

import { useState } from "react";
import { WaitlistJoinButton } from "./WaitlistJoinButton";
import { WaitlistPosition } from "./WaitlistPosition";
import { WaitlistNotificationPreferences } from "./WaitlistNotificationPreferences";
import { useEventWaitlist } from "@/hooks/useEventWaitlist";
import { cn } from "@/lib/utils";
import { formatWaitlistPosition } from "@/lib/waitlist-utils";
import { ChevronDown, ChevronUp, Clock, Users, Bell, BellOff } from "lucide-react";

interface WaitlistPanelProps {
  /** Event ID */
  eventId: string;
  /** Current user ID */
  userId?: string;
  /** Max attendees for the event */
  maxAttendees?: number | null;
  /** Current RSVP count */
  currentRsvpCount: number;
  /** Whether the user is an admin */
  isAdmin?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function WaitlistPanel({
  eventId,
  userId,
  maxAttendees,
  currentRsvpCount,
  isAdmin = false,
  className,
}: WaitlistPanelProps) {
  const [showDetails, setShowDetails] = useState(false);

  const {
    isAtCapacity,
    isWaitlistFull,
    isOnWaitlist,
    userEntry,
    userPosition,
    entries,
    config,
    isLoading,
    error,
    joinWaitlist,
    leaveWaitlist,
    updateNotifications,
  } = useEventWaitlist({
    eventId,
    userId,
    maxAttendees,
    currentRsvpCount,
  });

  // Don't render if event is not at capacity and user is not on waitlist
  if (!isAtCapacity && !isOnWaitlist) return null;

  return (
    <div className={cn("neu-border bg-white", className)}>
      {/* Header */}
      <div className="p-4 border-b border-black/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="neu-border bg-orange-100 p-2">
              <Users className="h-5 w-5 text-orange-700" />
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-black">
                Event Waitlist
              </h3>
              <p className="font-mono text-[10px] text-gray-500">
                {entries.length} of {config.max_waitlist_size} spots filled
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="neu-border p-2 hover:bg-gray-50 transition-colors"
            aria-label={showDetails ? "Hide details" : "Show details"}
          >
            {showDetails ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <p className="font-mono text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Position Display (when user is on waitlist) */}
      {isOnWaitlist && userEntry && userPosition && (
        <div className="p-4 border-b border-black/10">
          <WaitlistPosition
            position={userPosition}
            totalWaiting={entries.length}
            entries={entries}
            joinedAt={userEntry.joined_at}
            variant="full"
          />
        </div>
      )}

      {/* Action Button */}
      <div className="p-4">
        <WaitlistJoinButton
          isAtCapacity={isAtCapacity}
          isOnWaitlist={isOnWaitlist}
          isWaitlistFull={isWaitlistFull}
          userPosition={userPosition}
          isLoading={isLoading}
          waitlistCount={entries.length}
          onJoin={joinWaitlist}
          onLeave={leaveWaitlist}
        />
      </div>

      {/* Expandable Details */}
      {showDetails && (
        <div className="p-4 border-t border-black/10 space-y-4">
          {/* Notification Preferences */}
          {isOnWaitlist && userEntry && (
            <WaitlistNotificationPreferences
              notifyOnPromotion={userEntry.notify_on_promotion}
              notifyOnPositionChange={userEntry.notify_on_position_change}
              onUpdate={updateNotifications}
              isLoading={isLoading}
            />
          )}

          {/* Waitlist Queue (admin only) */}
          {isAdmin && entries.length > 0 && (
            <div>
              <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-black mb-3">
                Waitlist Queue ({entries.length})
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {entries.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex items-center justify-between p-2 rounded",
                      entry.user_id === userId && "bg-lime/30",
                      entry.status === "promoted" && "bg-green-100"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-gray-500 w-6">
                        #{entry.position}
                      </span>
                      <div>
                        <p className="font-mono text-xs font-bold">
                          User {entry.user_id.slice(0, 8)}...
                        </p>
                        <p className="font-mono text-[10px] text-gray-500">
                          Joined {new Date(entry.joined_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {entry.status === "promoted" && (
                        <span className="font-mono text-[10px] font-bold uppercase text-green-700 bg-green-100 px-2 py-0.5">
                          Promoted
                        </span>
                      )}
                      {entry.notify_on_promotion ? (
                        <Bell className="h-3 w-3 text-gray-400" />
                      ) : (
                        <BellOff className="h-3 w-3 text-gray-300" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-50 p-3 rounded">
            <p className="font-mono text-[10px] text-blue-700">
              <strong>How it works:</strong> When a spot opens up, the next person
              on the waitlist receives a notification and has 60 minutes to confirm
              their RSVP. If they don&apos;t confirm, the next person is promoted.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
