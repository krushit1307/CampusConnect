import React, { useState } from 'react';
import { CoHostPartnership } from '@/types/cohost';
import { Handshake, Calendar, MapPin, CheckCircle, XCircle, ShieldCheck, Clock } from 'lucide-react';

interface CoHostApprovalCardProps {
  partnership: CoHostPartnership;
  isIncoming: boolean;
  onApprove: (partnershipId: string) => void;
  onDecline: (partnershipId: string) => void;
}

export function CoHostApprovalCard({
  partnership,
  isIncoming,
  onApprove,
  onDecline,
}: CoHostApprovalCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAction = (type: 'approve' | 'decline') => {
    setIsProcessing(true);
    setTimeout(() => {
      if (type === 'approve') onApprove(partnership.id);
      else onDecline(partnership.id);
      setIsProcessing(false);
    }, 400);
  };

  const statusBadges = {
    pending: 'bg-amber-100 text-amber-800 border-amber-300',
    approved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    declined: 'bg-red-100 text-red-800 border-red-300',
    revoked: 'bg-slate-100 text-gray-600 border-slate-300',
  };

  return (
    <div className="bg-white border-2 border-black rounded-lg p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between space-y-4 hover:-translate-y-0.5 transition-transform">
      <div>
        {/* Header with Club Partner & Status */}
        <div className="flex items-start justify-between gap-3 mb-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-black bg-lime/30 flex items-center justify-center font-display font-black text-sm text-black">
              {partnership.initiatingClub.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-display font-black text-base text-black">
                <span>{partnership.initiatingClub.name}</span>
                <Handshake size={14} className="text-gray-400" />
                <span>{partnership.invitedClub.name}</span>
              </div>
              <p className="font-mono text-xs text-gray-500">
                Initiated by {partnership.initiatingClub.presidentName}
              </p>
            </div>
          </div>

          <span
            className={`px-2.5 py-0.5 rounded-full font-mono text-xs font-bold uppercase border ${
              statusBadges[partnership.status]
            }`}
          >
            {partnership.status}
          </span>
        </div>

        {/* Event Details */}
        <div className="space-y-1.5 font-mono text-xs text-gray-700">
          <h4 className="font-display font-black text-base text-black">
            {partnership.eventTitle}
          </h4>
          <div className="flex items-center gap-4 text-gray-600">
            <span className="flex items-center gap-1">
              <Calendar size={13} /> {partnership.eventDate}
            </span>
            <span className="flex items-center gap-1">
              <MapPin size={13} /> {partnership.eventLocation}
            </span>
          </div>
        </div>

        {/* Permission Grant Notice */}
        {partnership.grantExecutivePermissions && (
          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded font-mono text-[11px] text-blue-900 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-blue-600 shrink-0" />
            <span>Shared Executive Access (RSVPs, Scanner & Dashboard Edit Rights)</span>
          </div>
        )}
      </div>

      {/* Action Buttons for Incoming Pending Invites */}
      {isIncoming && partnership.status === 'pending' && (
        <div className="pt-3 border-t-2 border-slate-100 flex gap-2">
          <button
            disabled={isProcessing}
            onClick={() => handleAction('decline')}
            className="flex-1 py-2 border-2 border-black rounded font-mono text-xs font-bold uppercase text-red-700 hover:bg-red-50 disabled:opacity-40"
          >
            Decline
          </button>
          <button
            disabled={isProcessing}
            onClick={() => handleAction('approve')}
            className="flex-1 py-2 bg-lime hover:bg-lime/90 border-2 border-black rounded font-mono text-xs font-black uppercase text-black shadow-xs active:scale-95 disabled:opacity-40"
          >
            Approve Co-Host
          </button>
        </div>
      )}
    </div>
  );
}
