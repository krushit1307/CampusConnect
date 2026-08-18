import React from 'react';
import { Star, Bookmark, Calendar, CheckCircle, MessageSquare, ShieldCheck, Award } from 'lucide-react';

export interface MentorProfile {
  id: string;
  name: string;
  title: string;
  avatar: string;
  department: string;
  expertise: string[];
  rating: number;
  reviewsCount: number;
  sessionsCompleted: number;
  hourlyRate: string;
  availabilityStatus: string;
  bio: string;
  isBookmarked: boolean;
}

interface MentorCardProps {
  mentor: MentorProfile;
  onBookmark: () => void;
  onBookSession: () => void;
}

export default function MentorCard({ mentor, onBookmark, onBookSession }: MentorCardProps) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-emerald-500/10 flex flex-col justify-between group">
      <div>
        {/* Header Avatar & Top Details */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <img
                src={mentor.avatar}
                alt={mentor.name}
                className="w-14 h-14 rounded-full border-2 border-emerald-500/30 object-cover"
              />
              <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 p-0.5 rounded-full border-2 border-slate-900" title="Verified Mentor">
                <CheckCircle className="w-3.5 h-3.5 fill-current" />
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-100 group-hover:text-emerald-300 transition flex items-center gap-1.5">
                {mentor.name}
              </h3>
              <p className="text-xs text-slate-400 font-medium">{mentor.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded font-mono">
                  {mentor.department}
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold">
                  {mentor.availabilityStatus}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onBookmark}
            className={`p-2 rounded-xl transition ${
              mentor.isBookmarked
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bookmark className="w-4 h-4 fill-current" />
          </button>
        </div>

        {/* Bio */}
        <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed mb-4">
          {mentor.bio}
        </p>

        {/* Expertise Tags */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {mentor.expertise.map((skill, index) => (
            <span
              key={index}
              className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[11px] px-2.5 py-0.5 rounded-md font-medium"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Footer Metrics & Actions */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1 text-amber-400 font-bold">
            <Star className="w-3.5 h-3.5 fill-current" />
            <span>{mentor.rating.toFixed(2)}</span>
            <span className="text-slate-500 font-normal">({mentor.reviewsCount})</span>
          </div>

          <div className="text-slate-400 text-[11px]">
            <span className="font-semibold text-slate-200">{mentor.sessionsCompleted}</span> sessions
          </div>
        </div>

        <button
          onClick={onBookSession}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
        >
          <Calendar className="w-3.5 h-3.5" /> Book Session
        </button>
      </div>
    </div>
  );
}
