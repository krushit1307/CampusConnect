import React from 'react';
import { MentalHealthThermalOvercrowdingDetector } from '@/components/wellness/MentalHealthThermalOvercrowdingDetector';

export const MentalHealthThermalOvercrowdingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <MentalHealthThermalOvercrowdingDetector
        venueId="venue-main-auditorium"
        venueName="Main Student Union Auditorium"
        capacity={200}
      />
    </div>
  );
};

export default MentalHealthThermalOvercrowdingPage;
