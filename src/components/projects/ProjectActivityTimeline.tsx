import React from 'react';
import { ApplicationRequest } from '../../../backend/src/models/CampusProjectModel';
import { Users, Clock, CheckCircle2, XCircle, Send, UserCheck, MessageSquare } from 'lucide-react';

interface ActivityTimelineProps {
  applications: ApplicationRequest[];
  onDecision: (appId: string, status: 'accepted' | 'declined') => void;
}

export const ProjectActivityTimeline: React.FC<ActivityTimelineProps> = ({
  applications,
  onDecision,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">My Project Collaborator Applications</h3>
          <p className="text-sm text-gray-500">Track pending and accepted project team applications</p>
        </div>
        <span className="bg-indigo-50 text-indigo-700 font-semibold px-3 py-1 rounded-full text-xs">
          {applications.length} Submitted Applications
        </span>
      </div>

      {applications.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Users className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium text-sm">No project applications submitted yet</p>
          <p className="text-xs text-gray-400 mt-1">Browse active capstone and hackathon project posts above to apply.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <div
              key={app.id}
              className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-100/60 text-indigo-700 mt-0.5">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-base">{app.projectTitle}</h4>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 flex-wrap">
                    <span className="bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded">
                      Role: {app.appliedRole}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {app.appliedDate}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-gray-700 font-medium">
                      <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                      "{app.pitch}"
                    </span>
                  </div>
                </div>
              </div>

              {/* Status & Decision Buttons */}
              <div className="flex items-center justify-between md:justify-end gap-4">
                <div className="text-right">
                  <div className="flex items-center gap-1 text-xs">
                    {app.status === 'accepted' && (
                      <span className="text-emerald-600 font-semibold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Team Application Accepted
                      </span>
                    )}
                    {app.status === 'pending' && (
                      <span className="text-amber-600 font-semibold flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-lg">
                        <Clock className="w-3.5 h-3.5" /> Under Owner Review
                      </span>
                    )}
                    {app.status === 'declined' && (
                      <span className="text-red-600 font-semibold flex items-center gap-1 bg-red-50 px-2.5 py-1 rounded-lg">
                        <XCircle className="w-3.5 h-3.5" /> Application Declined
                      </span>
                    )}
                  </div>
                </div>

                {app.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onDecision(app.id, 'accepted')}
                      className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => onDecision(app.id, 'declined')}
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
