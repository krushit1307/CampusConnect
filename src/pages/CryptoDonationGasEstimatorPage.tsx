import React from 'react';
import { CryptoDonationGasEstimator } from '@/components/clubs/CryptoDonationGasEstimator';

export const CryptoDonationGasEstimatorPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <CryptoDonationGasEstimator />
    </div>
  );
};

export default CryptoDonationGasEstimatorPage;
