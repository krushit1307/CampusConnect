import React from 'react';
import { Calendar, CheckCircle2, ShieldCheck, Ticket, QrCode, Clock } from 'lucide-react';

interface EventRSVPActivity {
  id: string;
  eventTitle: string;
  organizerClub: string;
  attendeeName: string;
  ticketType: string;
  qrCodeRef: string;
  timestampAgo: string;
}

const RECENT_RSVP_ACTIVITY: EventRSVPActivity[] = [
  {
    id: 'rsvp-1',
    eventTitle: 'Annual Campus Hackathon & AI Showcase 2026',
    organizerClub: 'ACM Student Chapter',
    attendeeName: 'Marcus Vance',
    ticketType: 'VIP Hacker Pass',
    qrCodeRef: 'QR-ACM-2026-901',
    timestampAgo: '10 mins ago',
  },
  {
    id: 'rsvp-2',
    eventTitle: 'Fall Music Fest & Indie Band Concert',
    organizerClub: 'Performing Arts Guild',
    attendeeName: 'Elena Rostova',
    ticketType: 'General Admission',
    qrCodeRef: 'QR-FEST-2026-441',
    timestampAgo: '45 mins ago',
  },
  {
    id: 'rsvp-3',
    eventTitle: 'Executive Leadership & Venture Pitch Summit',
    organizerClub: 'VC Club',
    attendeeName: 'David Chen',
    ticketType: 'Student Founder Pass',
    qrCodeRef: 'QR-VC-2026-880',
    timestampAgo: '2 hours ago',
  },
];

export default function EventActivityTimeline() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-violet-500/10 text-violet-400 rounded-xl border border-violet-500/20">
            <Ticket className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">1,240</div>
            <div className="text-slate-400 text-xs font-medium">Digital Event Passes Issued</div>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">100%</div>
            <div className="text-slate-400 text-xs font-medium">Contactless Door Check-ins</div>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">45</div>
            <div className="text-slate-400 text-xs font-medium">Verified Student Clubs</div>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <Clock className="w-5 h-5 text-violet-400" /> Live Campus Event RSVP Stream
      </h3>

      <div className="space-y-4">
        {RECENT_RSVP_ACTIVITY.map((item) => (
          <div
            key={item.id}
            className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 hover:border-violet-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-violet-500/10 text-violet-400 text-[11px] font-mono px-2 py-0.5 rounded border border-violet-500/20 font-bold">
                  {item.organizerClub}
                </span>
                <span className="text-slate-500 text-xs font-mono">{item.timestampAgo}</span>
              </div>
              <h4 className="text-base font-bold text-slate-100">{item.eventTitle}</h4>
              <div className="text-xs text-slate-400 mt-1 font-mono">
                Attendee: <span className="text-slate-200 font-semibold">{item.attendeeName}</span> • Pass Ref: <span className="text-violet-400 font-semibold">{item.qrCodeRef}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-violet-300 font-mono font-extrabold text-xs bg-violet-500/10 px-3 py-1.5 rounded-xl border border-violet-500/20">
                {item.ticketType}
              </div>
              <div className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Pass Confirmed
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
