import React, { useState } from "react";
import {
  FileText,
  GraduationCap,
  Users,
  Send,
  Download,
  Mail,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Github,
  Linkedin,
} from "lucide-react";
import {
  GraduatingSeniorProfile,
  ResumeBookCompilationResult,
  compileResumeBookDocument,
  generateSponsorDispatchPayload,
} from "@/lib/seniorResumeBookCompiler";
import { cn } from "@/lib/utils";

export interface SeniorResumeBookCompilerDashboardProps {
  clubId?: string;
  clubName?: string;
  graduationYear?: number;
  initialSeniors?: GraduatingSeniorProfile[];
  initialSponsorEmails?: string[];
  onDispatchToSponsors?: (payload: ReturnType<typeof generateSponsorDispatchPayload>) => void;
  className?: string;
}

export const MOCK_SENIOR_PROFILES: GraduatingSeniorProfile[] = [
  {
    userId: "sen-1",
    fullName: "Alice Vance",
    handle: "alice_v",
    major: "Computer Science",
    graduationYear: 2026,
    gpa: 3.92,
    githubUrl: "https://github.com/alicev",
    linkedinUrl: "https://linkedin.com/in/alicev",
    bio: "Focusing on distributed systems, Rust, and high-throughput data infrastructure.",
    skills: ["Distributed Systems", "Rust", "Go", "Kubernetes"],
    email: "alice.vance@campus.edu",
  },
  {
    userId: "sen-2",
    fullName: "Bob Chen",
    handle: "bob_c",
    major: "Data Science & AI",
    graduationYear: 2026,
    gpa: 3.85,
    githubUrl: "https://github.com/bobc",
    linkedinUrl: "https://linkedin.com/in/bobc",
    bio: "Specializing in PyTorch, computer vision models, and neural architecture optimization.",
    skills: ["PyTorch", "Python", "Computer Vision", "CUDA"],
    email: "bob.chen@campus.edu",
  },
  {
    userId: "sen-3",
    fullName: "Elena Rostova",
    handle: "elena_r",
    major: "Software Engineering",
    graduationYear: 2026,
    gpa: 3.96,
    githubUrl: "https://github.com/elenar",
    linkedinUrl: "https://linkedin.com/in/elenar",
    bio: "Full-stack engineer passionate about WebAssembly, React performance, and modern web APIs.",
    skills: ["TypeScript", "React", "WebAssembly", "PostgreSQL"],
    email: "elena.r@campus.edu",
  },
];

export const SeniorResumeBookCompilerDashboard: React.FC<SeniorResumeBookCompilerDashboardProps> = ({
  clubId = "club-cs-1",
  clubName = "Computer Science Society",
  graduationYear = 2026,
  initialSeniors = MOCK_SENIOR_PROFILES,
  initialSponsorEmails = ["recruiting@google.com", "university@microsoft.com"],
  onDispatchToSponsors,
  className,
}) => {
  const [currentPageIdx, setCurrentPageIdx] = useState<number>(0);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);

  const compilation: ResumeBookCompilationResult = compileResumeBookDocument(
    clubName,
    graduationYear,
    initialSeniors,
    clubId,
    initialSponsorEmails
  );

  const totalPages = compilation.seniorProfiles.length + 1; // 1 Cover Page + Senior Pages

  const handleCompileAndDispatch = () => {
    const payload = generateSponsorDispatchPayload(clubName, compilation, initialSponsorEmails);
    if (onDispatchToSponsors) onDispatchToSponsors(payload);

    setDispatchSuccess(
      `Resume Book compiled & automatically emailed to ${initialSponsorEmails.length} Corporate Sponsors!`
    );
    setTimeout(() => setDispatchSuccess(null), 5000);
  };

  const selectedSenior = currentPageIdx > 0 ? compilation.seniorProfiles[currentPageIdx - 1] : null;

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-indigo-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-indigo-950">
            <GraduationCap className="w-5 h-5 text-indigo-700" />
            <span>Automated "Graduating Senior" Resume Book Compiler — {clubName}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Scrapes senior member profiles and compiles standardized multi-page PDF talent books for corporate sponsors every April 15th.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCompileAndDispatch}
          className="px-4 py-2 border-2 border-black bg-black text-white hover:bg-gray-800 font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5"
        >
          <Send className="w-4 h-4 text-emerald-400" />
          Compile & Dispatch to Sponsors ({initialSponsorEmails.length})
        </button>
      </div>

      {/* Confirmation Notification Banner */}
      {dispatchSuccess && (
        <div className="p-3.5 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{dispatchSuccess}</span>
        </div>
      )}

      {/* Roster & Document Summary Cards */}
      <div className="p-5 bg-slate-50 border-b-2 border-black grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-3.5 border-2 border-black rounded-lg bg-white space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold text-gray-500 uppercase block">Graduating Seniors</span>
          <span className="text-2xl font-black text-indigo-950">{compilation.totalSeniors}</span>
          <span className="text-[11px] font-sans text-gray-600 block">Class of {graduationYear}</span>
        </div>

        <div className="p-3.5 border-2 border-black rounded-lg bg-white space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold text-gray-500 uppercase block">Sponsor Recipients</span>
          <span className="text-2xl font-black text-emerald-600">{initialSponsorEmails.length}</span>
          <span className="text-[11px] font-sans text-gray-600 block">Active corporate partners</span>
        </div>

        <div className="p-3.5 border-2 border-black rounded-lg bg-white space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold text-gray-500 uppercase block">Average Senior GPA</span>
          <span className="text-2xl font-black text-sky-600">3.91</span>
          <span className="text-[11px] font-sans text-gray-600 block">Verified academic standing</span>
        </div>

        <div className="p-3.5 border-2 border-black rounded-lg bg-white space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold text-gray-500 uppercase block">Compilation Schedule</span>
          <span className="text-xs font-black text-black block mt-2">Every April 15th (Auto)</span>
          <span className="text-[11px] font-sans text-gray-600 block">Professional club trigger</span>
        </div>
      </div>

      {/* Main Grid: Multi-Page Resume Book Document Preview Canvas */}
      <div className="p-5 bg-white space-y-4">
        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-indigo-600" />
            Standardized Multi-Page Document Layout Preview
          </h4>

          {/* Page Switcher Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPageIdx === 0}
              onClick={() => setCurrentPageIdx((p) => Math.max(0, p - 1))}
              className="p-1 border border-black rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold font-mono">
              Page {currentPageIdx + 1} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPageIdx === totalPages - 1}
              onClick={() => setCurrentPageIdx((p) => Math.min(totalPages - 1, p + 1))}
              className="p-1 border border-black rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Page Render Canvas */}
        <div className="max-w-2xl mx-auto border-2 border-black rounded-xl p-8 bg-slate-50 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4 min-h-[380px]">
          {currentPageIdx === 0 ? (
            /* Cover Page Preview */
            <div className="p-8 bg-indigo-900 text-white rounded-lg space-y-6 text-center border-2 border-black">
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-300 block">Official Talent Packet</span>
                <h2 className="text-2xl font-black uppercase tracking-wide">{clubName}</h2>
                <h3 className="text-lg font-bold text-indigo-200">Class of {graduationYear} Senior Resume Book</h3>
              </div>

              <div className="py-4 border-t border-b border-indigo-700 font-mono text-sm text-indigo-100">
                {compilation.totalSeniors} Verified Senior Graduates Included
              </div>

              <div className="text-xs text-indigo-300 space-y-1 font-sans">
                <p>Delivered to Corporate Sponsors • CampusConnect Talent Pipeline</p>
                <p className="font-mono text-[10px] opacity-75">Auto-compiled on April 15th</p>
              </div>
            </div>
          ) : (
            /* Senior Profile Page Preview */
            selectedSenior && (
              <div className="p-6 bg-white border-2 border-black rounded-lg space-y-4 text-xs font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex justify-between items-start border-b-2 border-black pb-3">
                  <div>
                    <h3 className="text-base font-black text-black">{selectedSenior.fullName}</h3>
                    <span className="text-xs text-gray-600">
                      @{selectedSenior.handle} • {selectedSenior.email || `${selectedSenior.handle}@campus.edu`}
                    </span>
                  </div>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-950 border border-black font-bold text-xs rounded">
                    {selectedSenior.gpa ? `GPA: ${selectedSenior.gpa.toFixed(2)}` : "Graduating Senior"}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="font-bold text-indigo-900 text-xs block">Major: {selectedSenior.major}</span>
                  <p className="text-gray-700 font-sans leading-relaxed text-xs pt-1">{selectedSenior.bio}</p>
                </div>

                {selectedSenior.skills && selectedSenior.skills.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Skill Tags:</span>
                    <div className="flex flex-wrap gap-1">
                      {selectedSenior.skills.map((sk) => (
                        <span
                          key={sk}
                          className="text-[10px] bg-slate-100 text-slate-800 border border-slate-300 px-2 py-0.5 font-bold rounded"
                        >
                          #{sk}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs font-bold pt-3 border-t border-gray-200">
                  {selectedSenior.githubUrl && (
                    <a
                      href={selectedSenior.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline flex items-center gap-1"
                    >
                      <Github className="w-3.5 h-3.5" /> GitHub Profile
                    </a>
                  )}
                  {selectedSenior.linkedinUrl && (
                    <a
                      href={selectedSenior.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline flex items-center gap-1"
                    >
                      <Linkedin className="w-3.5 h-3.5" /> LinkedIn Profile
                    </a>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
