import React, { useState } from 'react';
import { Users, Search, Filter, PlusCircle, BookOpen, Clock, MapPin, Sparkles, MessageCircle, UserPlus, CheckCircle, ShieldAlert, Activity, Award, Flame } from 'lucide-react';
import StudyGroupCard, { StudyGroup } from '../../components/study/StudyGroupCard';
import StudyGroupActivityTimeline from '../../components/study/StudyGroupActivityTimeline';

const INITIAL_GROUPS: StudyGroup[] = [
  {
    id: 'grp-401',
    courseCode: 'CS301',
    courseTitle: 'Data Structures & Algorithmic Problem Solving',
    groupName: 'Graph Theory & Dynamic Programming Sprint',
    organizerName: 'Elena Rostova',
    organizerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    memberCount: 7,
    maxCapacity: 10,
    meetingTime: 'Tuesdays & Thursdays @ 5:00 PM',
    location: 'Engineering Library, Room 402',
    tags: ['LeetCode', 'Recursion', 'Exam Prep', 'CS301'],
    description: 'Weekly collaborative problem-solving circle focusing on complex DP state transitions, graph traversal optimization, and upcoming midterm review.',
    isJoined: true,
    difficultyLevel: 'Intermediate',
  },
  {
    id: 'grp-402',
    courseCode: 'PHYS402',
    courseTitle: 'Quantum Physics II & Field Theory',
    groupName: 'Schrödinger Equation Proof Working Circle',
    organizerName: 'Marcus Vance',
    organizerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    memberCount: 4,
    maxCapacity: 6,
    meetingTime: 'Mondays @ 6:30 PM',
    location: 'Physics Building, Seminar Room B',
    tags: ['Bra-Ket Notation', 'Perturbation Theory', 'Physics'],
    description: 'Deep dive into weekly problem sets, working through rigorous mathematical proofs and wave function normalization exercises together.',
    isJoined: false,
    difficultyLevel: 'Advanced',
  },
  {
    id: 'grp-403',
    courseCode: 'MATH220',
    courseTitle: 'Linear Algebra & Matrix Computation',
    groupName: 'Eigenvalues & Vector Space Study Lab',
    organizerName: 'David Chen',
    organizerAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    memberCount: 8,
    maxCapacity: 8,
    meetingTime: 'Wednesdays @ 4:00 PM',
    location: 'Math Learning Center - Table 3',
    tags: ['Eigenvectors', 'Matrix Algebra', 'Midterm Prep'],
    description: 'Interactive study group focusing on visual intuitive geometric interpretations of matrix transformations, diagonalizations, and SVD decomposition.',
    isJoined: true,
    difficultyLevel: 'Beginner',
  },
  {
    id: 'grp-404',
    courseCode: 'CHEM210',
    courseTitle: 'Organic Chemistry Laboratory',
    groupName: 'NMR Spectroscopy & Synthesis Group',
    organizerName: 'Sarah Jenkins',
    organizerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    memberCount: 5,
    maxCapacity: 8,
    meetingTime: 'Fridays @ 2:00 PM',
    location: 'Chemistry Annex Lounge',
    tags: ['NMR', 'Lab Reports', 'Organic Synthesis'],
    description: 'Post-lab data analysis squad comparing spectral readouts, troubleshooting reaction yields, and reviewing lab report conclusions.',
    isJoined: false,
    difficultyLevel: 'Intermediate',
  },
];

export default function CampusStudyGroupsPage() {
  const [groups, setGroups] = useState<StudyGroup[]>(INITIAL_GROUPS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [activeTab, setActiveTab] = useState<'find' | 'activity' | 'my-groups'>('find');
  const [selectedGroupModal, setSelectedGroupModal] = useState<StudyGroup | null>(null);

  const difficultyLevels = ['All', 'Beginner', 'Intermediate', 'Advanced'];

  const toggleJoin = (groupId: string) => {
    setGroups(prev =>
      prev.map(grp => {
        if (grp.id === groupId) {
          const nextJoined = !grp.isJoined;
          return {
            ...grp,
            isJoined: nextJoined,
            memberCount: nextJoined ? grp.memberCount + 1 : grp.memberCount - 1,
          };
        }
        return grp;
      })
    );
  };

  const filteredGroups = groups.filter(grp => {
    const matchesSearch = grp.groupName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          grp.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          grp.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesDiff = selectedDifficulty === 'All' || grp.difficultyLevel === selectedDifficulty;
    const matchesTab = activeTab !== 'my-groups' || grp.isJoined;

    return matchesSearch && matchesDiff && matchesTab;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header Banner */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-blue-900/60 via-cyan-900/40 to-slate-900 border border-cyan-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-cyan-500/20 text-cyan-300 text-xs px-3 py-1 rounded-full font-semibold border border-cyan-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> CampusConnect Collaborative Learning
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-400" /> 350+ Active Study Circles
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-200 bg-clip-text text-transparent">
              Collaborative Study Group Hub
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Form or join peer study circles by course code, schedule weekly problem-solving sessions, and prepare for upcoming exams together.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-cyan-600/30 transition flex items-center gap-2 border border-cyan-400/20 text-sm">
              <PlusCircle className="w-4 h-4" /> Create Study Group
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('find')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'find'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Users className="w-4 h-4" /> Discover Groups
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'activity'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-4 h-4" /> Group Activity Stream
            </button>
            <button
              onClick={() => setActiveTab('my-groups')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'my-groups'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <BookOpen className="w-4 h-4" /> My Enrolled Circles ({groups.filter(g => g.isJoined).length})
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search course code or topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-cyan-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Tab Body */}
        {activeTab === 'activity' ? (
          <StudyGroupActivityTimeline />
        ) : (
          <>
            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-2">Difficulty Level:</span>
              {difficultyLevels.map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setSelectedDifficulty(lvl)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                    selectedDifficulty === lvl
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            {/* Study Group Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredGroups.map((grp) => (
                <StudyGroupCard
                  key={grp.id}
                  group={grp}
                  onJoin={() => toggleJoin(grp.id)}
                  onInspect={() => setSelectedGroupModal(grp)}
                />
              ))}
            </div>

            {filteredGroups.length === 0 && (
              <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800/60">
                <ShieldAlert className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-300">No study groups match criteria</h3>
                <p className="text-slate-500 text-sm mt-1">Try updating your filters or search keywords.</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal View Component */}
      {selectedGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedGroupModal(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold"
            >
              ×
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="bg-cyan-500/20 text-cyan-400 text-xs px-2.5 py-0.5 rounded font-mono font-semibold border border-cyan-500/30">
                {selectedGroupModal.courseCode}
              </span>
              <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded font-semibold">
                {selectedGroupModal.difficultyLevel}
              </span>
            </div>

            <h2 className="text-xl font-bold text-white mb-2">{selectedGroupModal.groupName}</h2>
            <p className="text-slate-400 text-xs leading-relaxed mb-4">{selectedGroupModal.description}</p>

            <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>{selectedGroupModal.meetingTime}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <MapPin className="w-4 h-4 text-rose-400" />
                <span>{selectedGroupModal.location}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>{selectedGroupModal.memberCount} of {selectedGroupModal.maxCapacity} Members Active</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedGroupModal(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  toggleJoin(selectedGroupModal.id);
                  setSelectedGroupModal(null);
                }}
                className={`px-5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                  selectedGroupModal.isJoined
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/30'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                {selectedGroupModal.isJoined ? 'Leave Study Circle' : 'Join Study Circle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
