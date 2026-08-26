import React, { useState } from 'react';
import { Users, CheckSquare, Plus, FileText, Send, Calendar, CheckCircle2 } from 'lucide-react';
import { CollaborativeProjectRoom } from '../../services/studyGroupEngine';

interface ProjectRoomProps {
    room: CollaborativeProjectRoom;
}

export const CollaborativeProjectRoomCardTile: React.FC<ProjectRoomProps> = ({ room }) => {
    const [milestones, setMilestones] = useState(room.milestones);
    const [notes, setNotes] = useState<string[]>(room.sharedNotes);
    const [newNote, setNewNote] = useState<string>('');
    const [newMilestoneTitle, setNewMilestoneTitle] = useState<string>('');

    const toggleMilestone = (id: string) => {
        setMilestones(prev =>
            prev.map(m => m.id === id ? { ...m, completed: !m.completed } : m)
        );
    };

    const handleAddNote = () => {
        if (!newNote.trim()) return;
        setNotes(prev => [...prev, newNote.trim()]);
        setNewNote('');
    };

    const handleAddMilestone = () => {
        if (!newMilestoneTitle.trim()) return;
        const newM = {
            id: `m_${Date.now()}`,
            title: newMilestoneTitle.trim(),
            completed: false,
            assignedTo: "Unassigned"
        };
        setMilestones(prev => [...prev, newM]);
        setNewMilestoneTitle('');
    };

    const completedCount = milestones.filter(m => m.completed).length;
    const progressPercent = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

    return (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-5 shadow-2xl">
            {/* Header Title & Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] font-mono font-bold">
                            {room.courseCode}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-emerald-400" /> Deadline: {room.targetDeadline}
                        </span>
                    </div>
                    <h3 className="text-lg font-black text-slate-100 mt-1">{room.roomName}</h3>
                </div>

                <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-2 rounded-2xl border border-slate-800 self-start sm:self-auto">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-mono font-bold text-slate-200">
                        {room.memberCount} / {room.maxCapacity} Members
                    </span>
                </div>
            </div>

            {/* Active Topic Banner */}
            <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800/80 space-y-1">
                <span className="text-[10px] text-indigo-400 uppercase font-mono font-bold block">Current Focus Topic</span>
                <p className="text-xs font-semibold text-slate-200">{room.activeTopic}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Milestones & Progress Track Column */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                            <CheckSquare className="w-4 h-4 text-emerald-400" /> Project Milestones ({completedCount}/{milestones.length})
                        </div>
                        <span className="text-xs font-mono font-bold text-emerald-400">{progressPercent}%</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div
                            className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>

                    {/* Milestones List */}
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {milestones.map(m => (
                            <div
                                key={m.id}
                                onClick={() => toggleMilestone(m.id)}
                                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-2 text-xs ${
                                    m.completed
                                        ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-400'
                                        : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700'
                                }`}
                            >
                                <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${m.completed ? 'text-emerald-400' : 'text-slate-600'}`} />
                                <div className="flex-1 min-w-0">
                                    <p className={`font-semibold ${m.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                                        {m.title}
                                    </p>
                                    <span className="text-[9px] text-slate-500 font-mono block mt-0.5">
                                        Assigned: {m.assignedTo}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Add Milestone Input */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newMilestoneTitle}
                            onChange={(e) => setNewMilestoneTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddMilestone()}
                            placeholder="Add milestone task..."
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                        />
                        <button
                            type="button"
                            onClick={handleAddMilestone}
                            className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Shared Study Notes & Whiteboard Column */}
                <div className="space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                        <FileText className="w-4 h-4 text-indigo-400" /> Shared Group Whiteboard Notes
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {notes.map((note, idx) => (
                            <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-300 leading-relaxed font-sans">
                                {note}
                            </div>
                        ))}
                    </div>

                    {/* Add Note Input */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                            placeholder="Type shared key formula or note..."
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                            type="button"
                            onClick={handleAddNote}
                            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
