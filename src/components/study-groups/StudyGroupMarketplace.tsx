import React, { useState, useEffect, useCallback } from "react";
import { Users, Search, BookOpen, MapPin, Clock, Calendar, CheckCircle } from "lucide-react";
import {
    StudyGroupFilters, StudyGroup, fetchStudyGroups, getDefaultGroupFilters, GroupStatus
} from "../../services/StudyGroupService";
import { JoinGroupModal } from "./JoinGroupModal";

export function StudyGroupMarketplace() {
    const [filters, setFilters] = useState<StudyGroupFilters>(getDefaultGroupFilters());
    const [groups, setGroups] = useState<StudyGroup[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null);
    const [successToast, setSuccessToast] = useState<string | null>(null);

    useEffect(() => { setGroups(fetchStudyGroups(filters)); }, [filters]);

    const updateFilter = useCallback((partial: Partial<StudyGroupFilters>) => {
        setFilters(f => ({ ...f, ...partial }));
    }, []);

    const handleSuccess = (msg: string) => {
        setSelectedGroup(null);
        setSuccessToast(msg);
        setGroups(fetchStudyGroups(filters)); // Refresh lists so current user populates mock
        setTimeout(() => setSuccessToast(null), 5000);
    };

    const statusColors: Record<GroupStatus, string> = {
        "active": "bg-rose-500/20 text-rose-400 border-rose-500/50",
        "scheduled": "bg-indigo-500/20 text-indigo-400 border-indigo-500/50",
        "full": "bg-slate-800 text-slate-500 border-slate-700",
        "ended": "bg-slate-900 text-slate-600 border-slate-800"
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">

            {/* Hero Navigation */}
            <div className="bg-[#0b1121] border-b border-slate-800/80 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-rose-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-indigo-400/30">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-white leading-tight">Live Study Groups</h1>
                            <p className="text-xs tracking-wider text-slate-400 font-bold uppercase mt-1">Cram together. Pass together.</p>
                        </div>
                    </div>

                    <button className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg flex-center items-center gap-2 text-sm shadow-indigo-500/20">
                        Host a Session
                    </button>
                </div>
            </div>

            {successToast && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-emerald-500/90 backdrop-blur border border-emerald-400 text-white px-6 py-3 rounded-full font-bold shadow-2xl flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" /> {successToast}
                </div>
            )}

            {/* Toolbar */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                <div className="flex flex-col md:flex-row gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800 shadow-xl">

                    {/* Search */}
                    <div className="relative md:w-1/3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search by Course, Topic, or Major..."
                            value={filters.query}
                            onChange={e => updateFilter({ query: e.target.value })}
                            className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-indigo-500 text-white transition-colors placeholder-slate-600"
                        />
                    </div>

                    {/* Dynamic Pills & Selectors */}
                    <div className="flex-1 flex flex-wrap lg:flex-nowrap gap-3 items-center">
                        <select
                            value={filters.status}
                            onChange={e => updateFilter({ status: e.target.value as GroupStatus | "all" })}
                            className="bg-slate-950/80 border border-slate-700/60 rounded-xl px-3 py-3 text-sm font-medium focus:outline-none focus:border-indigo-500"
                        >
                            <option value="all">All Timings</option>
                            <option value="active">🔴 Live Now</option>
                            <option value="scheduled">📅 Scheduled for later</option>
                        </select>

                        <div className="flex bg-slate-950/80 border border-slate-700/60 p-1 rounded-xl">
                            <button
                                onClick={() => updateFilter({ hideFull: !filters.hideFull })}
                                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${filters.hideFull ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-800'}`}
                            >
                                Hide Full Rooms
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Feed */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-24">
                <div className="flex items-center justify-between mb-6">
                    <p className="text-sm font-medium text-slate-400">Discovering <span className="text-white font-bold">{groups.length}</span> active hubs</p>
                </div>

                {groups.length === 0 ? (
                    <div className="mt-8 text-center p-16 bg-slate-900/30 border border-slate-800/80 rounded-3xl border-dashed">
                        <Users className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-white mb-2">No active groups</h3>
                        <p className="text-slate-400 text-sm">Be the first to host a study session for your course!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {groups.map(group => {
                            const isFull = group.members.length >= group.capacity || group.status === "full";
                            return (
                                <div
                                    key={group.id}
                                    className={`group border rounded-3xl p-6 transition-all cursor-pointer relative overflow-hidden
                       ${group.status === 'active' ? 'bg-slate-900/60 border-indigo-500/30 hover:border-indigo-500' : 'bg-slate-900/40 border-slate-800 hover:border-slate-600'}
                     `}
                                    onClick={() => setSelectedGroup(group)}
                                >

                                    <div className="flex items-start justify-between mb-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border flex items-center gap-1.5 ${statusColors[group.status]}`}>
                                            {group.status === "active" && <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
                                            {group.status}
                                        </span>

                                        <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 px-2.5 py-1 rounded-full">
                                            <Users className={`w-3.5 h-3.5 ${isFull ? 'text-rose-400' : 'text-indigo-400'}`} />
                                            <span className="text-xs font-black text-slate-300">{group.members.length} <span className="text-slate-600">/ {group.capacity}</span></span>
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-black text-white leading-tight mb-2 group-hover:text-indigo-300 transition-colors">{group.title}</h3>
                                    <p className="text-sm font-medium text-slate-400 mb-6 flex items-center gap-2"><BookOpen className="w-4 h-4" />{group.courseCode} · {group.topic}</p>

                                    <div className="space-y-2 mb-6 border-l-2 border-slate-800 pl-4 py-1">
                                        <div className="flex items-center gap-2 text-sm text-slate-300 font-medium">
                                            <MapPin className="w-4 h-4 text-emerald-400" />
                                            {group.location} <span className="text-slate-500">• {group.roomNumber}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-slate-300 font-medium">
                                            {group.status === 'active' ? <Clock className="w-4 h-4 text-rose-400" /> : <Calendar className="w-4 h-4 text-indigo-400" />}
                                            {new Date(group.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(group.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 pt-5 border-t border-slate-800">
                                        <div className="flex -space-x-2 mr-3">
                                            {group.members.slice(0, 3).map((m, i) => (
                                                <img key={m.id} src={m.avatar} alt="member" className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800" style={{ zIndex: 10 - i }} />
                                            ))}
                                            {group.members.length > 3 && (
                                                <div className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400" style={{ zIndex: 0 }}>
                                                    +{group.members.length - 3}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-xs font-medium text-slate-500">Hosted by {group.members.find(m => m.isHost)?.name || group.members[0].name}</span>
                                    </div>

                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {selectedGroup && (
                <JoinGroupModal
                    group={selectedGroup}
                    onClose={() => setSelectedGroup(null)}
                    onSuccess={handleSuccess}
                />
            )}
        </div>
    )
}
