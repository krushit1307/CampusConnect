import React from 'react';
import { AlumniSpeakerEngagementTracker } from '@/components/alumni/AlumniSpeakerEngagementTracker';

export const AlumniSpeakerEngagementPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <AlumniSpeakerEngagementTracker />
    </div>
  );
};

export default AlumniSpeakerEngagementPage;
