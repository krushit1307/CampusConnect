import React from 'react';
import { Calendar, Ticket, MapPin, Clock, ShieldCheck, QrCode } from 'lucide-react';

export interface CampusEvent {
  id: string;
  eventTitle: string;
  organizerClub: string;
  eventCategory: string;
  dateSchedule: string;
  venueLocation: string;
  ticketPriceUSD: number;
  availableTickets: number;
  totalCapacity: number;
  organizerAvatar: string;
  verificationStatus: string;
  description: string;
  isRSVPed: boolean;
  status: 'RSVP_OPEN' | 'ALMOST_FULL' | 'SOLD_OUT';
}

interface EventTicketCardProps {
  event: CampusEvent;
  onRSVP: () => void;
  onInspect: () => void;
}

export default function EventTicketCard({ event, onRSVP, onInspect }: EventTicketCardProps) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-violet-500/50 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-violet-500/10 flex flex-col justify-between group">
      <div>
        {/* Category & Price Pill */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="bg-violet-500/10 text-violet-400 border border-violet-500/20 text-xs px-2.5 py-0.5 rounded-md font-semibold">
              {event.eventCategory}
            </span>
            <span className="bg-slate-800 text-slate-300 text-[11px] px-2 py-0.5 rounded-md font-medium">
              {event.organizerClub}
            </span>
          </div>

          <div className="flex items-baseline gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 font-mono">
            <span className="text-violet-300 font-black text-sm">
              {event.ticketPriceUSD === 0 ? 'FREE' : `$${event.ticketPriceUSD}`}
            </span>
          </div>
        </div>

        {/* Title */}
        <h3
          onClick={onInspect}
          className="text-base font-bold text-slate-100 group-hover:text-violet-300 transition cursor-pointer line-clamp-2 mb-2"
        >
          {event.eventTitle}
        </h3>

        {/* Date & Location Box */}
        <div className="space-y-1.5 mb-4 bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="truncate">{event.dateSchedule}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">{event.venueLocation}</span>
          </div>
        </div>

        <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed mb-4">
          {event.description}
        </p>

        {/* Capacity Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
            <span>Passes Available</span>
            <span className="text-slate-200 font-bold">{event.availableTickets} / {event.totalCapacity}</span>
          </div>
          <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"
              style={{ width: `${((event.totalCapacity - event.availableTickets) / event.totalCapacity) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={event.organizerAvatar} alt={event.organizerClub} className="w-7 h-7 rounded-full border border-slate-700" />
          <div className="text-xs font-semibold text-slate-300 flex items-center gap-1">
            Official Club <ShieldCheck className="w-3 h-3 text-violet-400" />
          </div>
        </div>

        <button
          onClick={onRSVP}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-md ${
            event.isRSVPed
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-600/20'
          }`}
        >
          <Ticket className="w-3.5 h-3.5" />
          {event.isRSVPed ? 'Pass Reserved' : 'RSVP Pass'}
        </button>
      </div>
    </div>
  );
}
