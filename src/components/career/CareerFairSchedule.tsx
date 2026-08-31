import React, { useState } from "react";
import {
  Calendar,
  MapPin,
  Globe,
  Users,
  Clock,
  Tag,
  Search,
  Filter,
  CheckCircle2,
  ExternalLink,
  Building2,
  Sparkles,
  ChevronRight,
  Video,
  MapPinned,
} from "lucide-react";
import type { CareerFairEvent } from "../../types/career";

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatEventDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatEventTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function getDaysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

// ─── Event Card ──────────────────────────────────────────────────────────

interface CareerFairCardProps {
  event: CareerFairEvent;
  onToggleRegister: (eventId: string) => void;
}

const CareerFairCard: React.FC<CareerFairCardProps> = ({ event, onToggleRegister }) => {
  const days = getDaysUntil(event.date);
  const isPast = days < 0;
  const isSoon = days >= 0 && days <= 7;

  return (
    <div
      className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all ${
        isPast
          ? "border-slate-800 opacity-60"
          : event.isRegistered
            ? "border-emerald-800/50"
            : "border-slate-800 hover:border-slate-700"
      }`}
    >
      {/* Gradient Header */}
      <div
        className={`px-5 py-4 ${
          event.virtual
            ? "bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900"
            : "bg-gradient-to-r from-violet-900/40 via-purple-900/30 to-slate-900"
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {event.virtual ? (
                <Video className="w-4 h-4 text-blue-400" />
              ) : (
                <MapPinned className="w-4 h-4 text-violet-400" />
              )}
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {event.virtual ? "Virtual Event" : "In-Person Event"}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-100">{event.name}</h3>
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{event.description}</p>
          </div>

          {!isPast && days >= 0 && (
            <div
              className={`text-center px-3 py-2 rounded-xl flex-shrink-0 ${
                isSoon
                  ? "bg-amber-900/50 border border-amber-800"
                  : "bg-slate-800 border border-slate-700"
              }`}
            >
              <div
                className={`text-lg font-black font-mono ${isSoon ? "text-amber-400" : "text-slate-300"}`}
              >
                {days === 0 ? "TODAY" : days}
              </div>
              <div
                className={`text-[9px] font-bold uppercase ${isSoon ? "text-amber-500" : "text-slate-500"}`}
              >
                {days === 0 ? "" : "days"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="px-5 py-3 space-y-2">
        {/* Date & Time */}
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-violet-400" />
            {formatEventDate(event.date)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            {formatEventTime(event.date)} – {formatEventTime(event.endDate)}
          </span>
        </div>

        {/* Location */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          {event.location}
        </div>

        {/* Company Logos */}
        {event.companies.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex -space-x-2">
              {event.companies.slice(0, 6).map((company, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[8px] font-bold text-slate-400"
                  title={company}
                >
                  {company.slice(0, 2).toUpperCase()}
                </div>
              ))}
              {event.companies.length > 6 && (
                <div className="w-7 h-7 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[8px] font-bold text-slate-500">
                  +{event.companies.length - 6}
                </div>
              )}
            </div>
            <span className="text-[10px] text-slate-500">
              {event.companies.length} companies attending
            </span>
          </div>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mt-1">
          {event.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-full text-slate-400 flex items-center gap-1"
            >
              <Tag className="w-2.5 h-2.5" />
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-800/50 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Users className="w-3.5 h-3.5" />
          {event.registeredCount} registered
        </div>

        {!isPast && (
          <button
            onClick={() => onToggleRegister(event.id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
              event.isRegistered
                ? "bg-emerald-900/50 text-emerald-400 border border-emerald-800 hover:bg-emerald-900"
                : "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/20"
            }`}
          >
            {event.isRegistered ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Registered
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Register
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Export ──────────────────────────────────────────────────────────────

export { CareerFairCard, formatEventDate, formatEventTime, getDaysUntil };
