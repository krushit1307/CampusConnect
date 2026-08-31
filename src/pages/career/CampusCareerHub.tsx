import React, { useState, useCallback, useMemo } from "react";
import {
  Briefcase,
  Search,
  Filter,
  BarChart3,
  Calendar,
  Bookmark,
  ChevronDown,
  X,
  Check,
  Download,
  Sparkles,
  TrendingUp,
  Users,
  Building2,
  Globe,
  Zap,
  FileText,
  Eye,
  Send,
  Clock,
  ArrowUpRight,
  Star,
  GraduationCap,
  Target,
} from "lucide-react";

import JobListingCard from "../../components/career/JobListingCard";
import {
  StatusPipeline,
  ApplicationCard,
  ApplicationDetailModal,
  PIPELINE_ORDER,
} from "../../components/career/ApplicationTracker";
import { CareerFairCard } from "../../components/career/CareerFairSchedule";
import ResumeBuilder from "../../components/career/ResumeBuilder";
import {
  useCareerSearch,
  useApplicationTracker,
  useCareerFairSearch,
} from "../../hooks/useCareerSearch";
import type {
  JobListing,
  Application,
  ApplicationEvent,
  CareerFairEvent,
  Company,
  ApplicationStatus,
} from "../../types/career";

// ─── Toast System ────────────────────────────────────────────────────────

interface Toast {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

const ToastContainer: React.FC<{ toasts: Toast[]; onDismiss: (id: string) => void }> = ({
  toasts,
  onDismiss,
}) => (
  <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
    {toasts.map((t) => (
      <div
        key={t.id}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-sm animate-slide-in ${
          t.type === "success"
            ? "bg-emerald-950/90 border-emerald-700 text-emerald-200"
            : t.type === "error"
              ? "bg-red-950/90 border-red-700 text-red-200"
              : "bg-slate-800/90 border-slate-600 text-slate-200"
        }`}
      >
        {t.type === "success" && <Check className="w-4 h-4 flex-shrink-0" />}
        {t.type === "error" && <X className="w-4 h-4 flex-shrink-0" />}
        {t.type === "info" && <Sparkles className="w-4 h-4 flex-shrink-0" />}
        <span className="text-sm font-medium flex-1">{t.message}</span>
        <button
          onClick={() => onDismiss(t.id)}
          className="text-slate-400 hover:text-white flex-shrink-0"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    ))}
  </div>
);

// ─── CSV Export ──────────────────────────────────────────────────────────

function exportToCsv(data: Record<string, string | number | boolean>[], filename: string): void {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = String(row[h] ?? "");
          return val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
        })
        .join(","),
    ),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// ─── Mock Data ───────────────────────────────────────────────────────────

const MOCK_COMPANIES: Company[] = [
  {
    id: "co1",
    name: "TechNova",
    logo: "",
    industry: "technology",
    size: "large",
    hq: "San Francisco, CA",
    website: "https://technova.io",
    description: "Leading AI platform building next-gen developer tools.",
    rating: 4.7,
    reviewsCount: 342,
    verified: true,
    openPositions: 12,
    tags: ["AI/ML", "Series D", "Remote-First"],
  },
  {
    id: "co2",
    name: "GreenLeaf Bio",
    logo: "",
    industry: "healthcare",
    size: "medium",
    hq: "Boston, MA",
    website: "https://greenleaf.bio",
    description: "Biotech innovator developing sustainable pharmaceutical solutions.",
    rating: 4.5,
    reviewsCount: 128,
    verified: true,
    openPositions: 7,
    tags: ["Biotech", "Sustainability", "Research"],
  },
  {
    id: "co3",
    name: "ArcLight Finance",
    logo: "",
    industry: "finance",
    size: "large",
    hq: "New York, NY",
    website: "https://arclight.finance",
    description: "Quantitative trading and asset management firm.",
    rating: 4.3,
    reviewsCount: 256,
    verified: true,
    openPositions: 15,
    tags: ["Quant", "Trading", "Finance"],
  },
  {
    id: "co4",
    name: "PixelForge Studios",
    logo: "",
    industry: "media",
    size: "small",
    hq: "Austin, TX",
    website: "https://pixelforge.studio",
    description: "Award-winning indie game studio and creative agency.",
    rating: 4.8,
    reviewsCount: 67,
    verified: false,
    openPositions: 4,
    tags: ["Gaming", "Creative", "Indie"],
  },
  {
    id: "co5",
    name: "SolarEdge Energy",
    logo: "",
    industry: "energy",
    size: "medium",
    hq: "Denver, CO",
    website: "https://solaredge.energy",
    description: "Clean energy technology company accelerating the solar transition.",
    rating: 4.6,
    reviewsCount: 189,
    verified: true,
    openPositions: 9,
    tags: ["CleanTech", "Solar", "Sustainability"],
  },
];

const MOCK_JOBS: JobListing[] = [
  {
    id: "j1",
    companyId: "co1",
    company: MOCK_COMPANIES[0],
    title: "Software Engineering Intern — AI Platform",
    type: "internship",
    experienceLevel: "entry",
    remotePolicy: "remote",
    location: "Remote (US)",
    salary: { min: 45000, max: 65000, currency: "USD" },
    description:
      "Join our AI platform team to build and ship production ML features used by millions of developers worldwide. You'll work closely with senior engineers on model serving infrastructure.",
    requirements: [
      "Currently pursuing BS/MS in CS or related field",
      "Strong fundamentals in data structures and algorithms",
      "Experience with Python, PyTorch or TensorFlow",
      "Familiarity with cloud services (AWS/GCP)",
    ],
    benefits: [
      "Mentorship Program",
      "Remote Flexible",
      "Free Meals",
      "Stock Options",
      "Learning Budget",
    ],
    postedAt: new Date(Date.now() - 86400000 * 2),
    deadline: new Date(Date.now() + 86400000 * 14),
    applicantsCount: 234,
    isUrgent: true,
    isSaved: false,
    tags: ["Python", "PyTorch", "Machine Learning", "Cloud", "Startup Culture"],
  },
  {
    id: "j2",
    companyId: "co2",
    company: MOCK_COMPANIES[1],
    title: "Biomedical Research Associate",
    type: "full-time",
    experienceLevel: "entry",
    remotePolicy: "on-site",
    location: "Boston, MA",
    salary: { min: 62000, max: 80000, currency: "USD" },
    description:
      "Conduct cutting-edge biomedical research in our drug discovery pipeline. Collaborate with cross-functional teams on preclinical studies and data analysis.",
    requirements: [
      "BS in Biochemistry, Molecular Biology, or related field",
      "1+ years lab experience (academic or industry)",
      "Proficiency with analytical tools and statistical software",
      "Strong written and verbal communication skills",
    ],
    benefits: [
      "Health & Dental",
      "401(k) Match",
      "Research Publication Support",
      "Continuing Education",
    ],
    postedAt: new Date(Date.now() - 86400000 * 5),
    deadline: new Date(Date.now() + 86400000 * 21),
    applicantsCount: 87,
    isUrgent: false,
    isSaved: true,
    tags: ["Biotech", "Research", "Lab Skills", "Data Analysis"],
  },
  {
    id: "j3",
    companyId: "co3",
    company: MOCK_COMPANIES[2],
    title: "Quantitative Developer — Summer Internship",
    type: "internship",
    experienceLevel: "entry",
    remotePolicy: "on-site",
    location: "New York, NY",
    salary: { min: 80000, max: 120000, currency: "USD" },
    description:
      "Build low-latency trading systems and pricing models at a top quant fund. Work directly with portfolio managers and researchers on real-money strategies.",
    requirements: [
      "Pursuing degree in Math, CS, Physics, or Engineering",
      "Strong C++ or Rust programming skills",
      "Understanding of probability, statistics, and stochastic calculus",
      "Prior internship in finance is a plus",
    ],
    benefits: ["Competitive Pay", "Housing Stipend", "Mentorship", "Return Offer Potential"],
    postedAt: new Date(Date.now() - 86400000),
    deadline: new Date(Date.now() + 86400000 * 10),
    applicantsCount: 412,
    isUrgent: true,
    isSaved: false,
    tags: ["C++", "Quantitative", "Finance", "Low-Latency", "Algorithms"],
  },
  {
    id: "j4",
    companyId: "co4",
    company: MOCK_COMPANIES[3],
    title: "UI/UX Designer — Game Interfaces",
    type: "full-time",
    experienceLevel: "mid",
    remotePolicy: "hybrid",
    location: "Austin, TX",
    salary: { min: 75000, max: 95000, currency: "USD" },
    description:
      "Design intuitive and beautiful game interfaces and player experiences. Collaborate with artists and engineers to prototype and ship UI features.",
    requirements: [
      "3+ years of UI/UX design experience",
      "Proficiency with Figma, Adobe Creative Suite",
      "Portfolio demonstrating game or interactive media design",
      "Understanding of accessibility and motion design",
    ],
    benefits: ["Creative Freedom", "Game Library", "Flexible Hours", "Team Retreats"],
    postedAt: new Date(Date.now() - 86400000 * 3),
    deadline: new Date(Date.now() + 86400000 * 30),
    applicantsCount: 156,
    isUrgent: false,
    isSaved: false,
    tags: ["UI/UX", "Figma", "Game Design", "Prototyping", "Accessibility"],
  },
  {
    id: "j5",
    companyId: "co5",
    company: MOCK_COMPANIES[4],
    title: "Solar Systems Engineering Intern",
    type: "co-op",
    experienceLevel: "entry",
    remotePolicy: "on-site",
    location: "Denver, CO",
    salary: { min: 35000, max: 50000, currency: "USD" },
    description:
      "Work on real solar installation projects from site assessment through commissioning. Gain hands-on experience with renewable energy systems.",
    requirements: [
      "Pursuing degree in Electrical, Mechanical, or Civil Engineering",
      "Interest in renewable energy and sustainability",
      "Basic knowledge of electrical systems",
      "Willingness to travel to installation sites",
    ],
    benefits: [
      "Hands-On Experience",
      "Sustainability Impact",
      "Professional Development",
      "Housing Assistance",
    ],
    postedAt: new Date(Date.now() - 86400000 * 7),
    deadline: new Date(Date.now() + 86400000 * 18),
    applicantsCount: 63,
    isUrgent: false,
    isSaved: true,
    tags: ["Renewable Energy", "Engineering", "Solar", "Sustainability", "Fieldwork"],
  },
  {
    id: "j6",
    companyId: "co1",
    company: MOCK_COMPANIES[0],
    title: "Full-Stack Engineer — Developer Tools",
    type: "full-time",
    experienceLevel: "mid",
    remotePolicy: "remote",
    location: "Remote (Global)",
    salary: { min: 130000, max: 180000, currency: "USD" },
    description:
      "Build the next generation of developer tools from scratch. Own features end-to-end — from database schema to pixel-perfect UI — serving millions of developers.",
    requirements: [
      "3+ years professional full-stack experience",
      "Expert-level TypeScript, React, and Node.js",
      "Experience with PostgreSQL and Redis",
      "Passion for developer experience and tooling",
    ],
    benefits: [
      "Fully Remote",
      "Unlimited PTO",
      "Equity Package",
      "Annual Team Offsite",
      "$5k Learning Budget",
    ],
    postedAt: new Date(Date.now() - 86400000 * 1),
    deadline: new Date(Date.now() + 86400000 * 45),
    applicantsCount: 189,
    isUrgent: false,
    isSaved: false,
    tags: ["TypeScript", "React", "Node.js", "PostgreSQL", "Remote"],
  },
  {
    id: "j7",
    companyId: "co3",
    company: MOCK_COMPANIES[2],
    title: "Risk Analyst — Summer Internship",
    type: "internship",
    experienceLevel: "entry",
    remotePolicy: "on-site",
    location: "New York, NY",
    salary: { min: 70000, max: 95000, currency: "USD" },
    description:
      "Analyze market risk, counterparty risk, and model validation for our multi-strategy portfolio. Work with real-time risk dashboards and scenario analysis.",
    requirements: [
      "Pursuing degree in Finance, Math, Statistics, or Economics",
      "Strong Excel and Python skills",
      "Understanding of financial derivatives",
      "Excellent analytical and communication skills",
    ],
    benefits: ["Industry Training", "Networking Events", "Housing Stipend", "Return Offer Track"],
    postedAt: new Date(Date.now() - 86400000 * 4),
    deadline: new Date(Date.now() + 86400000 * 12),
    applicantsCount: 298,
    isUrgent: true,
    isSaved: false,
    tags: ["Risk Management", "Python", "Finance", "Analytics", "Derivatives"],
  },
];

const MOCK_APPLICATIONS: Application[] = [
  {
    id: "a1",
    jobListingId: "j1",
    job: MOCK_JOBS[0],
    status: "interview",
    appliedAt: new Date(Date.now() - 86400000 * 10),
    updatedAt: new Date(Date.now() - 86400000 * 2),
    notes: "Technical interview scheduled with the AI platform team lead.",
    nextStep: "Technical Interview",
    nextStepDate: new Date(Date.now() + 86400000 * 3),
    timeline: [
      {
        id: "t1",
        status: "applied",
        timestamp: new Date(Date.now() - 86400000 * 10),
        note: "Application submitted",
      },
      {
        id: "t2",
        status: "screening",
        timestamp: new Date(Date.now() - 86400000 * 7),
        note: "Resume reviewed — passed initial screen",
      },
      {
        id: "t3",
        status: "interview",
        timestamp: new Date(Date.now() - 86400000 * 2),
        note: "Phone screen completed — moving to technical round",
      },
    ],
  },
  {
    id: "a2",
    jobListingId: "j3",
    job: MOCK_JOBS[2],
    status: "screening",
    appliedAt: new Date(Date.now() - 86400000 * 4),
    updatedAt: new Date(Date.now() - 86400000 * 1),
    notes: "OA completed. Waiting for results.",
    nextStep: "Online Assessment Results",
    nextStepDate: new Date(Date.now() + 86400000 * 5),
    timeline: [
      {
        id: "t4",
        status: "applied",
        timestamp: new Date(Date.now() - 86400000 * 4),
        note: "Application submitted",
      },
      {
        id: "t5",
        status: "screening",
        timestamp: new Date(Date.now() - 86400000 * 1),
        note: "Online assessment sent",
      },
    ],
  },
  {
    id: "a3",
    jobListingId: "j2",
    job: MOCK_JOBS[1],
    status: "offer",
    appliedAt: new Date(Date.now() - 86400000 * 20),
    updatedAt: new Date(Date.now() - 86400000),
    notes: "Offer received! $75k + benefits. Need to respond by Friday.",
    nextStep: "Accept/Decline Offer",
    nextStepDate: new Date(Date.now() + 86400000 * 4),
    timeline: [
      {
        id: "t6",
        status: "applied",
        timestamp: new Date(Date.now() - 86400000 * 20),
        note: "Applied via career portal",
      },
      {
        id: "t7",
        status: "screening",
        timestamp: new Date(Date.now() - 86400000 * 15),
        note: "Phone screen with HR",
      },
      {
        id: "t8",
        status: "interview",
        timestamp: new Date(Date.now() - 86400000 * 10),
        note: "Panel interview with research team",
      },
      {
        id: "t9",
        status: "offer",
        timestamp: new Date(Date.now() - 86400000),
        note: "Offer letter received — $75k base",
      },
    ],
  },
  {
    id: "a4",
    jobListingId: "j5",
    job: MOCK_JOBS[4],
    status: "saved",
    appliedAt: new Date(Date.now() - 86400000 * 2),
    updatedAt: new Date(Date.now() - 86400000 * 2),
    notes: "Interested in this co-op. Reviewing requirements.",
    timeline: [],
  },
  {
    id: "a5",
    jobListingId: "j6",
    job: MOCK_JOBS[5],
    status: "applied",
    appliedAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(Date.now() - 86400000),
    notes: "",
    timeline: [
      {
        id: "t10",
        status: "applied",
        timestamp: new Date(Date.now() - 86400000),
        note: "Application submitted",
      },
    ],
  },
];

const MOCK_CAREER_FAIRS: CareerFairEvent[] = [
  {
    id: "cf1",
    name: "Spring Tech Career Fair 2026",
    description:
      "Connect with 50+ top technology companies hiring for internships and full-time roles. Includes resume review workshop and mock interview sessions.",
    date: new Date(Date.now() + 86400000 * 12),
    endDate: new Date(Date.now() + 86400000 * 12 + 5 * 3600000),
    location: "Student Union Ballroom",
    virtual: false,
    companies: ["TechNova", "PixelForge", "SolarEdge", "GreenLeaf", "ArcLight"],
    tags: ["Technology", "Internships", "Full-Time", "Resume Review"],
    registeredCount: 342,
    isRegistered: false,
  },
  {
    id: "cf2",
    name: "Virtual Healthcare & Biotech Expo",
    description:
      "Explore opportunities in healthcare, biotech, and life sciences. Virtual booths with hiring managers from leading pharma and research institutions.",
    date: new Date(Date.now() + 86400000 * 20),
    endDate: new Date(Date.now() + 86400000 * 20 + 6 * 3600000),
    location: "Zoom (Virtual)",
    virtual: true,
    companies: ["GreenLeaf Bio", "MedTech Solutions", "BioInnovate", "PharmaCorp"],
    tags: ["Healthcare", "Biotech", "Research", "Virtual"],
    registeredCount: 178,
    isRegistered: true,
  },
  {
    id: "cf3",
    name: "Finance & Consulting Night",
    description:
      "Evening networking event with top finance firms and consulting agencies. Business casual. Speed networking rounds followed by open Q&A panels.",
    date: new Date(Date.now() + 86400000 * 35),
    endDate: new Date(Date.now() + 86400000 * 35 + 4 * 3600000),
    location: "Business School Atrium",
    virtual: false,
    companies: ["ArcLight Finance", "McKinsey", "Goldman Sachs", "Deloitte"],
    tags: ["Finance", "Consulting", "Networking", "Evening Event"],
    registeredCount: 215,
    isRegistered: false,
  },
];

// ─── Main Component ──────────────────────────────────────────────────────

export default function CampusCareerHub() {
  // ─── State ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"jobs" | "applications" | "fairs" | "resume">("jobs");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [jobs, setJobs] = useState<JobListing[]>(MOCK_JOBS);
  const [applications, setApplications] = useState<Application[]>(MOCK_APPLICATIONS);
  const [careerFairs, setCareerFairs] = useState<CareerFairEvent[]>(MOCK_CAREER_FAIRS);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // ─── Hooks ─────────────────────────────────────────────────────────────
  const {
    filters,
    filteredJobs,
    updateFilter,
    toggleArrayFilter,
    resetFilters,
    activeFilterCount,
  } = useCareerSearch(jobs);
  const { appFilters, filteredApplications, updateAppFilter, toggleStatusFilter, statusCounts } =
    useApplicationTracker(applications);
  const {
    query: fairQuery,
    setQuery: setFairQuery,
    showVirtualOnly,
    setShowVirtualOnly,
    filteredEvents,
  } = useCareerFairSearch(careerFairs);

  // ─── Toast Helpers ─────────────────────────────────────────────────────
  const addToast = useCallback((type: Toast["type"], message: string) => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // ─── Job Actions ───────────────────────────────────────────────────────
  const handleToggleSave = useCallback(
    (jobId: string) => {
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, isSaved: !j.isSaved } : j)));
      const job = jobs.find((j) => j.id === jobId);
      if (job) {
        addToast(
          "success",
          job.isSaved ? `Removed "${job.title}" from saved` : `Saved "${job.title}"`,
        );
      }
    },
    [jobs, addToast],
  );

  const handleApply = useCallback(
    (job: JobListing) => {
      const exists = applications.find((a) => a.jobListingId === job.id);
      if (exists) {
        addToast("info", `You already applied to "${job.title}"`);
        return;
      }

      const newApp: Application = {
        id: generateId(),
        jobListingId: job.id,
        job,
        status: "applied",
        appliedAt: new Date(),
        updatedAt: new Date(),
        notes: "",
        timeline: [
          {
            id: generateId(),
            status: "applied",
            timestamp: new Date(),
            note: "Application submitted",
          },
        ],
      };

      setApplications((prev) => [newApp, ...prev]);
      addToast("success", `Applied to "${job.title}" at ${job.company.name}`);
    },
    [applications, addToast],
  );

  // ─── Application Actions ───────────────────────────────────────────────
  const handleStatusChange = useCallback(
    (appId: string, newStatus: ApplicationStatus) => {
      setApplications((prev) =>
        prev.map((a) => {
          if (a.id !== appId) return a;
          const event: ApplicationEvent = {
            id: generateId(),
            status: newStatus,
            timestamp: new Date(),
            note: `Status changed to ${newStatus}`,
          };
          return {
            ...a,
            status: newStatus,
            updatedAt: new Date(),
            timeline: [...a.timeline, event],
          };
        }),
      );
      addToast("success", "Application status updated");
    },
    [addToast],
  );

  // ─── Career Fair Actions ───────────────────────────────────────────────
  const handleToggleRegister = useCallback(
    (eventId: string) => {
      setCareerFairs((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? {
                ...e,
                isRegistered: !e.isRegistered,
                registeredCount: e.isRegistered ? e.registeredCount - 1 : e.registeredCount + 1,
              }
            : e,
        ),
      );
      const event = careerFairs.find((e) => e.id === eventId);
      if (event) {
        addToast(
          "success",
          event.isRegistered
            ? `Unregistered from "${event.name}"`
            : `Registered for "${event.name}"`,
        );
      }
    },
    [careerFairs, addToast],
  );

  // ─── Stats ─────────────────────────────────────────────────────────────
  const stats = useMemo(
    () => ({
      totalJobs: jobs.length,
      savedJobs: jobs.filter((j) => j.isSaved).length,
      totalApplications: applications.length,
      interviews: applications.filter((a) => a.status === "interview").length,
      offers: applications.filter((a) => a.status === "offer").length,
      upcomingFairs: careerFairs.filter((e) => e.date.getTime() > Date.now() && e.isRegistered)
        .length,
    }),
    [jobs, applications, careerFairs],
  );

  // ─── Tab Definitions ───────────────────────────────────────────────────
  const tabs = [
    {
      id: "jobs" as const,
      label: "Job Board",
      icon: <Briefcase className="w-4 h-4" />,
      count: filteredJobs.length,
    },
    {
      id: "applications" as const,
      label: "My Applications",
      icon: <FileText className="w-4 h-4" />,
      count: applications.length,
    },
    {
      id: "fairs" as const,
      label: "Career Fairs",
      icon: <Calendar className="w-4 h-4" />,
      count: filteredEvents.length,
    },
    {
      id: "resume" as const,
      label: "Resume Builder",
      icon: <FileText className="w-4 h-4" />,
      count: 0,
    },
  ];

  // ─── Export Handlers ───────────────────────────────────────────────────
  const handleExportJobs = () => {
    const data = filteredJobs.map((j) => ({
      Title: j.title,
      Company: j.company.name,
      Type: j.type,
      Location: j.location,
      Remote: j.remotePolicy,
      SalaryMin: j.salary?.min ?? "",
      SalaryMax: j.salary?.max ?? "",
      Posted: j.postedAt.toLocaleDateString(),
      Deadline: j.deadline?.toLocaleDateString() ?? "",
      Applicants: j.applicantsCount,
    }));
    exportToCsv(data, `career-jobs-${new Date().toISOString().slice(0, 10)}.csv`);
    addToast("success", "Job listings exported to CSV");
  };

  const handleExportApplications = () => {
    const data = filteredApplications.map((a) => ({
      Position: a.job.title,
      Company: a.job.company.name,
      Status: a.status,
      Applied: a.appliedAt.toLocaleDateString(),
      Updated: a.updatedAt.toLocaleDateString(),
      NextStep: a.nextStep ?? "",
      NextStepDate: a.nextStepDate?.toLocaleDateString() ?? "",
      Notes: a.notes,
    }));
    exportToCsv(data, `career-applications-${new Date().toISOString().slice(0, 10)}.csv`);
    addToast("success", "Applications exported to CSV");
  };

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />

      {/* ── Header ── */}
      <div className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-violet-400 font-bold text-xs uppercase tracking-wider">
                <GraduationCap className="w-4 h-4" />
                Campus Career & Internship Hub
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-100 mt-1">
                Launch Your Career
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Discover internships and full-time roles, track your applications, attend career
                fairs, and accelerate your professional journey — all in one place.
              </p>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-3">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-center">
                <Briefcase className="w-5 h-5 text-violet-400 mx-auto mb-1" />
                <div className="text-lg font-black font-mono text-violet-400">
                  {stats.totalJobs}
                </div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Open Roles</div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-center">
                <Send className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                <div className="text-lg font-black font-mono text-blue-400">
                  {stats.totalApplications}
                </div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Applied</div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-center">
                <Star className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <div className="text-lg font-black font-mono text-emerald-400">{stats.offers}</div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Offers</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="bg-slate-900/50 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                {tab.icon}
                {tab.label}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id
                      ? "bg-violet-500 text-white"
                      : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* ════════ JOB BOARD TAB ════════ */}
        {activeTab === "jobs" && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search jobs, companies, skills..."
                  value={filters.searchQuery}
                  onChange={(e) => updateFilter("searchQuery", e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition-colors"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                    showFilters
                      ? "bg-violet-600 border-violet-500 text-white"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500 text-white">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                <div className="relative">
                  <select
                    value={filters.sortBy}
                    onChange={(e) =>
                      updateFilter("sortBy", e.target.value as typeof filters.sortBy)
                    }
                    className="pl-3 pr-8 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 focus:outline-none focus:border-violet-600 appearance-none cursor-pointer"
                  >
                    <option value="newest">Newest First</option>
                    <option value="salary-high">Highest Salary</option>
                    <option value="salary-low">Lowest Salary</option>
                    <option value="deadline">Deadline Soon</option>
                    <option value="applicants">Most Popular</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                </div>

                <button
                  onClick={handleExportJobs}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                {/* Job Type */}
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block mb-2">
                    Job Type
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(["internship", "full-time", "part-time", "co-op", "contract"] as const).map(
                      (type) => (
                        <button
                          key={type}
                          onClick={() => toggleArrayFilter("jobTypes", type)}
                          className={`text-[10px] px-3 py-1.5 rounded-lg border font-bold transition-colors ${
                            filters.jobTypes.includes(type)
                              ? "bg-violet-600 border-violet-500 text-white"
                              : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                          }`}
                        >
                          {type.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                {/* Remote Policy */}
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block mb-2">
                    Work Style
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(["remote", "hybrid", "on-site"] as const).map((policy) => (
                      <button
                        key={policy}
                        onClick={() => toggleArrayFilter("remotePolicies", policy)}
                        className={`text-[10px] px-3 py-1.5 rounded-lg border font-bold transition-colors ${
                          filters.remotePolicies.includes(policy)
                            ? "bg-violet-600 border-violet-500 text-white"
                            : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                        }`}
                      >
                        {policy === "on-site"
                          ? "On-Site"
                          : policy.charAt(0).toUpperCase() + policy.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Industry */}
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block mb-2">
                    Industry
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        "technology",
                        "finance",
                        "healthcare",
                        "media",
                        "energy",
                        "consulting",
                      ] as const
                    ).map((ind) => (
                      <button
                        key={ind}
                        onClick={() => toggleArrayFilter("industries", ind)}
                        className={`text-[10px] px-3 py-1.5 rounded-lg border font-bold capitalize transition-colors ${
                          filters.industries.includes(ind)
                            ? "bg-violet-600 border-violet-500 text-white"
                            : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                        }`}
                      >
                        {ind}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reset */}
                <div className="flex justify-end pt-2 border-t border-slate-800">
                  <button
                    onClick={resetFilters}
                    className="text-xs text-slate-500 hover:text-white font-bold transition-colors"
                  >
                    Reset all filters
                  </button>
                </div>
              </div>
            )}

            {/* Job Listings */}
            <div className="space-y-3">
              {filteredJobs.length === 0 && (
                <div className="text-center py-16 text-slate-500">
                  <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No jobs match your filters</p>
                  <button
                    onClick={resetFilters}
                    className="mt-3 text-xs text-violet-400 hover:text-violet-300 font-bold"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
              {filteredJobs.map((job) => (
                <JobListingCard
                  key={job.id}
                  job={job}
                  onToggleSave={handleToggleSave}
                  onApply={handleApply}
                />
              ))}
            </div>
          </div>
        )}

        {/* ════════ APPLICATIONS TAB ════════ */}
        {activeTab === "applications" && (
          <div className="space-y-4">
            {/* Pipeline Overview */}
            <StatusPipeline counts={statusCounts} />

            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search applications..."
                  value={appFilters.searchQuery}
                  onChange={(e) => updateAppFilter("searchQuery", e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition-colors"
                />
              </div>

              <div className="flex gap-2">
                <div className="relative">
                  <select
                    value={appFilters.sortBy}
                    onChange={(e) =>
                      updateAppFilter("sortBy", e.target.value as typeof appFilters.sortBy)
                    }
                    className="pl-3 pr-8 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 focus:outline-none focus:border-violet-600 appearance-none cursor-pointer"
                  >
                    <option value="recent">Most Recent</option>
                    <option value="status">By Status</option>
                    <option value="company">By Company</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                </div>

                <button
                  onClick={handleExportApplications}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>

            {/* Status Filter Chips */}
            <div className="flex flex-wrap gap-1.5">
              {PIPELINE_ORDER.map((status) => (
                <button
                  key={status}
                  onClick={() => toggleStatusFilter(status)}
                  className={`text-[10px] px-2.5 py-1 rounded-full border font-bold transition-colors ${
                    appFilters.statuses.includes(status)
                      ? "bg-violet-600 border-violet-500 text-white"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                  }`}
                >
                  {statusCounts[status] > 0 && `${statusCounts[status]} `}
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>

            {/* Application Cards */}
            <div className="space-y-3">
              {filteredApplications.length === 0 && (
                <div className="text-center py-16 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No applications match your search</p>
                </div>
              )}
              {filteredApplications.map((app) => (
                <ApplicationCard key={app.id} application={app} onSelect={setSelectedApp} />
              ))}
            </div>

            {/* Detail Modal */}
            {selectedApp && (
              <ApplicationDetailModal
                application={selectedApp}
                onClose={() => setSelectedApp(null)}
                onStatusChange={handleStatusChange}
              />
            )}
          </div>
        )}

        {/* ════════ CAREER FAIRS TAB ════════ */}
        {activeTab === "fairs" && (
          <div className="space-y-4">
            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search career fairs, events..."
                  value={fairQuery}
                  onChange={(e) => setFairQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition-colors"
                />
              </div>
              <button
                onClick={() => setShowVirtualOnly(!showVirtualOnly)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                  showVirtualOnly
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <Globe className="w-4 h-4" />
                Virtual Only
              </button>
            </div>

            {/* Events Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredEvents.length === 0 && (
                <div className="col-span-full text-center py-16 text-slate-500">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No career fairs match your search</p>
                </div>
              )}
              {filteredEvents.map((event) => (
                <CareerFairCard
                  key={event.id}
                  event={event}
                  onToggleRegister={handleToggleRegister}
                />
              ))}
            </div>
          </div>
        )}

        {/* ════════ RESUME BUILDER TAB ════════ */}
        {activeTab === "resume" && (
          <div>
            <ResumeBuilder />
          </div>
        )}
      </div>
    </div>
  );
}
