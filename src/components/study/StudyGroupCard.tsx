import React from 'react';
import { Users, Clock, MapPin, CheckCircle, UserPlus, BookOpen } from 'lucide-react';

export interface StudyGroup {
  id: string;
  courseCode: string;
  courseTitle: string;
  groupName: string;
  organizerName: string;
  organizerAvatar: string;
  memberCount: number;
  maxCapacity: number;
  meetingTime: string;
  location: string;
  tags: string[];
  description: string;
  isJoined: boolean;
  difficultyLevel: 'Beginner' | 'Intermediate' | 'Advanced';
}

interface StudyGroupCardProps {
  group: StudyGroup;
  onJoin: () => void;
  onInspect: () => void;
}

export default function StudyGroupCard({ group, onJoin, onInspect }: StudyGroupCardProps) {
  const percentCapacity = Math.round((group.memberCount / group.maxCapacity) * 100);

  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-cyan-500/10 flex flex-col justify-between group">
      <div>
        {/* Top Header Tags */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs px-2.5 py-0.5 rounded-md font-mono font-bold">
              {group.courseCode}
            </span>
            <span className="bg-slate-800 text-slate-300 text-[11px] px-2 py-0.5 rounded-md">
              {group.difficultyLevel}
            </span>
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            <span className="text-slate-200 font-bold">{group.memberCount}</span> / {group.maxCapacity} Members
          </div>
        </div>

        {/* Group Name & Description */}
        <h3
          onClick={onInspect}
          className="text-base font-bold text-slate-100 group-hover:text-cyan-300 transition cursor-pointer line-clamp-2 mb-1"
        >
          {group.groupName}
        </h3>
        <div className="text-xs text-slate-500 font-medium mb-3">{group.courseTitle}</div>

        <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed mb-4">
          {group.description}
        </p>

        {/* Schedule & Location */}
        <div className="space-y-1.5 mb-5 bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">{group.meetingTime}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">{group.location}</span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {group.tags.map((tag, i) => (
            <span key={i} className="bg-slate-950 text-slate-400 border border-slate-800 text-[11px] px-2 py-0.5 rounded-md">
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Footer Organizer & Action */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={group.organizerAvatar} alt={group.organizerName} className="w-7 h-7 rounded-full border border-slate-700" />
          <div className="text-xs font-semibold text-slate-300">{group.organizerName}</div>
        </div>

        <button
          onClick={onJoin}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-md ${
            group.isJoined
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/20'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" />
          {group.isJoined ? 'Enrolled' : 'Join Circle'}
        </button>
      </div>
    </div>
  );
}
