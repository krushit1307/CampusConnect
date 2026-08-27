import React from 'react';
import { Calendar, MapPin, Users, Ticket, CheckCircle2, Clock, Share2, Sparkles } from 'lucide-react';

export interface CampusEvent {
  id: string;
  title: string;
  organizer: string;
  organizerAvatar: string;
  category: 'Hackathon' | 'Symposium' | 'Workshop' | 'Cultural' | 'Sports';
  date: string;
  time: string;
  location: string;
  capacity: number;
  registeredCount: number;
  price: string;
  tags: string[];
  description: string;
  isRSVPed: boolean;
  bannerUrl: string;
  status: 'Upcoming' | 'Live' | 'Ended';
}

interface EventCardProps {
  event: CampusEvent;
  onRSVP: () => void;
  onInspect: () => void;
}

export default function EventCard({ event, onRSVP, onInspect }: EventCardProps) {
  const percentFilled = Math.min(100, Math.round((event.registeredCount / event.capacity) * 100));

  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-purple-500/50 rounded-2xl overflow-hidden shadow-xl transition-all duration-300 hover:shadow-purple-500/10 flex flex-col justify-between group">
      <div>
        {/* Banner Header */}
        <div className="h-44 relative overflow-hidden bg-slate-950">
          <img
            src={event.bannerUrl}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-transparent" />
          
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="bg-purple-600/90 text-white text-xs px-2.5 py-1 rounded-lg font-semibold backdrop-blur-md shadow-md">
              {event.category}
            </span>
            <span className="bg-slate-950/80 text-emerald-400 text-xs px-2.5 py-1 rounded-lg font-semibold border border-emerald-500/30 backdrop-blur-md">
              {event.price}
            </span>
          </div>

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-slate-300 font-medium">
            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-md backdrop-blur-md border border-slate-800">
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              <span>{event.date}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-md backdrop-blur-md border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>{event.time}</span>
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-5">
          <h3
            onClick={onInspect}
            className="text-lg font-bold text-slate-100 hover:text-purple-300 cursor-pointer transition line-clamp-2 mb-2"
          >
            {event.title}
          </h3>

          <div className="flex items-center gap-2 text-slate-400 text-xs mb-3">
            <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>

          <p className="text-slate-400 text-xs line-clamp-3 mb-4 leading-relaxed">
            {event.description}
          </p>

          {/* Attendance Capacity Progress Bar */}
          <div className="space-y-1.5 mb-4">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3 text-indigo-400" /> Capacity Reserved
              </span>
              <span className="font-mono font-semibold text-slate-200">{event.registeredCount} / {event.capacity} ({percentFilled}%)</span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-500 ${
                  percentFilled > 90 ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                }`}
                style={{ width: `${percentFilled}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="px-5 pb-5 pt-2 flex items-center justify-between border-t border-slate-800/80">
        <div className="flex items-center gap-2">
          <img src={event.organizerAvatar} alt={event.organizer} className="w-7 h-7 rounded-full border border-slate-700" />
          <span className="text-xs font-medium text-slate-300 truncate max-w-[120px]">{event.organizer}</span>
        </div>

        <button
          onClick={onRSVP}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-md ${
            event.isRSVPed
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/20'
          }`}
        >
          <Ticket className="w-3.5 h-3.5" />
          {event.isRSVPed ? 'Pass Claimed' : 'RSVP Now'}
        </button>
      </div>
    </div>
  );
}
