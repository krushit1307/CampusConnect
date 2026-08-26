import React from "react";
import { InformalDiningMeetup, CampusMenuCrowdService } from "@/services/campusMenuCrowdService";
import { Users, Clock, MapPin, Sparkles, CheckCircle2, UserPlus, UserMinus } from "lucide-react";

interface InformalMeetupCardProps {
  meetup: InformalDiningMeetup;
  currentUserId: string;
  currentUserName: string;
  onMeetupUpdated: (updated: InformalDiningMeetup) => void;
}

export const InformalMeetupCard: React.FC<InformalMeetupCardProps> = ({
  meetup,
  currentUserId,
  currentUserName,
  onMeetupUpdated,
}) => {
  const isHost = meetup.hostUserId === currentUserId;
  const userRsvp = meetup.attendees.find((a) => a.userId === currentUserId);
  const isConfirmed = userRsvp?.rsvpStatus === "CONFIRMED";
  const isWaitlisted = userRsvp?.rsvpStatus === "WAITLIST";
  const isFull = meetup.currentParticipants >= meetup.maxParticipants;

  const handleJoin = async () => {
    try {
      const updated = await CampusMenuCrowdService.rsvpToMeetup(
        meetup.id,
        currentUserId,
        currentUserName,
      );
      onMeetupUpdated(updated);
    } catch (err) {
      console.error("Error joining meetup:", err);
    }
  };

  const handleLeave = async () => {
    try {
      const updated = await CampusMenuCrowdService.leaveMeetup(meetup.id, currentUserId);
      onMeetupUpdated(updated);
    } catch (err) {
      console.error("Error leaving meetup:", err);
    }
  };

  const formattedTime = new Date(meetup.meetupTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300">
              🍽️ {meetup.menuItemName}
            </span>
            {isHost && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                You're Host
              </span>
            )}
          </div>
          <h4 className="font-bold text-slate-900 dark:text-white mt-1.5 text-base">
            {meetup.title}
          </h4>
        </div>

        <div className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          <Users className="w-3.5 h-3.5 text-orange-500" />
          <span>
            {meetup.currentParticipants}/{meetup.maxParticipants}
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
        {meetup.description}
      </p>

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 mb-4 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-orange-500" />
          <span>{formattedTime}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-orange-500" />
          <span className="truncate">{meetup.tableLocation}</span>
        </div>
      </div>

      {/* Attendees preview */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center -space-x-2 overflow-hidden">
          {meetup.attendees.slice(0, 5).map((att) => (
            <div
              key={att.userId}
              title={att.userName}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-orange-400 to-amber-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900"
            >
              {att.userName.charAt(0).toUpperCase()}
            </div>
          ))}
          {meetup.attendees.length > 5 && (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 ring-2 ring-white dark:ring-slate-900">
              +{meetup.attendees.length - 5}
            </span>
          )}
        </div>

        <div>
          {isConfirmed ? (
            <button
              onClick={handleLeave}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 transition-colors"
            >
              <UserMinus className="w-3.5 h-3.5" /> Leave
            </button>
          ) : isWaitlisted ? (
            <button
              onClick={handleLeave}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
            >
              Waitlisted (Leave)
            </button>
          ) : (
            <button
              onClick={handleJoin}
              className={`flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white shadow-sm transition-all ${
                isFull ? "bg-slate-600 hover:bg-slate-700" : "bg-orange-500 hover:bg-orange-600"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              {isFull ? "Join Waitlist" : "Join Meetup"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
