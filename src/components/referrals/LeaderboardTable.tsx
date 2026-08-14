import React from "react";
import { Trophy, Medal } from "lucide-react";

export interface LeaderboardEntry {
  id: string;
  full_name: string;
  referrals: number;
  points: number;
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ entries }) => {
  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="text-yellow-500" size={24} />;
      case 1:
        return <Medal className="text-gray-400" size={24} />;
      case 2:
        return <Medal className="text-amber-700" size={24} />;
      default:
        return <span className="font-bold text-gray-500 w-6 text-center">{index + 1}</span>;
    }
  };

  return (
    <div className="neu-border overflow-hidden bg-white">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-black text-white uppercase text-sm tracking-wider">
            <th className="p-4 border-b border-black w-16 text-center">Rank</th>
            <th className="p-4 border-b border-black">User</th>
            <th className="p-4 border-b border-black text-right">Referrals</th>
            <th className="p-4 border-b border-black text-right">Points</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={4} className="p-8 text-center text-gray-500 italic font-medium">
                No referrers yet. Be the first to top the leaderboard!
              </td>
            </tr>
          ) : (
            entries.map((entry, idx) => (
              <tr
                key={entry.id}
                className="border-b border-gray-200 hover:bg-yellow-50 transition-colors"
              >
                <td className="p-4 text-center flex justify-center">{getRankIcon(idx)}</td>
                <td className="p-4 font-bold">{entry.full_name || "Anonymous User"}</td>
                <td className="p-4 text-right font-black text-blue-600">{entry.referrals}</td>
                <td className="p-4 text-right font-black text-green-600">
                  {entry.points.toLocaleString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
