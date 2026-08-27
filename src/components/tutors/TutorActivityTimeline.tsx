import React from 'react';
import { BookingSession } from '../../../backend/src/models/CampusTutorModel';
import { Calendar, Clock, CheckCircle2, AlertCircle, XCircle, DollarSign, UserCheck } from 'lucide-react';

interface ActivityTimelineProps {
  bookings: BookingSession[];
  onCancelBooking: (id: string) => void;
}

export const TutorActivityTimeline: React.FC<ActivityTimelineProps> = ({
  bookings,
  onCancelBooking,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">My Peer Tutoring Sessions</h3>
          <p className="text-sm text-gray-500">Track upcoming bookings and tutoring session status</p>
        </div>
        <span className="bg-indigo-50 text-indigo-700 font-semibold px-3 py-1 rounded-full text-xs">
          {bookings.length} Active Bookings
        </span>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Calendar className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium text-sm">No tutoring sessions scheduled yet</p>
          <p className="text-xs text-gray-400 mt-1">Browse verified course tutors above to book 1-on-1 prep.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((session) => (
            <div
              key={session.id}
              className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-100/60 text-indigo-700 mt-0.5">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900 text-base">{session.tutorName}</h4>
                    <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded">
                      {session.courseCode}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {session.scheduledTime}
                    </span>
                    <span>•</span>
                    <span className="capitalize bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-medium">
                      {session.sessionType} ({session.durationMinutes} mins)
                    </span>
                  </div>
                </div>
              </div>

              {/* Status & Cancel Action */}
              <div className="flex items-center justify-between md:justify-end gap-4">
                <div className="text-right">
                  <div className="flex items-center gap-1 font-bold text-gray-900 text-base">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span>{session.totalPrice}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {session.status === 'confirmed' && (
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
                      </span>
                    )}
                    {session.status === 'pending' && (
                      <span className="text-amber-600 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Pending Confirmation
                      </span>
                    )}
                    {session.status === 'cancelled' && (
                      <span className="text-red-600 font-semibold flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> Cancelled
                      </span>
                    )}
                  </div>
                </div>

                {session.status !== 'cancelled' && (
                  <button
                    onClick={() => onCancelBooking(session.id)}
                    className="text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors"
                  >
                    Cancel Session
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
