import React, { useState, useEffect } from "react";
import {
  generateAvailableTimeSlots,
  bookMentorshipSession,
  generateIcsInvite,
  TimeSlot,
} from "@/services/alumniMentorshipService";
import type { MentorshipSession } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Video, Download, CheckCircle2, Coins, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface AlumniCalendarSchedulerProps {
  mentorId: string;
  mentorName: string;
  currentUserId?: string;
  userPointsBalance?: number;
}

export const AlumniCalendarScheduler: React.FC<AlumniCalendarSchedulerProps> = ({
  mentorId,
  mentorName,
  currentUserId,
  userPointsBalance = 150,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [topic, setTopic] = useState<string>("");
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [bookingLoading, setBookingLoading] = useState<boolean>(false);
  const [confirmedSession, setConfirmedSession] = useState<MentorshipSession | null>(null);

  useEffect(() => {
    async function loadSlots() {
      setLoadingSlots(true);
      try {
        const availableSlots = await generateAvailableTimeSlots(mentorId, selectedDate);
        setSlots(availableSlots);
      } catch (err) {
        console.error("Failed to load time slots:", err);
      } finally {
        setLoadingSlots(false);
      }
    }
    loadSlots();
  }, [mentorId, selectedDate]);

  const handleBookSlot = async () => {
    if (!selectedSlot || !currentUserId) {
      toast.error("Please log in to book a mentorship session.");
      return;
    }

    if (userPointsBalance < 100) {
      toast.error("Insufficient points. You need 100 gamification points to book.");
      return;
    }

    setBookingLoading(true);
    try {
      const res = await bookMentorshipSession(
        mentorId,
        currentUserId,
        selectedSlot.startTimeISO,
        selectedSlot.endTimeISO,
        topic,
      );

      if (!res.success || !res.session_id) {
        toast.error(res.error || "Failed to book mentorship session.");
        return;
      }

      toast.success("Mentorship session successfully booked!");
      const sessionObj: MentorshipSession = {
        id: res.session_id,
        mentor_id: mentorId,
        mentee_id: currentUserId,
        start_time: selectedSlot.startTimeISO,
        end_time: selectedSlot.endTimeISO,
        topic: topic || "General Career Guidance",
        meeting_link: res.meeting_link || "https://meet.jit.si/campusconnect-mentorship",
        status: "scheduled",
        created_at: new Date().toISOString(),
      };
      setConfirmedSession(sessionObj);
    } catch (err) {
      toast.error("An unexpected error occurred during booking.");
      console.error(err);
    } finally {
      setBookingLoading(false);
    }
  };

  const handleDownloadIcs = () => {
    if (!confirmedSession) return;
    const csData = generateIcsInvite(confirmedSession, mentorName);
    const blob = new Blob([csData], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `mentorship-coffee-chat-${confirmedSession.id}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (confirmedSession) {
    return (
      <div className="neu-border bg-emerald-50 p-6 space-y-4">
        <div className="flex items-center gap-2 text-emerald-800 font-bold text-xl">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          <span>Mentorship Coffee Chat Confirmed!</span>
        </div>
        <p className="text-sm text-slate-700">
          Your 15-minute 1-on-1 virtual coffee chat with <strong>{mentorName}</strong> is scheduled.
          100 Gamification points have been deducted from your account.
        </p>

        <div className="neu-border bg-white p-4 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-600">Meeting Link:</span>
            <a
              href={confirmedSession.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 underline font-mono flex items-center gap-1"
            >
              <Video className="w-4 h-4" /> Join Video Call
            </a>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-600">Topic:</span>
            <span className="font-medium text-slate-800">{confirmedSession.topic}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleDownloadIcs}
            className="neu-border neu-press bg-indigo-600 text-white font-bold flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Download Calendar Invite (.ICS)
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setConfirmedSession(null);
              setSelectedSlot(null);
            }}
            className="neu-border bg-white"
          >
            Book Another Slot
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="neu-border bg-white p-6 space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Book a 15-Min Coffee Chat with {mentorName}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Frictionless Calendly-style booking. 1-on-1 career guidance.
          </p>
        </div>
        <Badge className="bg-amber-100 text-amber-900 border border-amber-300 font-bold px-3 py-1 flex items-center gap-1">
          <Coins className="w-4 h-4 text-amber-600" /> 100 Points / Booking
        </Badge>
      </div>

      <div className="space-y-4">
        <label className="block text-sm font-bold text-slate-700">Select Date:</label>
        <input
          type="date"
          value={selectedDate}
          min={new Date().toISOString().split("T")[0]}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="neu-border px-3 py-2 text-sm font-semibold rounded w-full max-w-xs"
        />

        {loadingSlots ? (
          <div className="text-sm font-medium text-slate-500 animate-pulse">
            Loading available time slots...
          </div>
        ) : slots.length === 0 ? (
          <div className="neu-border bg-slate-50 p-4 text-sm text-slate-500 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-slate-400" />
            No open time slots available on this date.
          </div>
        ) : (
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Select a 15-Minute Slot:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {slots.map((slot, idx) => (
                <button
                  key={idx}
                  disabled={!slot.isAvailable}
                  onClick={() => setSelectedSlot(slot)}
                  className={`neu-border p-2 text-xs font-bold rounded text-center transition-all ${
                    selectedSlot?.startTimeISO === slot.startTimeISO
                      ? "bg-indigo-600 text-white shadow-[2px_2px_0_0_var(--color-ink,#000)]"
                      : slot.isAvailable
                        ? "bg-white text-slate-800 hover:bg-indigo-50"
                        : "bg-slate-100 text-slate-400 line-through cursor-not-allowed"
                  }`}
                >
                  <Clock className="w-3 h-3 inline mr-1" />
                  {slot.displayLabel}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedSlot && (
          <div className="neu-border bg-indigo-50/50 p-4 space-y-3 mt-4">
            <div className="text-sm font-bold text-indigo-950">
              Booking Slot: {selectedSlot.displayLabel}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                What would you like to discuss? (Optional):
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Resume review, career advice, tech interviews..."
                className="neu-border px-3 py-2 text-xs w-full bg-white"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-amber-600" /> 100 Gamification points will be
                deducted
              </span>

              <Button
                onClick={handleBookSlot}
                disabled={bookingLoading}
                className="neu-border neu-press bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider"
              >
                {bookingLoading ? "Confirming..." : "Confirm Coffee Chat"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
