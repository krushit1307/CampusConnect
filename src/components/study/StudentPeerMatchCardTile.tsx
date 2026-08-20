import React from 'react';
import { UserCheck, BookOpen, Clock, Sparkles, MessageSquare, Plus } from 'lucide-react';
import { StudentPeerProfile } from '../../services/studyGroupEngine';

interface PeerCardProps {
    peer: StudentPeerProfile;
    onInviteToGroup: (peer: StudentPeerProfile) => void;
    isInvited: boolean;
}

export const StudentPeerMatchCardTile: React.FC<PeerCardProps> = ({ peer, onInviteToGroup, isInvited }) => {
    return (
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between">
            <div className="space-y-3">
                {/* Header Profile Info */}
                <div className="flex items-center gap-3">
                    <img
                        src={peer.avatarUrl}
                        alt={peer.fullName}
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-700 shadow-md"
                    />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-100 truncate">{peer.fullName}</h4>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> {peer.compatibilityScore}% Match
                            </span>
                        </div>
                        <p className="text-[11px] text-indigo-400 font-medium truncate">{peer.major}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{peer.academicYear}</p>
                    </div>
                </div>

                {/* Preferred Mode Badge */}
                <div className="p-2.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-500 font-mono uppercase font-bold block">Study Style</span>
                    <span className="text-xs text-indigo-300 font-semibold">{peer.preferredStudyMode}</span>
                </div>

                {/* Shared Enrolled Courses */}
                <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-mono uppercase font-bold flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-indigo-400" /> Enrolled Courses
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {peer.enrolledCourses.map((course, idx) => (
                            <span
                                key={idx}
                                className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-medium border border-slate-700"
                            >
                                {course}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Available Slots */}
                <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-mono uppercase font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-400" /> Free Slots
                    </span>
                    <div className="space-y-1">
                        {peer.availabilitySlots.map((slot, idx) => (
                            <p key={idx} className="text-[10px] text-slate-400 font-mono pl-2 border-l border-emerald-500/30">
                                {slot}
                            </p>
                        ))}
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-slate-800 flex gap-2">
                <button
                    type="button"
                    onClick={() => onInviteToGroup(peer)}
                    className={`flex-1 py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                        isInvited
                            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                    }`}
                >
                    {isInvited ? (
                        <>
                            <UserCheck className="w-3.5 h-3.5" /> Invite Sent
                        </>
                    ) : (
                        <>
                            <Plus className="w-3.5 h-3.5" /> Invite to Group
                        </>
                    )}
                </button>
                <button
                    type="button"
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                    title="Direct Message"
                >
                    <MessageSquare className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
