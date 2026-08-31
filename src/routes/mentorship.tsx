import React, { useState } from 'react';
import { SiteShell } from '@/components/site/SiteShell';
import { MentorBookingModal } from '@/components/mentorship/MentorBookingModal';
import { QuestTreeView } from '@/components/mentorship/QuestTreeView';
import { VerifiableBadgeCard } from '@/components/mentorship/VerifiableBadgeCard';
import {
  MentorProfile,
  CampusQuest,
  VerifiableSkillBadge,
} from '@/types/mentorship';
import {
  Users,
  Compass,
  Award,
  Star,
  Calendar,
  Sparkles,
  Search,
  Filter,
  Flame,
  CheckCircle,
} from 'lucide-react';

export default function MentorshipPage() {
  const [activeTab, setActiveTab] = useState<'mentors' | 'quests' | 'badges'>('mentors');
  const [selectedMentor, setSelectedMentor] = useState<MentorProfile | null>(null);
  const [searchMentor, setSearchMentor] = useState('');

  const [mentors, setMentors] = useState<MentorProfile[]>([
    {
      id: 'm-1',
      name: 'Alex Rivera',
      roleTitle: 'Incoming SWE @ Google • Ex-Meta Intern',
      major: 'B.S. Computer Science 2026',
      bio: 'Happy to help with LeetCode prep, system design fundamentals, and behavioral interview stories for top tech companies.',
      expertiseAreas: ['System Design', 'Algorithms', 'Resume Review'],
      rating: 4.9,
      totalSessionsCompleted: 28,
      hourlyMeritCost: 0,
      availableSlots: [
        { id: 's1', dayOfWeek: 'Tuesday', startTime: '15:00', endTime: '15:45', isBooked: false },
        { id: 's2', dayOfWeek: 'Thursday', startTime: '17:00', endTime: '17:45', isBooked: false },
      ],
    },
    {
      id: 'm-2',
      name: 'Samantha Wu',
      roleTitle: 'Undergrad Research Lead • Published at NeurIPS',
      major: 'B.S. Data Science & AI',
      bio: 'Guiding students interested in AI research, writing their first academic paper, and finding faculty research advisors.',
      expertiseAreas: ['Machine Learning', 'Research Proposals', 'Grad School Prep'],
      rating: 5.0,
      totalSessionsCompleted: 19,
      hourlyMeritCost: 15,
      availableSlots: [
        { id: 's3', dayOfWeek: 'Wednesday', startTime: '14:00', endTime: '14:45', isBooked: false },
        { id: 's4', dayOfWeek: 'Friday', startTime: '11:00', endTime: '11:45', isBooked: false },
      ],
    },
    {
      id: 'm-3',
      name: 'Jordan Blake',
      roleTitle: 'Product Manager Intern @ Spotify • Former SGA President',
      major: 'B.A. Economics & Information Systems',
      bio: 'Specializing in product strategy, student leadership case studies, and breaking into tech product roles.',
      expertiseAreas: ['Product Management', 'Leadership', 'Networking'],
      rating: 4.8,
      totalSessionsCompleted: 34,
      hourlyMeritCost: 0,
      availableSlots: [
        { id: 's5', dayOfWeek: 'Monday', startTime: '18:00', endTime: '18:45', isBooked: false },
      ],
    },
  ]);

  const [quests, setQuests] = useState<CampusQuest[]>([
    {
      id: 'q-1',
      title: 'First Step on Campus',
      category: 'academic',
      tier: 1,
      description: 'Join your first club workspace and introduce yourself.',
      rewardXp: 50,
      rewardBadgeName: 'Campus Pioneer',
      currentProgress: 1,
      targetGoal: 1,
      status: 'completed',
      prerequisiteQuestIds: [],
    },
    {
      id: 'q-2',
      title: 'Workshop Explorer',
      category: 'academic',
      tier: 1,
      description: 'Attend and check in to 3 registered student club workshops.',
      rewardXp: 100,
      rewardBadgeName: 'Workshop Veteran',
      currentProgress: 2,
      targetGoal: 3,
      status: 'in_progress',
      prerequisiteQuestIds: ['q-1'],
    },
    {
      id: 'q-3',
      title: 'Technical Mentorship Milestone',
      category: 'career',
      tier: 2,
      description: 'Book and complete a 1-on-1 resume review or mock interview with a senior mentor.',
      rewardXp: 150,
      rewardBadgeName: 'Career Ready',
      currentProgress: 0,
      targetGoal: 1,
      status: 'in_progress',
      prerequisiteQuestIds: ['q-2'],
    },
    {
      id: 'q-4',
      title: 'Open Source Contributor',
      category: 'academic',
      tier: 3,
      description: 'Submit an approved pull request to a university student-run project.',
      rewardXp: 300,
      rewardBadgeName: 'Campus Hacker',
      currentProgress: 1,
      targetGoal: 1,
      status: 'completed',
      prerequisiteQuestIds: ['q-3'],
    },
    {
      id: 'q-5',
      title: 'Master Mentor Elite',
      category: 'leadership',
      tier: 4,
      description: 'Host 5 office hours sessions as an approved mentor with 4.5+ star ratings.',
      rewardXp: 500,
      rewardBadgeName: 'Distinguished Fellow',
      currentProgress: 0,
      targetGoal: 5,
      status: 'locked',
      prerequisiteQuestIds: ['q-4'],
    },
  ]);

  const [badges] = useState<VerifiableSkillBadge[]>([
    {
      id: 'b-1',
      title: 'Campus Pioneer 2026',
      issuer: 'CampusConnect Governance',
      category: 'Community',
      issuedAt: '2026-08-20',
      signatureHash: '0x88f29910cbe44910a',
      iconName: 'Award',
      xpValue: 50,
    },
    {
      id: 'b-2',
      title: 'Campus Hacker (Open Source)',
      issuer: 'CS Student Association',
      category: 'Technical',
      issuedAt: '2026-08-26',
      signatureHash: '0x11a00938bfe9910dd',
      iconName: 'Award',
      xpValue: 300,
    },
  ]);

  const handleBooking = (mentorId: string, slotId: string, notes: string) => {
    setMentors((prev) =>
      prev.map((m) => {
        if (m.id === mentorId) {
          return {
            ...m,
            availableSlots: m.availableSlots.map((s) =>
              s.id === slotId ? { ...s, isBooked: true } : s
            ),
          };
        }
        return m;
      })
    );
  };

  const filteredMentors = mentors.filter(
    (m) =>
      m.name.toLowerCase().includes(searchMentor.toLowerCase()) ||
      m.expertiseAreas.some((e) => e.toLowerCase().includes(searchMentor.toLowerCase()))
  );

  return (
    <SiteShell>
      <div className="min-h-screen bg-[#faf8f5] py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Banner */}
          <div className="flex flex-wrap items-center justify-between gap-6 border-b-4 border-black pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-lime border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <Compass size={24} />
                </span>
                <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight text-black">
                  Student Mentorship & Quest Network
                </h1>
              </div>
              <p className="font-mono text-sm text-gray-600 mt-1">
                Book 1-on-1 office hours with verified alumni & complete campus quests for digital merit badges.
              </p>
            </div>

            {/* Navigation Tabs */}
            <div className="neu-border bg-white p-1.5 flex items-center gap-2">
              <button
                onClick={() => setActiveTab('mentors')}
                className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                  activeTab === 'mentors'
                    ? 'bg-lime text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                <Users size={16} /> Mentors ({mentors.length})
              </button>
              <button
                onClick={() => setActiveTab('quests')}
                className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                  activeTab === 'quests'
                    ? 'bg-lime text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                <Compass size={16} /> Campus Quests
              </button>
              <button
                onClick={() => setActiveTab('badges')}
                className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                  activeTab === 'badges'
                    ? 'bg-lime text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                <Award size={16} /> My Badges ({badges.length})
              </button>
            </div>
          </div>

          {/* Active View */}
          {activeTab === 'mentors' ? (
            <div className="space-y-6">
              {/* Search Bar */}
              <div className="relative max-w-md">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchMentor}
                  onChange={(e) => setSearchMentor(e.target.value)}
                  placeholder="Search mentors by name or topic (e.g. System Design, AI)..."
                  className="w-full pl-10 pr-4 py-2.5 border-2 border-black rounded font-mono text-xs bg-white"
                />
              </div>

              {/* Mentor Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {filteredMentors.map((mentor) => (
                  <div
                    key={mentor.id}
                    className="bg-white border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between space-y-4 hover:-translate-y-1 transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full border-2 border-black bg-lime/30 flex items-center justify-center font-display font-black text-lg text-black">
                            {mentor.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-display font-black text-base text-black">
                              {mentor.name}
                            </h3>
                            <p className="font-mono text-xs text-gray-500">{mentor.major}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 font-mono text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                          <Star size={12} fill="currentColor" /> {mentor.rating}
                        </div>
                      </div>

                      <p className="font-mono text-xs font-bold text-gray-800 mb-2">
                        {mentor.roleTitle}
                      </p>

                      <p className="font-mono text-xs text-gray-600 line-clamp-3 mb-3">
                        {mentor.bio}
                      </p>

                      <div className="flex flex-wrap gap-1">
                        {mentor.expertiseAreas.map((area) => (
                          <span
                            key={area}
                            className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[10px] font-bold"
                          >
                            {area}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t-2 border-slate-100 flex items-center justify-between">
                      <span className="font-mono text-xs text-gray-600 font-bold">
                        {mentor.availableSlots.filter((s) => !s.isBooked).length} slots available
                      </span>

                      <button
                        onClick={() => setSelectedMentor(mentor)}
                        className="neu-border bg-lime hover:bg-lime/90 px-4 py-2 font-mono text-xs font-black uppercase text-black"
                      >
                        Book Office Hours
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'quests' ? (
            <QuestTreeView quests={quests} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
              {badges.map((badge) => (
                <VerifiableBadgeCard key={badge.id} badge={badge} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Booking Modal */}
      {selectedMentor && (
        <MentorBookingModal
          mentor={selectedMentor}
          isOpen={!!selectedMentor}
          onClose={() => setSelectedMentor(null)}
          onConfirmBooking={handleBooking}
        />
      )}
    </SiteShell>
  );
}
