import React from 'react';
import { ClubRivalryMatchupWidget } from '@/components/leaderboard/ClubRivalryMatchupWidget';

export const ClubRivalryMatchupPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <ClubRivalryMatchupWidget />
    </div>
  );
};

export default ClubRivalryMatchupPage;
