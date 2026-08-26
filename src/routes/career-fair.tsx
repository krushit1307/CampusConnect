import React, { useState } from 'react';
import { SiteShell } from '@/components/site/SiteShell';
import { CareerFairVenueMap } from '@/components/career/CareerFairVenueMap';
import { ResumeMatchModal } from '@/components/career/ResumeMatchModal';
import { VirtualQueuePanel } from '@/components/career/VirtualQueuePanel';
import { EmployerBooth, StudentResumeProfile } from '@/types/careerFair';
import {
  Briefcase,
  Sparkles,
  Upload,
  Search,
  Filter,
  CheckCircle,
  MapPin,
  Flame,
} from 'lucide-react';

export default function CareerFairPage() {
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [showOptimalPath, setShowOptimalPath] = useState(false);
  const [selectedBooth, setSelectedBooth] = useState<EmployerBooth | null>(null);
  const [activeQueues, setActiveQueues] = useState<string[]>(['b-2']);

  const [studentProfile, setStudentProfile] = useState<StudentResumeProfile>({
    name: 'Alex Johnson',
    major: 'B.S. Computer Science',
    graduationYear: 2026,
    skills: ['React', 'TypeScript', 'Node.js', 'Python', 'PostgreSQL', 'Docker'],
    experienceSummary:
      'SWE intern at campus research lab building web applications and API microservices.',
    targetRoles: ['Software Engineer', 'Full-Stack Engineer', 'Frontend Engineer'],
  });

  const [booths, setBooths] = useState<EmployerBooth[]>([
    {
      id: 'b-1',
      name: 'Vanguard Software Labs',
      industry: 'Enterprise Cloud & DevOps',
      boothNumber: 'A1',
      x: 1,
      y: 1,
      hiringRoles: ['Cloud Infrastructure Intern', 'Full-Stack SWE'],
      techStack: ['TypeScript', 'Kubernetes', 'Go', 'React'],
      matchScore: 92,
      matchReason: 'Strong alignment with your React, TypeScript, and Docker stack.',
      sponsorTier: 'platinum',
      virtualQueueLength: 6,
      estimatedWaitMinutes: 12,
    },
    {
      id: 'b-2',
      name: 'Apex AI Robotics',
      industry: 'Autonomous Systems & Vision',
      boothNumber: 'A4',
      x: 4,
      y: 1,
      hiringRoles: ['Robotics Software Intern', 'Perception Engineer'],
      techStack: ['Python', 'C++', 'PyTorch', 'ROS'],
      matchScore: 78,
      matchReason: 'Matches your Python background and ML interest.',
      sponsorTier: 'gold',
      virtualQueueLength: 14,
      estimatedWaitMinutes: 25,
    },
    {
      id: 'b-3',
      name: 'Beacon Financial Tech',
      industry: 'Quantitative Trading & FinTech',
      boothNumber: 'B2',
      x: 2,
      y: 4,
      hiringRoles: ['Quant Developer Intern', 'Backend SWE'],
      techStack: ['Java', 'C++', 'PostgreSQL', 'Python'],
      matchScore: 84,
      matchReason: 'Matches your database and Python proficiency.',
      sponsorTier: 'gold',
      virtualQueueLength: 8,
      estimatedWaitMinutes: 15,
    },
    {
      id: 'b-4',
      name: 'BioHealth Analytics',
      industry: 'Computational Biology',
      boothNumber: 'C1',
      x: 1,
      y: 7,
      hiringRoles: ['Bioinformatics Analyst', 'Data Engineer'],
      techStack: ['R', 'Python', 'SQL', 'AWS'],
      matchScore: 65,
      matchReason: 'Moderate match on data pipeline fundamentals.',
      virtualQueueLength: 3,
      estimatedWaitMinutes: 5,
    },
    {
      id: 'b-5',
      name: 'Starlight Interactive Media',
      industry: 'Web3 & Real-Time Graphics',
      boothNumber: 'C4',
      x: 4,
      y: 7,
      hiringRoles: ['Graphics Programmer', 'Frontend Developer'],
      techStack: ['WebGL', 'TypeScript', 'React', 'Three.js'],
      matchScore: 95,
      matchReason: 'Top candidate match for Frontend & React engineering roles.',
      sponsorTier: 'platinum',
      virtualQueueLength: 9,
      estimatedWaitMinutes: 18,
    },
  ]);

  const handleJoinQueue = (boothId: string) => {
    if (!activeQueues.includes(boothId)) {
      setActiveQueues([...activeQueues, boothId]);
      setBooths((prev) =>
        prev.map((b) =>
          b.id === boothId
            ? {
                ...b,
                virtualQueueLength: b.virtualQueueLength + 1,
                estimatedWaitMinutes: b.estimatedWaitMinutes + 3,
              }
            : b
        )
      );
    }
  };

  const handleLeaveQueue = (boothId: string) => {
    setActiveQueues(activeQueues.filter((id) => id !== boothId));
    setBooths((prev) =>
      prev.map((b) =>
        b.id === boothId
          ? {
              ...b,
              virtualQueueLength: Math.max(0, b.virtualQueueLength - 1),
              estimatedWaitMinutes: Math.max(0, b.estimatedWaitMinutes - 3),
            }
          : b
      )
    );
  };

  return (
    <SiteShell>
      <div className="min-h-screen bg-[#faf8f5] py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Banner */}
          <div className="flex flex-wrap items-center justify-between gap-6 border-b-4 border-black pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-lime border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <Briefcase size={24} />
                </span>
                <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight text-black">
                  Annual Engineering Career Fair
                </h1>
              </div>
              <p className="font-mono text-sm text-gray-600 mt-1">
                Oct 14, 2026 • Grand Ballroom • AI-powered resume matching & live booth queueing.
              </p>
            </div>

            {/* Profile & Resume Upload CTA */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsResumeModalOpen(true)}
                className="neu-border bg-lime hover:bg-lime/90 px-4 py-2.5 font-mono text-xs font-black uppercase text-black flex items-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-transform"
              >
                <Sparkles size={16} /> AI Resume Matcher
              </button>
            </div>
          </div>

          {/* Student Status Strip */}
          <div className="bg-white border-2 border-black rounded-lg p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-black">{studentProfile.name}</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600">{studentProfile.major}</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600">Class of {studentProfile.graduationYear}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-bold">Skills Parsed:</span>
              <div className="flex gap-1 overflow-x-auto">
                {studentProfile.skills.slice(0, 5).map((skill) => (
                  <span
                    key={skill}
                    className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-bold"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Main Interactive Grid: Floor Map on Left, Queue & Booth Details on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <CareerFairVenueMap
                booths={booths}
                selectedBooth={selectedBooth}
                onSelectBooth={(booth) => setSelectedBooth(booth)}
                showOptimalPath={showOptimalPath}
                onTogglePath={() => setShowOptimalPath(!showOptimalPath)}
              />
            </div>

            <div className="lg:col-span-1">
              <VirtualQueuePanel
                selectedBooth={selectedBooth}
                activeQueues={activeQueues}
                onJoinQueue={handleJoinQueue}
                onLeaveQueue={handleLeaveQueue}
              />
            </div>
          </div>
        </div>
      </div>

      {/* AI Resume Upload & Match Modal */}
      <ResumeMatchModal
        isOpen={isResumeModalOpen}
        onClose={() => setIsResumeModalOpen(false)}
        onProfileUpdate={(profile) => setStudentProfile(profile)}
        currentProfile={studentProfile}
      />
    </SiteShell>
  );
}
