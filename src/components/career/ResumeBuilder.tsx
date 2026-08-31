import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  FileText,
  Plus,
  Trash2,
  GripVertical,
  Download,
  Save,
  Star,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  ChevronDown,
  ChevronRight,
  Briefcase,
  GraduationCap,
  Wrench,
  FolderOpen,
  Award,
  Eye,
  Sparkles,
  Target,
  BarChart3,
  Clock,
  Edit3,
  Copy,
  Settings,
} from "lucide-react";
import type { ResumeVersion, ResumeSection, ResumeItem } from "../../types/career";

// ─── Helpers ─────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// ─── ATS Score Calculator ────────────────────────────────────────────────

interface ATSResult {
  score: number;
  maxScore: number;
  breakdown: { label: string; score: number; max: number; tip: string }[];
}

function calculateATSScore(resume: ResumeVersion): ATSResult {
  const breakdown: ATSResult["breakdown"] = [];

  // 1. Has contact info (simulated as objective section)
  const hasObjective = resume.sections.some((s) => s.type === "skills" && s.items.length > 0);
  breakdown.push({
    label: "Skills Section",
    score: hasObjective ? 20 : 0,
    max: 20,
    tip: hasObjective ? "Skills section present" : "Add a skills section to improve ATS matching",
  });

  // 2. Experience
  const expSection = resume.sections.find((s) => s.type === "experience");
  const expCount = expSection?.items.length ?? 0;
  const expScore = Math.min(25, expCount * 8);
  breakdown.push({
    label: "Work Experience",
    score: expScore,
    max: 25,
    tip:
      expCount === 0
        ? "Add at least one work experience entry"
        : expCount >= 3
          ? "Good number of experience entries"
          : "Consider adding more experience entries",
  });

  // 3. Education
  const eduSection = resume.sections.find((s) => s.type === "education");
  const eduScore = (eduSection?.items.length ?? 0) > 0 ? 15 : 0;
  breakdown.push({
    label: "Education",
    score: eduScore,
    max: 15,
    tip: eduScore > 0 ? "Education section present" : "Add your education background",
  });

  // 4. Projects
  const projSection = resume.sections.find((s) => s.type === "projects");
  const projScore = Math.min(15, (projSection?.items.length ?? 0) * 5);
  breakdown.push({
    label: "Projects",
    score: projScore,
    max: 15,
    tip:
      projScore === 0
        ? "Add projects to showcase practical skills"
        : "Projects demonstrate hands-on experience",
  });

  // 5. Certifications
  const certSection = resume.sections.find((s) => s.type === "certifications");
  const certScore = Math.min(10, (certSection?.items.length ?? 0) * 5);
  breakdown.push({
    label: "Certifications",
    score: certScore,
    max: 10,
    tip: certScore > 0 ? "Certifications add credibility" : "Optional: add relevant certifications",
  });

  // 6. Description quality (length check across all items)
  const allItems = resume.sections.flatMap((s) => s.items);
  const avgDescLength =
    allItems.length > 0
      ? allItems.reduce((sum, item) => sum + item.description.length, 0) / allItems.length
      : 0;
  const descScore = Math.min(15, Math.round((avgDescLength / 100) * 15));
  breakdown.push({
    label: "Content Quality",
    score: descScore,
    max: 15,
    tip:
      descScore >= 10
        ? "Good detail level in descriptions"
        : "Add more detail to your descriptions (aim for 2-3 sentences each)",
  });

  const totalScore = breakdown.reduce((sum, b) => sum + b.score, 0);
  const maxScore = breakdown.reduce((sum, b) => sum + b.max, 0);

  return { score: totalScore, maxScore, breakdown };
}

// ─── ATS Score Gauge ─────────────────────────────────────────────────────

const ATSScoreGauge: React.FC<{ result: ATSResult }> = ({ result }) => {
  const pct = result.maxScore > 0 ? (result.score / result.maxScore) * 100 : 0;
  const color =
    pct >= 80
      ? "text-emerald-400"
      : pct >= 60
        ? "text-yellow-400"
        : pct >= 40
          ? "text-orange-400"
          : "text-red-400";
  const bgColor =
    pct >= 80
      ? "bg-emerald-500"
      : pct >= 60
        ? "bg-yellow-500"
        : pct >= 40
          ? "bg-orange-500"
          : "bg-red-500";
  const grade = pct >= 80 ? "Excellent" : pct >= 60 ? "Good" : pct >= 40 ? "Needs Work" : "Weak";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-violet-400" />
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">ATS Score</h3>
      </div>

      {/* Gauge */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgb(30,41,59)" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeLinecap="round"
              className={color}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-lg font-black font-mono ${color}`}>{result.score}</span>
            <span className="text-[8px] text-slate-500">/{result.maxScore}</span>
          </div>
        </div>
        <div>
          <div className={`text-sm font-bold ${color}`}>{grade}</div>
          <p className="text-xs text-slate-400 mt-0.5">
            {pct >= 80
              ? "Your resume is well-optimized for ATS systems."
              : pct >= 60
                ? "Good foundation — a few improvements could help."
                : "Several areas need attention for better ATS compatibility."}
          </p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-2">
        {result.breakdown.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">{item.label}</span>
              <span className="text-[10px] font-mono text-slate-500">
                {item.score}/{item.max}
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  item.score >= item.max * 0.8
                    ? "bg-emerald-500"
                    : item.score >= item.max * 0.5
                      ? "bg-yellow-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${item.max > 0 ? (item.score / item.max) * 100 : 0}%` }}
              />
            </div>
            <p className="text-[9px] text-slate-500 mt-0.5">{item.tip}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Section Type Config ─────────────────────────────────────────────────

const SECTION_CONFIG: Record<
  ResumeSection["type"],
  { label: string; icon: React.ReactNode; color: string; bg: string }
> = {
  experience: {
    label: "Work Experience",
    icon: <Briefcase className="w-4 h-4" />,
    color: "text-blue-400",
    bg: "bg-blue-900/50",
  },
  education: {
    label: "Education",
    icon: <GraduationCap className="w-4 h-4" />,
    color: "text-emerald-400",
    bg: "bg-emerald-900/50",
  },
  skills: {
    label: "Skills",
    icon: <Wrench className="w-4 h-4" />,
    color: "text-violet-400",
    bg: "bg-violet-900/50",
  },
  projects: {
    label: "Projects",
    icon: <FolderOpen className="w-4 h-4" />,
    color: "text-amber-400",
    bg: "bg-amber-900/50",
  },
  certifications: {
    label: "Certifications",
    icon: <Award className="w-4 h-4" />,
    color: "text-pink-400",
    bg: "bg-pink-900/50",
  },
};

// ─── Section Editor ──────────────────────────────────────────────────────

interface SectionEditorProps {
  section: ResumeSection;
  onUpdate: (sectionId: string, updates: Partial<ResumeSection>) => void;
  onAddItem: (sectionId: string) => void;
  onUpdateItem: (sectionId: string, itemId: string, updates: Partial<ResumeItem>) => void;
  onRemoveItem: (sectionId: string, itemId: string) => void;
  onMoveItemUp: (sectionId: string, itemId: string) => void;
  onMoveItemDown: (sectionId: string, itemId: string) => void;
}

const SectionEditor: React.FC<SectionEditorProps> = ({
  section,
  onUpdate,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onMoveItemUp,
  onMoveItemDown,
}) => {
  const [expanded, setExpanded] = useState(true);
  const config = SECTION_CONFIG[section.type];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Section Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.bg} ${config.color}`}
          >
            {config.icon}
          </div>
          <div>
            <input
              type="text"
              value={section.title}
              onChange={(e) => onUpdate(section.id, { title: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-bold text-slate-200 bg-transparent border-none outline-none focus:text-white w-full"
            />
            <span className="text-[10px] text-slate-500">
              {section.items.length} {section.items.length === 1 ? "item" : "items"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddItem(section.id);
            }}
            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Add item"
          >
            <Plus className="w-4 h-4" />
          </button>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </div>

      {/* Items */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {section.items.length === 0 && (
            <div className="text-center py-6 text-slate-600">
              <p className="text-xs">No items yet. Click + to add one.</p>
            </div>
          )}
          {section.items.map((item, index) => (
            <div
              key={item.id}
              className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3"
            >
              {/* Item Header */}
              <div className="flex items-start gap-2">
                <div className="flex flex-col gap-0.5 pt-1">
                  <button
                    onClick={() => onMoveItemUp(section.id, item.id)}
                    disabled={index === 0}
                    className="text-slate-600 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-3 h-3 -rotate-90" />
                  </button>
                  <button
                    onClick={() => onMoveItemDown(section.id, item.id)}
                    disabled={index === section.items.length - 1}
                    className="text-slate-600 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-3 h-3 rotate-90" />
                  </button>
                </div>

                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => onUpdateItem(section.id, item.id, { title: e.target.value })}
                      placeholder={
                        section.type === "experience"
                          ? "Job Title"
                          : section.type === "education"
                            ? "Degree"
                            : section.type === "projects"
                              ? "Project Name"
                              : section.type === "certifications"
                                ? "Certification Name"
                                : "Skill"
                      }
                      className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-600 transition-colors"
                    />
                    <input
                      type="text"
                      value={item.subtitle}
                      onChange={(e) =>
                        onUpdateItem(section.id, item.id, { subtitle: e.target.value })
                      }
                      placeholder={
                        section.type === "experience"
                          ? "Company Name"
                          : section.type === "education"
                            ? "School Name"
                            : section.type === "projects"
                              ? "Technologies Used"
                              : section.type === "certifications"
                                ? "Issuing Organization"
                                : "Proficiency Level"
                      }
                      className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-600 transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={item.dateRange}
                      onChange={(e) =>
                        onUpdateItem(section.id, item.id, { dateRange: e.target.value })
                      }
                      placeholder="Date Range (e.g., Jan 2024 – Present)"
                      className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-600 transition-colors"
                    />
                  </div>
                  <textarea
                    value={item.description}
                    onChange={(e) =>
                      onUpdateItem(section.id, item.id, { description: e.target.value })
                    }
                    placeholder="Description of your role, responsibilities, and achievements..."
                    rows={3}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-600 transition-colors resize-none"
                  />

                  {/* Highlights */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">
                      Key Highlights
                    </span>
                    {item.highlights.map((highlight, hIdx) => (
                      <div key={hIdx} className="flex items-center gap-2">
                        <span className="text-violet-500 text-xs">•</span>
                        <input
                          type="text"
                          value={highlight}
                          onChange={(e) => {
                            const newHighlights = [...item.highlights];
                            newHighlights[hIdx] = e.target.value;
                            onUpdateItem(section.id, item.id, { highlights: newHighlights });
                          }}
                          placeholder="Achievement or metric..."
                          className="flex-1 px-2 py-1 bg-slate-900/50 border border-slate-700/50 rounded text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-violet-600/50 transition-colors"
                        />
                        <button
                          onClick={() => {
                            const newHighlights = item.highlights.filter((_, i) => i !== hIdx);
                            onUpdateItem(section.id, item.id, { highlights: newHighlights });
                          }}
                          className="text-slate-600 hover:text-red-400 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        onUpdateItem(section.id, item.id, {
                          highlights: [...item.highlights, ""],
                        })
                      }
                      className="text-[10px] text-violet-400 hover:text-violet-300 font-bold flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add highlight
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => onRemoveItem(section.id, item.id)}
                  className="p-1.5 rounded-lg hover:bg-red-900/50 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                  title="Remove item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Resume Preview ──────────────────────────────────────────────────────

const ResumePreview: React.FC<{ resume: ResumeVersion }> = ({ resume }) => {
  return (
    <div className="bg-white rounded-xl shadow-2xl overflow-hidden text-slate-900 font-serif max-h-[70vh] overflow-y-auto">
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="text-center border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-bold text-slate-900">Your Name</h1>
          <p className="text-sm text-slate-600 mt-1">
            your.email@university.edu · (555) 123-4567 · LinkedIn Profile
          </p>
        </div>

        {/* Sections */}
        {resume.sections.map((section) => {
          const config = SECTION_CONFIG[section.type];
          if (section.items.length === 0) return null;

          return (
            <div key={section.id}>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-3">
                {section.title}
              </h2>
              <div className="space-y-3">
                {section.items.map((item) => (
                  <div key={item.id}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                        {item.subtitle && (
                          <p className="text-xs text-slate-600 italic">{item.subtitle}</p>
                        )}
                      </div>
                      {item.dateRange && (
                        <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap ml-4">
                          {item.dateRange}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                    {item.highlights.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {item.highlights
                          .filter((h) => h.trim())
                          .map((h, i) => (
                            <li
                              key={i}
                              className="text-[11px] text-slate-700 flex items-start gap-1.5"
                            >
                              <span className="text-slate-400 mt-0.5">•</span>
                              {h}
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {resume.sections.every((s) => s.items.length === 0) && (
          <div className="text-center py-12 text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Start adding sections to see your resume preview</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Resume Builder Component ───────────────────────────────────────

interface ResumeBuilderProps {
  onResumeChange?: (resume: ResumeVersion) => void;
}

const ResumeBuilder: React.FC<ResumeBuilderProps> = ({ onResumeChange }) => {
  // ─── State ─────────────────────────────────────────────────────────────
  const [resumes, setResumes] = useState<ResumeVersion[]>([
    {
      id: "r1",
      name: "Software Engineering Resume",
      createdAt: new Date(Date.now() - 86400000 * 30),
      updatedAt: new Date(Date.now() - 86400000 * 2),
      atsScore: 0,
      isDefault: true,
      sections: [
        {
          id: "s1",
          type: "experience",
          title: "Work Experience",
          items: [
            {
              id: "i1",
              title: "Software Engineering Intern",
              subtitle: "TechNova",
              dateRange: "Jun 2025 – Aug 2025",
              description:
                "Built and shipped production ML features for the AI platform team, serving 2M+ developers worldwide.",
              highlights: [
                "Reduced model inference latency by 40% through caching optimization",
                "Implemented real-time feature flag system using TypeScript and Redis",
                "Presented technical design docs to senior engineering leadership",
              ],
            },
            {
              id: "i2",
              title: "Undergraduate Research Assistant",
              subtitle: "University AI Lab",
              dateRange: "Sep 2024 – May 2025",
              description:
                "Conducted research on few-shot learning and prompt engineering techniques for large language models.",
              highlights: [
                "Co-authored paper accepted at ACL 2025 workshop",
                "Built evaluation framework for measuring LLM reasoning capabilities",
              ],
            },
          ],
        },
        {
          id: "s2",
          type: "education",
          title: "Education",
          items: [
            {
              id: "i3",
              title: "B.S. Computer Science",
              subtitle: "State University",
              dateRange: "Expected May 2027",
              description: "GPA: 3.85/4.0 · Dean's List · ACM Chapter President",
              highlights: [],
            },
          ],
        },
        {
          id: "s3",
          type: "skills",
          title: "Technical Skills",
          items: [
            {
              id: "i4",
              title: "Languages & Frameworks",
              subtitle: "Core",
              dateRange: "",
              description:
                "TypeScript, Python, Rust, Go · React, Next.js, Node.js · PyTorch, TensorFlow",
              highlights: [],
            },
            {
              id: "i5",
              title: "Tools & Platforms",
              subtitle: "Infrastructure",
              dateRange: "",
              description: "AWS, GCP, Docker, Kubernetes · PostgreSQL, Redis, MongoDB · Git, CI/CD",
              highlights: [],
            },
          ],
        },
        {
          id: "s4",
          type: "projects",
          title: "Projects",
          items: [
            {
              id: "i6",
              title: "CampusConnect Platform",
              subtitle: "React, TypeScript, Supabase",
              dateRange: "2025 – Present",
              description:
                "Full-stack campus management platform with 10k+ active users. Built event management, marketplace, and real-time collaboration features.",
              highlights: [
                "Led development of event ticketing system with QR code generation",
                "Implemented real-time chat using WebSockets and Supabase Realtime",
              ],
            },
          ],
        },
        {
          id: "s5",
          type: "certifications",
          title: "Certifications",
          items: [],
        },
      ],
    },
  ]);

  const [activeResumeId, setActiveResumeId] = useState("r1");
  const [showPreview, setShowPreview] = useState(true);
  const [editingName, setEditingName] = useState(false);

  const activeResume = useMemo(
    () => resumes.find((r) => r.id === activeResumeId) ?? resumes[0],
    [resumes, activeResumeId],
  );

  const atsResult = useMemo(() => calculateATSScore(activeResume), [activeResume]);

  // ─── Resume CRUD ───────────────────────────────────────────────────────
  const createResume = useCallback(() => {
    const newResume: ResumeVersion = {
      id: generateId(),
      name: `Untitled Resume ${resumes.length + 1}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      atsScore: 0,
      isDefault: false,
      sections: [
        { id: generateId(), type: "experience", title: "Work Experience", items: [] },
        { id: generateId(), type: "education", title: "Education", items: [] },
        { id: generateId(), type: "skills", title: "Technical Skills", items: [] },
        { id: generateId(), type: "projects", title: "Projects", items: [] },
        { id: generateId(), type: "certifications", title: "Certifications", items: [] },
      ],
    };
    setResumes((prev) => [...prev, newResume]);
    setActiveResumeId(newResume.id);
  }, [resumes.length]);

  const deleteResume = useCallback(
    (resumeId: string) => {
      if (resumes.length <= 1) return;
      setResumes((prev) => prev.filter((r) => r.id !== resumeId));
      if (activeResumeId === resumeId) {
        setActiveResumeId(resumes.find((r) => r.id !== resumeId)?.id ?? resumes[0].id);
      }
    },
    [resumes, activeResumeId],
  );

  const duplicateResume = useCallback(
    (resumeId: string) => {
      const source = resumes.find((r) => r.id === resumeId);
      if (!source) return;
      const copy: ResumeVersion = {
        ...source,
        id: generateId(),
        name: `${source.name} (Copy)`,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDefault: false,
        sections: source.sections.map((s) => ({
          ...s,
          id: generateId(),
          items: s.items.map((item) => ({ ...item, id: generateId() })),
        })),
      };
      setResumes((prev) => [...prev, copy]);
      setActiveResumeId(copy.id);
    },
    [resumes],
  );

  // ─── Section CRUD ──────────────────────────────────────────────────────
  const updateResume = useCallback(
    (updater: (resume: ResumeVersion) => ResumeVersion) => {
      setResumes((prev) =>
        prev.map((r) => (r.id === activeResumeId ? updater({ ...r, updatedAt: new Date() }) : r)),
      );
    },
    [activeResumeId],
  );

  const updateSection = useCallback(
    (sectionId: string, updates: Partial<ResumeSection>) => {
      updateResume((r) => ({
        ...r,
        sections: r.sections.map((s) => (s.id === sectionId ? { ...s, ...updates } : s)),
      }));
    },
    [updateResume],
  );

  const addItem = useCallback(
    (sectionId: string) => {
      const newItem: ResumeItem = {
        id: generateId(),
        title: "",
        subtitle: "",
        dateRange: "",
        description: "",
        highlights: [],
      };
      updateResume((r) => ({
        ...r,
        sections: r.sections.map((s) =>
          s.id === sectionId ? { ...s, items: [...s.items, newItem] } : s,
        ),
      }));
    },
    [updateResume],
  );

  const updateItem = useCallback(
    (sectionId: string, itemId: string, updates: Partial<ResumeItem>) => {
      updateResume((r) => ({
        ...r,
        sections: r.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                items: s.items.map((item) => (item.id === itemId ? { ...item, ...updates } : item)),
              }
            : s,
        ),
      }));
    },
    [updateResume],
  );

  const removeItem = useCallback(
    (sectionId: string, itemId: string) => {
      updateResume((r) => ({
        ...r,
        sections: r.sections.map((s) =>
          s.id === sectionId ? { ...s, items: s.items.filter((item) => item.id !== itemId) } : s,
        ),
      }));
    },
    [updateResume],
  );

  const moveItem = useCallback(
    (sectionId: string, itemId: string, direction: "up" | "down") => {
      updateResume((r) => ({
        ...r,
        sections: r.sections.map((s) => {
          if (s.id !== sectionId) return s;
          const idx = s.items.findIndex((item) => item.id === itemId);
          if (idx === -1) return s;
          const newIdx = direction === "up" ? idx - 1 : idx + 1;
          if (newIdx < 0 || newIdx >= s.items.length) return s;
          const newItems = [...s.items];
          [newItems[idx], newItems[newIdx]] = [newItems[newIdx], newItems[idx]];
          return { ...s, items: newItems };
        }),
      }));
    },
    [updateResume],
  );

  // ─── PDF Export ────────────────────────────────────────────────────────
  const handleExportPDF = useCallback(async () => {
    try {
      const [{ default: pdfMake }, fontsModule] = await Promise.all([
        import("pdfmake/build/pdfmake"),
        import("pdfmake/build/vfs_fonts"),
      ]);

      const vfs =
        (fontsModule as { default?: { vfs?: unknown }; pdfMakeVfs?: unknown }).default?.vfs ??
        (fontsModule as { default?: { pdfMakeVfs?: unknown } }).default?.pdfMakeVfs ??
        (fontsModule as { pdfMakeVfs?: unknown }).pdfMakeVfs ??
        (pdfMake as unknown as { vfs?: unknown }).vfs;

      if (vfs && typeof vfs === "object") {
        (pdfMake as unknown as { vfs: unknown }).vfs = vfs;
      }

      const content: unknown[] = [];

      // Header
      content.push({
        text: "Your Name",
        style: "header",
        alignment: "center",
      });
      content.push({
        text: "your.email@university.edu · (555) 123-4567 · LinkedIn Profile",
        style: "subheader",
        alignment: "center",
      });
      content.push({ text: "", margin: [0, 10] });

      // Sections
      for (const section of activeResume.sections) {
        if (section.items.length === 0) continue;

        content.push({
          text: section.title.toUpperCase(),
          style: "sectionTitle",
          margin: [0, 8, 0, 4],
        });

        for (const item of section.items) {
          const itemContent: unknown[] = [];

          // Title line
          const titleLine: Record<string, unknown> = {
            text: item.title,
            style: "itemTitle",
            margin: [0, 2],
          };
          if (item.dateRange) {
            titleLine.columns = [
              { text: item.title, style: "itemTitle", width: "*" },
              { text: item.dateRange, style: "dateRange", width: "auto" },
            ];
          }
          itemContent.push(titleLine);

          if (item.subtitle) {
            itemContent.push({
              text: item.subtitle,
              style: "itemSubtitle",
            });
          }

          if (item.description) {
            itemContent.push({
              text: item.description,
              style: "itemDescription",
              margin: [0, 2],
            });
          }

          if (item.highlights.length > 0) {
            const filteredHighlights = item.highlights.filter((h) => h.trim());
            if (filteredHighlights.length > 0) {
              itemContent.push({
                ul: filteredHighlights.map((h) => ({
                  text: h,
                  style: "highlight",
                })),
                margin: [10, 2, 0, 0],
              });
            }
          }

          content.push(itemContent);
        }
      }

      const docDefinition = {
        content,
        defaultStyle: {
          fontSize: 10,
          font: "Roboto",
        },
        styles: {
          header: { fontSize: 18, bold: true },
          subheader: { fontSize: 10, color: "#666666" },
          sectionTitle: { fontSize: 12, bold: true, decoration: "underline" },
          itemTitle: { fontSize: 11, bold: true },
          itemSubtitle: { fontSize: 10, italics: true, color: "#555555" },
          itemDescription: { fontSize: 9, color: "#333333" },
          dateRange: { fontSize: 9, color: "#666666", italics: true },
          highlight: { fontSize: 9, color: "#333333", margin: [0, 1] },
        },
        pageMargins: [40, 40, 40, 40],
      };

      const filename = `${activeResume.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
      pdfMake.createPdf(docDefinition).download(filename);
    } catch (err) {
      console.error("Failed to export PDF:", err);
    }
  }, [activeResume]);

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* ── Left Sidebar: Resume List ── */}
      <div className="w-full lg:w-64 flex-shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">My Resumes</h3>
          <button
            onClick={createResume}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Create new resume"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          {resumes.map((resume) => (
            <div
              key={resume.id}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                resume.id === activeResumeId
                  ? "bg-violet-600/20 border border-violet-600/30 text-white"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
              onClick={() => setActiveResumeId(resume.id)}
            >
              <FileText className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {editingName && resume.id === activeResumeId ? (
                  <input
                    type="text"
                    value={resume.name}
                    onChange={(e) =>
                      setResumes((prev) =>
                        prev.map((r) => (r.id === resume.id ? { ...r, name: e.target.value } : r)),
                      )
                    }
                    onBlur={() => setEditingName(false)}
                    onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
                    autoFocus
                    className="w-full text-xs font-bold bg-transparent border-none outline-none text-white"
                  />
                ) : (
                  <span
                    className="text-xs font-bold truncate block"
                    onDoubleClick={() => setEditingName(true)}
                  >
                    {resume.name}
                  </span>
                )}
                <span className="text-[9px] opacity-60">
                  Updated {formatDate(resume.updatedAt)}
                </span>
              </div>
              {resume.isDefault && <Star className="w-3 h-3 text-yellow-400 flex-shrink-0" />}
            </div>
          ))}
        </div>

        {/* ATS Score */}
        <ATSScoreGauge result={atsResult} />

        {/* Quick Actions */}
        <div className="space-y-1.5">
          <button
            onClick={handleExportPDF}
            className="w-full flex items-center gap-2 px-3 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl text-xs font-bold text-white transition-colors shadow-lg shadow-violet-600/20"
          >
            <Download className="w-4 h-4" />
            Export as PDF
          </button>
          <button
            onClick={() => duplicateResume(activeResumeId)}
            className="w-full flex items-center gap-2 px-3 py-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-colors"
          >
            <Copy className="w-4 h-4" />
            Duplicate Resume
          </button>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="w-full flex items-center gap-2 px-3 py-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-colors"
          >
            <Eye className="w-4 h-4" />
            {showPreview ? "Hide" : "Show"} Preview
          </button>
          {resumes.length > 1 && (
            <button
              onClick={() => deleteResume(activeResumeId)}
              className="w-full flex items-center gap-2 px-3 py-2.5 bg-slate-800 border border-slate-700 hover:bg-red-900/30 hover:border-red-800/50 rounded-xl text-xs font-bold text-slate-400 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Resume
            </button>
          )}
        </div>
      </div>

      {/* ── Main Content: Section Editors ── */}
      <div className="flex-1 space-y-3">
        {/* Resume Name */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={activeResume.name}
            onChange={(e) =>
              setResumes((prev) =>
                prev.map((r) =>
                  r.id === activeResumeId
                    ? { ...r, name: e.target.value, updatedAt: new Date() }
                    : r,
                ),
              )
            }
            className="text-lg font-bold text-slate-100 bg-transparent border-none outline-none focus:text-white flex-1"
          />
          <span className="text-[10px] text-slate-600 font-mono">
            {activeResume.sections.reduce((sum, s) => sum + s.items.length, 0)} items total
          </span>
        </div>

        {/* Section Editors */}
        {activeResume.sections.map((section) => (
          <SectionEditor
            key={section.id}
            section={section}
            onUpdate={updateSection}
            onAddItem={addItem}
            onUpdateItem={updateItem}
            onRemoveItem={removeItem}
            onMoveItemUp={(sId, itemId) => moveItem(sId, itemId, "up")}
            onMoveItemDown={(sId, itemId) => moveItem(sId, itemId, "down")}
          />
        ))}
      </div>

      {/* ── Right Panel: Preview ── */}
      {showPreview && (
        <div className="w-full lg:w-[380px] flex-shrink-0">
          <div className="sticky top-20">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Live Preview
              </span>
            </div>
            <ResumePreview resume={activeResume} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumeBuilder;
