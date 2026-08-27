import React from 'react';
import { HousingInquiry } from '../../../backend/src/models/CampusHousingModel';
import { Home, Clock, CheckCircle2, XCircle, Mail, Calendar, MessageSquare } from 'lucide-react';

interface ActivityTimelineProps {
  inquiries: HousingInquiry[];
  onDecision: (inquiryId: string, status: 'accepted' | 'declined') => void;
}

export const HousingActivityTimeline: React.FC<ActivityTimelineProps> = ({
  inquiries,
  onDecision,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">My Housing & Sublease Inquiries</h3>
          <p className="text-sm text-gray-500">Track pending and accepted sublease application inquiries</p>
        </div>
        <span className="bg-indigo-50 text-indigo-700 font-semibold px-3 py-1 rounded-full text-xs">
          {inquiries.length} Inquiries Sent
        </span>
      </div>

      {inquiries.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Home className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium text-sm">No sublease inquiries submitted yet</p>
          <p className="text-xs text-gray-400 mt-1">Browse active housing listings above to message student listers.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {inquiries.map((inq) => (
            <div
              key={inq.id}
              className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-100/60 text-indigo-700 mt-0.5">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-base">{inq.propertyTitle}</h4>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 font-semibold text-indigo-700">
                      <Calendar className="w-3.5 h-3.5" /> Move-in: {inq.moveInDate}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {inq.submittedDate}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-gray-700 font-medium">
                      <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                      "{inq.message}"
                    </span>
                  </div>
                </div>
              </div>

              {/* Status & Decision Buttons */}
              <div className="flex items-center justify-between md:justify-end gap-4">
                <div className="text-right">
                  <div className="flex items-center gap-1 text-xs">
                    {inq.status === 'accepted' && (
                      <span className="text-emerald-600 font-semibold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Inquiry Accepted
                      </span>
                    )}
                    {inq.status === 'pending' && (
                      <span className="text-amber-600 font-semibold flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-lg">
                        <Clock className="w-3.5 h-3.5" /> Pending Response
                      </span>
                    )}
                    {inq.status === 'declined' && (
                      <span className="text-red-600 font-semibold flex items-center gap-1 bg-red-50 px-2.5 py-1 rounded-lg">
                        <XCircle className="w-3.5 h-3.5" /> Inquiry Declined
                      </span>
                    )}
                  </div>
                </div>

                {inq.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onDecision(inq.id, 'accepted')}
                      className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => onDecision(inq.id, 'declined')}
                      className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
