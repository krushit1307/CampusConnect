import React, { useState } from 'react';
import { Award, Briefcase, Calendar, Clock, DollarSign, Users, PlusCircle, Search, Filter, Sparkles, ShieldCheck, CheckCircle2, UserPlus, Activity, Flame, ShieldAlert, BookOpen } from 'lucide-react';
import MentorProfileCard, { AlumniMentor } from '../../components/alumni/MentorProfileCard';
import AlumniActivityTimeline from '../../components/alumni/AlumniActivityTimeline';

const INITIAL_MENTORS: AlumniMentor[] = [
  {
    id: 'mntr-101',
    mentorName: 'Sophia Lin',
    jobTitle: 'Senior Staff Software Engineer',
    companyName: 'Google (Cloud AI Platform)',
    alumniGradYear: 'Class of 2019 (B.S. CS)',
    mentorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    expertiseDomain: 'Software & AI Systems',
    availableSlotsPerWeek: 3,
    hourlyRateUSD: 0,
    verificationStatus: 'Alumni Network Verified',
    bio: 'Former ACM President at CampusConnect. Passionate about helping undergrads prep for Big Tech coding interviews, system design, and AI research roles.',
    isBooked: false,
    ratingScore: 4.95,
  },
  {
    id: 'mntr-102',
    mentorName: 'Marcus Vance',
    jobTitle: 'Investment Banking Associate',
    companyName: 'Goldman Sachs (Tech M&A)',
    alumniGradYear: 'Class of 2021 (B.S. Finance)',
    mentorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    expertiseDomain: 'Finance & Consulting',
    availableSlotsPerWeek: 2,
    hourlyRateUSD: 0,
    verificationStatus: 'Alumni Network Verified',
    bio: 'Specializing in financial modeling, investment banking case interviews, and career pivots into Wall Street analyst programs.',
    isBooked: true,
    ratingScore: 4.90,
  },
  {
    id: 'mntr-103',
    mentorName: 'Elena Rostova',
    jobTitle: 'Lead Product Manager',
    companyName: 'Stripe (Global Payments)',
    alumniGradYear: 'Class of 2020 (B.A. Economics & CS)',
    mentorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    expertiseDomain: 'Product & Design',
    availableSlotsPerWeek: 4,
    hourlyRateUSD: 0,
    verificationStatus: 'Alumni Network Verified',
    bio: 'Helping students break into Product Management via APM programs, resume reviews, and mock PM product design interviews.',
    isBooked: false,
    ratingScore: 4.98,
  },
];

export default function CampusAlumniMentorshipPage() {
  const [mentors, setMentors] = useState<AlumniMentor[]>(INITIAL_MENTORS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('All');
  const [activeTab, setActiveTab] = useState<'mentors' | 'activity' | 'my-sessions'>('mentors');
  const [selectedMentorModal, setSelectedMentorModal] = useState<AlumniMentor | null>(null);

  const domains = ['All', 'Software & AI Systems', 'Finance & Consulting', 'Product & Design'];

  const toggleBookSlot = (id: string) => {
    setMentors(prev =>
      prev.map(mntr => {
        if (mntr.id === id) {
          const nextBooked = !mntr.isBooked;
          return {
            ...mntr,
            isBooked: nextBooked,
            availableSlotsPerWeek: nextBooked ? mntr.availableSlotsPerWeek - 1 : mntr.availableSlotsPerWeek + 1,
          };
        }
        return mntr;
      })
    );
  };

  const filteredMentors = mentors.filter(mntr => {
    const matchesSearch = mntr.mentorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          mntr.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          mntr.jobTitle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDomain = selectedDomain === 'All' || mntr.expertiseDomain === selectedDomain;
    const matchesTab = activeTab !== 'my-sessions' || mntr.isBooked;

    return matchesSearch && matchesDomain && matchesTab;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header Banner */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-900 border border-blue-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-blue-500/20 text-blue-300 text-xs px-3 py-1 rounded-full font-semibold border border-blue-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> CampusConnect Alumni Circle
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> 100% Verified Graduate Network
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-blue-200 bg-clip-text text-transparent">
              Alumni Mentorship & Career Guidance Hub
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Connect 1-on-1 with verified campus alumni working at top tech, finance, and product firms for free 1-on-1 mock interviews and career advice.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-blue-600/30 transition flex items-center gap-2 border border-blue-400/20 text-sm">
              <UserPlus className="w-4 h-4" /> Become an Alumni Mentor
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
              onClick={() => setActiveTab('mentors')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'mentors'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Users className="w-4 h-4" /> Alumni Mentors
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'activity'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-4 h-4" /> Mentorship Stream
            </button>
            <button
              onClick={() => setActiveTab('my-sessions')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'my-sessions'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" /> Booked 1-on-1 Sessions ({mentors.filter(m => m.isBooked).length})
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search mentor or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Tab Body */}
        {activeTab === 'activity' ? (
          <AlumniActivityTimeline />
        ) : (
          <>
            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-2">Domain:</span>
              {domains.map((dom) => (
                <button
                  key={dom}
                  onClick={() => setSelectedDomain(dom)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                    selectedDomain === dom
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                      : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {dom}
                </button>
              ))}
            </div>

            {/* Mentor Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredMentors.map((mntr) => (
                <MentorProfileCard
                  key={mntr.id}
                  mentor={mntr}
                  onBook={() => toggleBookSlot(mntr.id)}
                  onInspect={() => setSelectedMentorModal(mntr)}
                />
              ))}
            </div>

            {filteredMentors.length === 0 && (
              <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800/60">
                <ShieldAlert className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-300">No alumni mentors match criteria</h3>
                <p className="text-slate-500 text-sm mt-1">Try updating your filters or search keywords.</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal View */}
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
                src={selectedMentorModal.mentorAvatar}
                alt={selectedMentorModal.mentorName}
                className="w-14 h-14 rounded-full border-2 border-blue-500/40 object-cover"
              />
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  {selectedMentorModal.mentorName}
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-mono font-semibold border border-blue-500/30">
                    {selectedMentorModal.alumniGradYear}
                  </span>
                </h3>
                <p className="text-slate-400 text-xs">{selectedMentorModal.jobTitle} @ {selectedMentorModal.companyName}</p>
              </div>
            </div>

            <p className="text-slate-300 text-xs leading-relaxed mb-4">{selectedMentorModal.bio}</p>

            <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-300">
                <span>Domain Focus:</span>
                <span className="text-blue-400 font-bold">{selectedMentorModal.expertiseDomain}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Available Weekly Slots:</span>
                <span className="text-emerald-400 font-bold">{selectedMentorModal.availableSlotsPerWeek} Slots Open</span>
              </div>
              <div className="flex items-center justify-between text-slate-300 pt-2 border-t border-slate-900">
                <span>Mentorship Cost:</span>
                <span className="text-white font-bold">100% FREE (Campus Alumni Service)</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedMentorModal(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  toggleBookSlot(selectedMentorModal.id);
                  setSelectedMentorModal(null);
                }}
                className={`px-5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                  selectedMentorModal.isBooked
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'
                }`}
              >
                <Calendar className="w-4 h-4" />
                {selectedMentorModal.isBooked ? 'Cancel 1-on-1 Session' : 'Book 1-on-1 Mentorship'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
