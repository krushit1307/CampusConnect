import React, { useState } from 'react';
import { Users, Search, BookOpen, Sparkles, PlusCircle, LayoutGrid, Layers } from 'lucide-react';
import {
    MOCK_PEER_PROFILES,
    MOCK_PROJECT_ROOMS,
    StudentPeerProfile,
    CollaborativeProjectRoom
} from '../../services/studyGroupEngine';
import { StudentPeerMatchCardTile } from '../../components/study/StudentPeerMatchCardTile';
import { CollaborativeProjectRoomCardTile } from '../../components/study/CollaborativeProjectRoomCardTile';

export const StudyGroupMatcherPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'peers' | 'rooms'>('peers');
    const [peers] = useState<StudentPeerProfile[]>(MOCK_PEER_PROFILES);
    const [rooms] = useState<CollaborativeProjectRoom[]>(MOCK_PROJECT_ROOMS);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [courseFilter, setCourseFilter] = useState<string>('All');
    const [invitedPeerIds, setInvitedPeerIds] = useState<string[]>([]);

    const filteredPeers = peers.filter(p => {
        const matchesSearch = p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.major.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCourse = courseFilter === 'All' || p.enrolledCourses.some(c => c.includes(courseFilter));
        return matchesSearch && matchesCourse;
    });

    const filteredRooms = rooms.filter(r => {
        const matchesSearch = r.roomName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.courseCode.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCourse = courseFilter === 'All' || r.courseCode === courseFilter;
        return matchesSearch && matchesCourse;
    });

    const handleInvitePeer = (peer: StudentPeerProfile) => {
        setInvitedPeerIds(prev =>
            prev.includes(peer.id) ? prev.filter(id => id !== peer.id) : [...prev, peer.id]
        );
    };

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6 text-slate-100 font-sans p-4 sm:p-6">
            {/* Header Hub Banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                            <Sparkles className="w-4 h-4 text-amber-400" /> Academic Peer Network
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-100 mt-1">
                            Study Group Matcher & Project Rooms
                        </h1>
                        <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                            Find compatible classmates by enrolled courses, study habits, and schedule availability. Collaborate in real-time project rooms with live milestone checklists and shared whiteboards.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                        >
                            <PlusCircle className="w-4 h-4" /> Create Study Room
                        </button>
                    </div>
                </div>

                {/* Tab Switcher & Filters */}
                <div className="flex flex-col md:flex-row gap-4 justify-between">
                    {/* View Tabs */}
                    <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 self-start">
                        <button
                            type="button"
                            onClick={() => setActiveTab('peers')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                                activeTab === 'peers'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <Users className="w-4 h-4" /> Compatible Peer Matches ({filteredPeers.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('rooms')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                                activeTab === 'rooms'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <Layers className="w-4 h-4" /> Active Project Rooms ({filteredRooms.length})
                        </button>
                    </div>

                    {/* Search & Course Filters */}
                    <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-xl">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by student name, major, or course code..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <select
                            value={courseFilter}
                            onChange={(e) => setCourseFilter(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-indigo-500"
                        >
                            <option value="All">All Courses</option>
                            <option value="CS301">CS301 Algorithms</option>
                            <option value="CS350">CS350 OS</option>
                            <option value="MATH240">MATH240 Linear Alg</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Content View Grid */}
            {activeTab === 'peers' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {filteredPeers.map(peer => (
                        <StudentPeerMatchCardTile
                            key={peer.id}
                            peer={peer}
                            isInvited={invitedPeerIds.includes(peer.id)}
                            onInviteToGroup={handleInvitePeer}
                        />
                    ))}
                </div>
            ) : (
                <div className="space-y-6">
                    {filteredRooms.map(room => (
                        <CollaborativeProjectRoomCardTile key={room.id} room={room} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default StudyGroupMatcherPage;
