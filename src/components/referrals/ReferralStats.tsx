import React from "react";
import { Users, UserPlus, Star } from "lucide-react";

interface ReferralStatsProps {
  totalReferrals: number;
  pendingReferrals: number;
  pointsEarned: number;
}

export const ReferralStats: React.FC<ReferralStatsProps> = ({
  totalReferrals,
  pendingReferrals,
  pointsEarned,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="neu-border p-6 bg-white flex flex-col gap-2">
        <div className="flex items-center gap-2 text-gray-500 mb-2">
          <Users size={20} />
          <h4 className="font-bold uppercase text-sm">Total Referrals</h4>
        </div>
        <p className="text-4xl font-black">{totalReferrals}</p>
        <p className="text-sm text-gray-500 font-medium">Successfully completed</p>
      </div>

      <div className="neu-border p-6 bg-white flex flex-col gap-2">
        <div className="flex items-center gap-2 text-gray-500 mb-2">
          <UserPlus size={20} />
          <h4 className="font-bold uppercase text-sm">Pending Referrals</h4>
        </div>
        <p className="text-4xl font-black text-gray-400">{pendingReferrals}</p>
        <p className="text-sm text-gray-500 font-medium">Signed up, hasn't attended</p>
      </div>

      <div className="neu-border p-6 bg-green-100 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-green-800 mb-2">
          <Star size={20} className="fill-green-800" />
          <h4 className="font-bold uppercase text-sm">Points Earned</h4>
        </div>
        <p className="text-4xl font-black text-green-900">{pointsEarned}</p>
        <p className="text-sm text-green-700 font-medium">From referrals alone</p>
      </div>
    </div>
  );
};
