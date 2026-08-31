import React from 'react';
import { DutchAuctionDynamicPricingWidget } from '@/components/tickets/DutchAuctionDynamicPricingWidget';

export const DutchAuctionPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <DutchAuctionDynamicPricingWidget eventId="evt-spring-gala-2026" />
    </div>
  );
};

export default DutchAuctionPage;
