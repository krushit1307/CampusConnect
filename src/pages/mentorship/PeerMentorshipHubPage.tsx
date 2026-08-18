import React, { useState } from 'react';
import { Users, Search, Filter, Award, Calendar, Clock, MessageSquare, Star, CheckCircle, Sparkles, BookOpen, ShieldCheck, UserPlus, Send, Activity, ChevronRight } from 'lucide-react';
import MentorCard, { MentorProfile } from '../../components/mentorship/MentorCard';
import MentorshipActivityTimeline from '../../components/mentorship/MentorshipActivityTimeline';

const SAMPLE_MENTORS: MentorProfile[] = [
  {
    id: 'mnt-201',
    name: 'Dr. Sophia Lin',
    title: 'Senior AI Research Scientist & Alumna',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    department: 'Computer Science',
    expertise: ['Machine Learning', 'PhD Applications', 'Natural Language Processing', 'Career Pathing'],
    rating: 4.95,
    reviewsCount: 64,
    sessionsCompleted: 142,
    hourlyRate: 'Free for Students',
    availabilityStatus: 'Available Today',
    bio: 'Former Google DeepMind intern and current AI research faculty. Passionate about helping undergrads break into AI research and top-tier graduate programs.',
    isBookmarked: true,
  },
  {
    id: 'mnt-202',
    name: 'Julian Thorne',
    title: 'Quant Systems Developer @ Citadel',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    department: 'Mathematics & CS',
    expertise: ['Quantitative Finance', 'Low-Latency C++', 'Algorithm Design', 'Technical Interviews'],
    rating: 4.88,
    reviewsCount: 42,
    sessionsCompleted: 89,
    hourlyRate: 'Free for Students',
    availabilityStatus: 'Available This Weekend',
    bio: 'Alumnus class of 2024. Providing mock algorithmic interviews, resume teardowns, and guidance for math/CS students targeting quantitative trading roles.',
    isBookmarked: false,
  },
  {
    id: 'mnt-203',
    name: 'Aisha Patel',
    title: 'Biomedical Innovation Fellow',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
    department: 'Bioengineering',
    expertise: ['Medical Tech', 'Grant Writing', 'Lab Techniques', 'MCAT Prep'],
    rating: 4.92,
    reviewsCount: 38,
    sessionsCompleted: 74,
    hourlyRate: 'Free for Students',
    availabilityStatus: 'Available Today',
    bio: 'Specializing in pre-med track navigation, lab placement strategies, and undergraduate research scholarship proposals.',
    isBookmarked: false,
  },
  {
    id: 'mnt-204',
    name: 'Marcus Brody',
    title: 'Product Design Lead @ Figma',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    department: 'Design & Human-Computer Interaction',
    expertise: ['UI/UX Systems', 'Portfolio Reviews', 'Product Strategy', 'Figma Mastery'],
    rating: 5.0,
    reviewsCount: 91,
    sessionsCompleted: 180,
    hourlyRate: 'Free for Students',
    availabilityStatus: 'Available Tomorrow',
    bio: 'Helping design and HCI students craft industry-ready portfolios, master design systems, and prepare for high-impact UX internships.',
    isBookmarked: true,
  },
];

export default function PeerMentorshipHubPage() {
  const [mentors, setMentors] = useState<MentorProfile[]>(SAMPLE_MENTORS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [activeTab, setActiveTab] = useState<'find' | 'activity' | 'my-sessions'>('find');
  const [selectedMentorModal, setSelectedMentorModal] = useState<MentorProfile | null>(null);

  const departments = ['All', 'Computer Science', 'Mathematics & CS', 'Bioengineering', 'Design & Human-Computer Interaction'];

  const toggleBookmark = (mentorId: string) => {
    setMentors(prev =>
      prev.map(m => m.id === mentorId ? { ...m, isBookmarked: !m.isBookmarked } : m)
    );
  };

  const filteredMentors = mentors.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          m.expertise.some(e => e.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesDept = selectedDept === 'All' || m.department === selectedDept;
    const matchesTab = activeTab !== 'my-sessions' || m.isBookmarked;

    return matchesSearch && matchesDept && matchesTab;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header Banner */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-emerald-900/60 via-teal-900/40 to-slate-900 border border-emerald-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full font-semibold border border-emerald-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Peer-to-Peer Growth Network
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-400" /> 100% Peer Verified Alumni & Faculty
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-emerald-200 bg-clip-text text-transparent">
              Campus Mentorship & Career Accelerator
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Connect 1-on-1 with senior students, distinguished alumni, and research faculty for career advice, technical interview practice, and academic guidance.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 border border-emerald-400/20 text-sm">
              <UserPlus className="w-4 h-4" /> Become a Mentor
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Tabs */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('find')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'find'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Users className="w-4 h-4" /> Find Mentors
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'activity'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-4 h-4" /> Live Mentorship Activity
            </button>
            <button
              onClick={() => setActiveTab('my-sessions')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'my-sessions'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Calendar className="w-4 h-4" /> Saved Advisors ({mentors.filter(m => m.isBookmarked).length})
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search skill, company, or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Tab Body */}
        {activeTab === 'activity' ? (
          <MentorshipActivityTimeline />
        ) : (
          <>
            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-2">Department:</span>
              {departments.map((dept) => (
                <button
                  key={dept}
                  onClick={() => setSelectedDept(dept)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                    selectedDept === dept
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>

            {/* Mentor Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredMentors.map((mentor) => (
                <MentorCard
                  key={mentor.id}
                  mentor={mentor}
                  onBookmark={() => toggleBookmark(mentor.id)}
                  onBookSession={() => setSelectedMentorModal(mentor)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Booking Modal */}
      {selectedMentorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedMentorModal(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold"
            >
              ×
            </button>

            <div className="flex items-center gap-4 mb-4">
              <img
                src={selectedMentorModal.avatar}
                alt={selectedMentorModal.name}
                className="w-14 h-14 rounded-full border-2 border-emerald-500/40 object-cover"
              />
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-1.5">
                  {selectedMentorModal.name}
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                </h3>
                <p className="text-slate-400 text-xs">{selectedMentorModal.title}</p>
              </div>
            </div>

            <p className="text-slate-300 text-xs leading-relaxed mb-4 bg-slate-950 p-3 rounded-xl border border-slate-800">
              {selectedMentorModal.bio}
            </p>

            <div className="space-y-3 mb-6">
              <label className="block text-xs font-semibold text-slate-300">Select Session Type</label>
              <select className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500">
                <option>1-on-1 Career Strategy & Resume Review (30 mins)</option>
                <option>Mock Technical / Coding Interview (45 mins)</option>
                <option>Graduate School & Research Fellowship Guidance (30 mins)</option>
              </select>

              <label className="block text-xs font-semibold text-slate-300">Note for Mentor</label>
              <textarea
                rows={3}
                placeholder="Briefly state your main goals for this meeting..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedMentorModal(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={() => setSelectedMentorModal(null)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-medium transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
              >
                <Send className="w-3.5 h-3.5" /> Request Session Slot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
