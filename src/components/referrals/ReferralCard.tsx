import React from "react";
import { CheckCircle2, CircleDashed } from "lucide-react";

export interface Referral {
  id: string;
  full_name: string;
  avatar_url?: string;
  referral_rewarded: boolean;
  created_at: string;
}

interface ReferralCardProps {
  referral: Referral;
}

export const ReferralCard: React.FC<ReferralCardProps> = ({ referral }) => {
  return (
    <div className="neu-border bg-white p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 neu-border rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
          {referral.avatar_url ? (
            <img
              src={referral.avatar_url}
              alt={referral.full_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-bold text-gray-400">
              {referral.full_name?.charAt(0).toUpperCase() || "?"}
            </div>
          )}
        </div>
        <div>
          <h5 className="font-bold">{referral.full_name || "Anonymous User"}</h5>
          <p className="text-xs text-gray-500 font-medium">
            Joined {new Date(referral.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 text-sm font-bold uppercase tracking-wider">
        <div className="flex items-center gap-1 text-blue-600">
          <CheckCircle2 size={16} />
          <span>Registered</span>
        </div>
        <div
          className={`flex items-center gap-1 ${referral.referral_rewarded ? "text-green-600" : "text-gray-400"}`}
        >
          {referral.referral_rewarded ? <CheckCircle2 size={16} /> : <CircleDashed size={16} />}
          <span>{referral.referral_rewarded ? "Attended" : "Pending"}</span>
        </div>
      </div>
    </div>
  );
};
