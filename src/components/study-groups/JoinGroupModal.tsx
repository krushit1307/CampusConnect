import React, { useState } from "react";
import { X, Users, MapPin, Clock, Coffee, BookOpen, ChevronRight, CheckCircle2 } from "lucide-react";
import { StudyGroup, requestToJoinGroup } from "../../services/StudyGroupService";

interface JoinGroupModalProps {
    group: StudyGroup;
    onClose: () => void;
    onSuccess: (msg: string) => void;
}

export function JoinGroupModal({ group, onClose, onSuccess }: JoinGroupModalProps) {
    const [loading, setLoading] = useState(false);

    const handleJoin = async () => {
        setLoading(true);
        try {
            const res = await requestToJoinGroup(group.id);
            onSuccess(res.message);
        } catch {
            // Silent for mock
        } finally {
            setLoading(false);
        }
    }

    const isFull = group.members.length >= group.capacity || group.status === "full";
    const percentageFull = (group.members.length / group.capacity) * 100;

    const vibeColors: Record<string, string> = {
        "Intense Focus": "bg-rose-500/20 text-rose-400 border-rose-500/50",
        "Casual Chat": "bg-sky-500/20 text-sky-400 border-sky-500/50",
        "Exam Cram": "bg-amber-500/20 text-amber-400 border-amber-500/50",
        "Homework Help": "bg-emerald-500/20 text-emerald-400 border-emerald-500/50",
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="relative w-full max-w-xl bg-[#0f172a] border border-indigo-500/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">

                {/* Header Block */}
                <div className="bg-slate-900 border-b border-slate-800 p-6 relative">
                    <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-white transition-colors border border-slate-700 hover:bg-slate-700">
                        <X className="w-4 h-4" />
                    </button>

                    <div className="flex gap-2 mb-4">
                        <span className="px-2 py-1 rounded bg-slate-800 text-[10px] font-bold text-indigo-400 uppercase tracking-widest border border-indigo-500/20">{group.courseCode}</span>
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${vibeColors[group.vibe]}`}>{group.vibe}</span>
                        {group.status === "active" && (
                            <span className="px-2 py-1 flex items-center gap-1 rounded bg-rose-500/10 text-[10px] font-black text-rose-400 uppercase tracking-widest border border-rose-500/30">
                                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> LIVE
                            </span>
                        )}
                    </div>

                    <h2 className="text-2xl font-black text-white leading-tight mb-2">{group.title}</h2>
                    <p className="text-sm font-medium text-slate-400 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" /> Topic: <span className="text-slate-200 font-bold">{group.topic}</span>
                    </p>
                </div>

                {/* Info Block */}
                <div className="p-6 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex items-start gap-3">
                            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400"><MapPin className="w-5 h-5" /></div>
                            <div>
                                <p className="text-[10px] font-bold uppercase text-slate-500 mb-0.5">Location</p>
                                <p className="text-sm font-bold text-slate-200 leading-tight">{group.location}</p>
                                <p className="text-xs text-slate-400">{group.roomNumber}</p>
                            </div>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex items-start gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><Clock className="w-5 h-5" /></div>
                            <div>
                                <p className="text-[10px] font-bold uppercase text-slate-500 mb-0.5">Time Window</p>
                                <p className="text-sm font-bold text-slate-200 leading-tight">{new Date(group.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                <p className="text-xs tracking-wider font-medium text-slate-400 uppercase">Until {new Date(group.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                        </div>
                    </div>

                    {(group.hasSnacks || group.isTutorPresent) && (
                        <div className="flex gap-3 mb-8">
                            {group.hasSnacks && (
                                <div className="flex items-center gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-full text-xs font-bold">
                                    <Coffee className="w-3 h-3" /> Host brought snacks!
                                </div>
                            )}
                            {group.isTutorPresent && (
                                <div className="flex items-center gap-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-full text-xs font-bold">
                                    <CheckCircle2 className="w-3 h-3" /> TA / Tutor Present
                                </div>
                            )}
                        </div>
                    )}

                    {/* Members Section */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-sm font-bold text-white flex items-center gap-2"><Users className="w-4 h-4 text-slate-400" /> Current Roster</p>
                            <p className="text-xs font-bold text-slate-500"><span className={isFull ? 'text-rose-400' : 'text-emerald-400'}>{group.members.length}</span> / {group.capacity} Seats Filled</p>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-1.5 bg-slate-800 rounded-full mb-4 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${isFull ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${percentageFull}%` }} />
                        </div>

                        <div className="space-y-3">
                            {group.members.map(member => (
                                <div key={member.id} className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <img src={member.avatar} alt="avatar" className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700" />
                                        <div>
                                            <p className="text-sm font-bold text-white flex items-center gap-2">
                                                {member.name} {member.isHost && <span className="bg-indigo-500/20 text-indigo-400 text-[9px] px-1.5 py-0.5 rounded uppercase border border-indigo-500/20">Host</span>}
                                            </p>
                                            <p className="text-xs text-slate-400">{member.major}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Empty seat placeholders */}
                            {Array.from({ length: group.capacity - group.members.length }).map((_, idx) => (
                                <div key={`empty-${idx}`} className="flex items-center justify-between bg-slate-900/30 border border-slate-800/50 border-dashed p-3 rounded-xl opacity-60">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-800/50 border border-slate-700/50 flex items-center justify-center">
                                            <Users className="w-4 h-4 text-slate-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-500">Open Seat</p>
                                            <p className="text-xs text-slate-600">Available</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="bg-slate-900 border-t border-slate-800 p-6 mt-auto">
                    <button
                        onClick={handleJoin}
                        disabled={loading || isFull}
                        className={`w-full py-4 rounded-xl text-sm font-black transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] ${isFull
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                                : 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-indigo-500/20 cursor-pointer'
                            }`}
                    >
                        {loading ? "Confirming..." : isFull ? "Group is Full" : "RSVP & Reveal Exact Table Number"}
                        {!isFull && !loading && <ChevronRight className="w-5 h-5" />}
                    </button>
                    {!isFull && <p className="text-[10px] text-center text-slate-500 font-bold uppercase mt-3">By joining, you agree to respect the group vibe</p>}
                </div>

            </div>
        </div>
    )
}
