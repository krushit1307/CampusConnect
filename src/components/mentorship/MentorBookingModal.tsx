import React, { useState } from 'react';
import { MentorProfile, MentorSlot } from '@/types/mentorship';
import { X, Calendar, Clock, Star, Award, CheckCircle, ShieldCheck } from 'lucide-react';

interface MentorBookingModalProps {
  mentor: MentorProfile;
  isOpen: boolean;
  onClose: () => void;
  onConfirmBooking: (mentorId: string, slotId: string, notes: string) => void;
}

export function MentorBookingModal({
  mentor,
  isOpen,
  onClose,
  onConfirmBooking,
}: MentorBookingModalProps) {
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [sessionGoal, setSessionGoal] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const available = mentor.availableSlots.filter((s) => !s.isBooked);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlotId) return;

    onConfirmBooking(mentor.id, selectedSlotId, sessionGoal);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white border-4 border-black rounded-lg max-w-lg w-full p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 border-2 border-black rounded hover:bg-gray-100"
        >
          <X size={18} />
        </button>

        {/* Mentor Info Header */}
        <div className="flex items-center gap-3 border-b-2 border-black pb-4 mb-4">
          <div className="w-14 h-14 rounded-full border-2 border-black bg-lime/40 flex items-center justify-center font-display font-black text-xl text-black">
            {mentor.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-display font-black text-black">{mentor.name}</h2>
            <p className="text-xs font-mono text-gray-600">{mentor.roleTitle}</p>
            <div className="flex items-center gap-2 mt-1 font-mono text-xs text-amber-600 font-bold">
              <span className="flex items-center gap-0.5">
                <Star size={12} fill="currentColor" /> {mentor.rating.toFixed(1)}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600">{mentor.totalSessionsCompleted} Sessions Conducted</span>
            </div>
          </div>
        </div>

        {isSuccess ? (
          <div className="p-8 text-center space-y-2">
            <div className="w-12 h-12 bg-emerald-100 border-2 border-emerald-600 rounded-full flex items-center justify-center mx-auto text-emerald-700">
              <CheckCircle size={24} />
            </div>
            <h3 className="font-display font-black text-xl text-black">1-on-1 Session Confirmed!</h3>
            <p className="font-mono text-xs text-gray-600">
              Calendar invites & secure study room links dispatched to your campus email.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-xs font-bold uppercase text-gray-700 mb-2">
                Select Available Office Hours Slot
              </label>

              {available.length === 0 ? (
                <p className="font-mono text-xs text-red-600 bg-red-50 p-3 rounded border border-red-200">
                  No slots currently available this week. Check back soon.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {available.map((slot) => {
                    const isSelected = selectedSlotId === slot.id;
                    return (
                      <div
                        key={slot.id}
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={`p-3 border-2 rounded-lg cursor-pointer font-mono text-xs transition-all ${
                          isSelected
                            ? 'bg-lime border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold'
                            : 'bg-slate-50 border-slate-300 hover:border-black'
                        }`}
                      >
                        <div className="flex items-center gap-1 font-bold">
                          <Calendar size={12} /> {slot.dayOfWeek}
                        </div>
                        <div className="text-[11px] text-gray-600 mt-0.5 flex items-center gap-1">
                          <Clock size={11} /> {slot.startTime} - {slot.endTime}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block font-mono text-xs font-bold uppercase text-gray-700 mb-1">
                Session Goal / Topics you want to cover
              </label>
              <textarea
                required
                rows={3}
                value={sessionGoal}
                onChange={(e) => setSessionGoal(e.target.value)}
                placeholder="e.g. Mock technical coding interview on Dynamic Programming and resume review for internships."
                className="w-full p-2.5 border-2 border-black rounded font-mono text-xs bg-white"
              />
            </div>

            <div className="flex items-center gap-2 p-2.5 bg-slate-100 border border-black rounded font-mono text-xs">
              <ShieldCheck size={16} className="text-emerald-700 shrink-0" />
              <span>
                Cost: <strong className="text-black">{mentor.hourlyMeritCost === 0 ? 'Free (Peer Volunteer)' : `${mentor.hourlyMeritCost} Merit Points`}</strong>
              </span>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 border-2 border-black rounded font-mono text-xs font-bold uppercase hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedSlotId}
                className="flex-1 py-2.5 bg-lime hover:bg-lime/90 border-2 border-black rounded font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-40"
              >
                Book Office Hours
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
