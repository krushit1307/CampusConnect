/**
 * WaitlistJoinButton
 *
 * A button that allows users to join or leave an event waitlist.
 * Shows appropriate state based on capacity and waitlist status.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Users, UserMinus, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_WAITLIST_MESSAGE_LENGTH } from "@/types/waitlist";

interface WaitlistJoinButtonProps {
  /** Whether the event is at capacity */
  isAtCapacity: boolean;
  /** Whether the user is on the waitlist */
  isOnWaitlist: boolean;
  /** Whether the waitlist is full */
  isWaitlistFull: boolean;
  /** User's position on the waitlist */
  userPosition: number | null;
  /** Whether an operation is in progress */
  isLoading: boolean;
  /** Number of people currently waiting */
  waitlistCount: number;
  /** Callback when user wants to join */
  onJoin: (message?: string) => Promise<boolean>;
  /** Callback when user wants to leave */
  onLeave: () => Promise<boolean>;
}

export function WaitlistJoinButton({
  isAtCapacity,
  isOnWaitlist,
  isWaitlistFull,
  userPosition,
  isLoading,
  waitlistCount,
  onJoin,
  onLeave,
}: WaitlistJoinButtonProps) {
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [message, setMessage] = useState("");

  const handleJoin = async () => {
    const success = await onJoin(message);
    if (success) {
      setShowJoinDialog(false);
      setMessage("");
    }
  };

  const handleLeave = async () => {
    const success = await onLeave();
    if (success) {
      setShowLeaveDialog(false);
    }
  };

  // If event is not at capacity, don't show waitlist button
  if (!isAtCapacity) return null;

  // If user is on waitlist, show their position and leave option
  if (isOnWaitlist) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowLeaveDialog(true)}
          disabled={isLoading}
          className="neu-border px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 bg-lime text-black disabled:cursor-not-allowed disabled:opacity-60 flex items-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Clock className="h-4 w-4" />
          )}
          <span>Waitlist #{userPosition || "?"}</span>
        </button>

        <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Leave the Waitlist?</DialogTitle>
              <DialogDescription>
                You are currently #{userPosition} on the waitlist for this event.
                Are you sure you want to leave? You may lose your position.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowLeaveDialog(false)}
                disabled={isLoading}
              >
                Keep My Spot
              </Button>
              <Button
                variant="destructive"
                onClick={handleLeave}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <UserMinus className="h-4 w-4 mr-2" />
                )}
                Leave Waitlist
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // If waitlist is full, show disabled button
  if (isWaitlistFull) {
    return (
      <button
        type="button"
        disabled
        className="neu-border px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider bg-gray-200 text-gray-500 cursor-not-allowed opacity-60 flex items-center gap-2"
      >
        <AlertCircle className="h-4 w-4" />
        <span>Waitlist Full</span>
      </button>
    );
  }

  // Default: show join waitlist button
  return (
    <>
      <button
        type="button"
        onClick={() => setShowJoinDialog(true)}
        disabled={isLoading}
        className="neu-border px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 bg-black text-cream disabled:cursor-not-allowed disabled:opacity-60 flex items-center gap-2"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Users className="h-4 w-4" />
        )}
        <span>Join Waitlist ({waitlistCount} waiting)</span>
      </button>

      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join the Waitlist</DialogTitle>
            <DialogDescription>
              This event is currently at capacity. Join the waitlist to be
              notified when a spot opens up. You will have 60 minutes to
              confirm your RSVP when promoted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label
                htmlFor="waitlist-message"
                className="block font-mono text-xs font-bold uppercase tracking-wider text-black mb-2"
              >
                Message to Organizer (Optional)
              </label>
              <Textarea
                id="waitlist-message"
                placeholder="Let the organizer know why you'd like to attend..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={MAX_WAITLIST_MESSAGE_LENGTH}
                className="neu-border bg-white"
              />
              <p className="mt-1 font-mono text-[10px] text-gray-500">
                {message.length}/{MAX_WAITLIST_MESSAGE_LENGTH}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowJoinDialog(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleJoin}
              disabled={isLoading}
              className="bg-black text-cream"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Users className="h-4 w-4 mr-2" />
              )}
              Join Waitlist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
