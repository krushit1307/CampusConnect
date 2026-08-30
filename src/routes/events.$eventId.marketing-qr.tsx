import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SiteShell } from '@/components/site/SiteShell';
import { EventQrMarketingStudio } from '@/components/marketing/EventQrMarketingStudio';
import { MarketingEventDetails } from '@/types/eventMarketing';
import { QrCode, ArrowLeft, ShieldCheck, Sparkles, Printer } from 'lucide-react';

export default function EventMarketingQrPage() {
  const { eventId } = useParams<{ eventId: string }>();

  const [eventDetails] = useState<MarketingEventDetails>({
    eventId: eventId || 'evt-hackathon-2026',
    title: 'Spring Campus Hackathon & Demo Day',
    clubName: 'ACM Student Chapter',
    dateString: 'Saturday, Oct 24 • 10:00 AM',
    location: 'Engineering Quad / Ballroom',
    targetUrl: `https://campusconnect.edu/events/${eventId || 'evt-hackathon-2026'}`,
  });

  return (
    <SiteShell>
      <div className="min-h-screen bg-[#faf8f5] py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-black pb-6">
            <div className="flex items-center gap-3">
              <Link
                to={`/events/${eventId || ''}`}
                className="neu-border bg-white p-2.5 hover:bg-gray-50 flex items-center justify-center transition-transform hover:-translate-y-0.5"
              >
                <ArrowLeft size={18} />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-lime border-2 border-black rounded">
                    <QrCode size={20} />
                  </span>
                  <h1 className="text-2xl md:text-3xl font-display font-black tracking-tight text-black">
                    Event Marketing QR Generator
                  </h1>
                </div>
                <p className="font-mono text-xs text-gray-600 mt-0.5">
                  Direct printable flyer studio with High Error-Correction (Level H) and center club logo overlay.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white px-3.5 py-2 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-mono text-xs font-bold text-gray-700">
              <ShieldCheck size={18} className="text-emerald-600" />
              <span>Verified Direct Link Guarantee</span>
            </div>
          </div>

          {/* Marketing QR Studio */}
          <EventQrMarketingStudio event={eventDetails} />
        </div>
      </div>
    </SiteShell>
  );
}
