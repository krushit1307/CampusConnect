import React, { useState } from "react";
import {
  GraduationCap,
  Users,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Mail,
  CalendarDays,
  Briefcase,
  Sparkles,
} from "lucide-react";
import AliasInheritancePrompt, {
  type AliasDecision,
  type AliasOfferView,
} from "../../components/alumni/AliasInheritancePrompt";

interface SeniorMember {
  id: string;
  name: string;
  role: string;
  graduationDate: string;
  handoverStatus: "Pending" | "In Progress" | "Completed";
  email: string;
}

const INITIAL_SENIORS: SeniorMember[] = [
  {
    id: "s-1",
    name: "Aarav Sharma",
    role: "President",
    graduationDate: "2026-05-15",
    handoverStatus: "Pending",
    email: "aarav@campus.edu",
  },
  {
    id: "s-2",
    name: "Priya Patel",
    role: "Vice President",
    graduationDate: "2026-05-15",
    handoverStatus: "In Progress",
    email: "priya@campus.edu",
  },
  {
    id: "s-3",
    name: "Rohan Mehta",
    role: "Treasurer",
    graduationDate: "2026-06-01",
    handoverStatus: "Completed",
    email: "rohan@campus.edu",
  },
  {
    id: "s-4",
    name: "Sneha Gupta",
    role: "Event Coordinator",
    graduationDate: "2026-05-20",
    handoverStatus: "Pending",
    email: "sneha@campus.edu",
  },
];

const TASK_TEMPLATE = [
  "Transfer ownership of shared drive files",
  "Handover official club social media accounts",
  "Compile list of active sponsors and contacts",
  "Archive previous event budgets and invoices",
];

export default function SeniorOffboarding() {
  const [seniors, setSeniors] = useState<SeniorMember[]>(INITIAL_SENIORS);
  const [selectedSenior, setSelectedSenior] = useState<string | null>(null);
  const [offboardingTasks, setOffboardingTasks] = useState<string[]>(TASK_TEMPLATE);
  // #4425: prompts created by the audit_graduates pass for incoming officers.
  const [aliasOffers, setAliasOffers] = useState<AliasOfferView[]>([
    {
      offerId: "offer-president",
      aliasAddress: "president@techclub.campusconnect.edu",
      roleTitle: "President",
      outgoingHolderName: "Aarav Sharma",
      expiresAt: "2026-09-07T00:00:00.000Z",
    },
    {
      offerId: "offer-treasurer",
      aliasAddress: "treasurer@techclub.campusconnect.edu",
      roleTitle: "Treasurer",
      outgoingHolderName: "Rohan Mehta",
      expiresAt: "2026-09-07T00:00:00.000Z",
    },
  ]);
  const [aliasDecisionLog, setAliasDecisionLog] = useState<string[]>([]);

  const handleAliasDecision = (offerId: string, decision: AliasDecision) => {
    const offer = aliasOffers.find((o) => o.offerId === offerId);
    if (!offer) return;
    setAliasOffers((prev) => prev.filter((o) => o.offerId !== offerId));
    const localPart = offer.aliasAddress.split("@")[0];
    setAliasDecisionLog((prev) => [
      decision === "ACCEPTED"
        ? `You inherited '${localPart}@' - external mail now forwards to your inbox.`
        : `'${localPart}@' was declined and now forwards to the club archive.`,
      ...prev,
    ]);
  };

  const updateHandoverStatus = (id: string) => {
    setSeniors((prev) =>
      prev.map((senior) => {
        if (senior.id === id) {
          const nextStatus =
            senior.handoverStatus === "Pending"
              ? "In Progress"
              : senior.handoverStatus === "In Progress"
                ? "Completed"
                : "Pending";
          return { ...senior, handoverStatus: nextStatus };
        }
        return senior;
      }),
    );
  };

  const activeSenior = seniors.find((s) => s.id === selectedSenior);

  const completedCount = seniors.filter((s) => s.handoverStatus === "Completed").length;
  const pendingCount = seniors.filter((s) => s.handoverStatus !== "Completed").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="bg-gradient-to-r from-amber-900/60 via-orange-900/40 to-slate-900 border border-amber-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -top-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-amber-500/20 text-amber-300 text-xs px-3 py-1 rounded-full font-semibold border border-amber-500/30 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5" /> Alumni Transition
                </span>
                <span className="text-slate-400 text-xs flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-orange-400" /> {seniors.length} Graduating
                  Seniors
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-amber-200 bg-clip-text text-transparent">
                Graduating Senior Offboarding
              </h1>
              <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
                Manage the smooth transition of responsibilities as senior leaders graduate.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <p className="text-2xl font-bold text-emerald-400">
                  {completedCount}/{seniors.length}
                </p>
                <p className="text-xs text-slate-400">Completed</p>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
                <p className="text-xs text-slate-400">Pending</p>
              </div>
            </div>
          </div>
        </header>

        {/* #4425: alias inheritance prompts for incoming officers */}
        <AliasInheritancePrompt offers={aliasOffers} onDecide={handleAliasDecision} />
        {aliasDecisionLog.length > 0 && (
          <ul className="space-y-1" data-testid="alias-decision-log">
            {aliasDecisionLog.map((entry, index) => (
              <li
                key={index}
                className="text-xs text-emerald-400 font-medium flex items-center gap-2"
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {entry}
              </li>
            ))}
          </ul>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Senior List */}
          <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" /> Senior Leadership
              </h2>
            </div>
            <div className="divide-y divide-slate-800">
              {seniors.map((senior) => (
                <div
                  key={senior.id}
                  className={`p-6 flex items-center justify-between transition cursor-pointer hover:bg-slate-800/30 ${selectedSenior === senior.id ? "bg-slate-800/50 border-l-4 border-amber-500" : ""}`}
                  onClick={() => setSelectedSenior(senior.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xl">
                      {senior.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-lg">{senior.name}</h3>
                      <p className="text-sm text-slate-400">{senior.role}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" /> {senior.graduationDate}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {senior.email}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateHandoverStatus(senior.id);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                      senior.handoverStatus === "Completed"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : senior.handoverStatus === "In Progress"
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                          : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> {senior.handoverStatus}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Handover Detail Panel */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
              <ClipboardList className="w-5 h-5 text-blue-400" /> Handover Details
            </h2>

            {activeSenior ? (
              <div className="space-y-4">
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-sm text-slate-400">Selected Senior</p>
                  <p className="text-xl font-bold text-white mt-1">{activeSenior.name}</p>
                  <p className="text-sm text-amber-400 font-medium">{activeSenior.role}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Offboarding Tasks
                  </p>
                  <div className="space-y-2">
                    {offboardingTasks.map((task, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 bg-slate-800/30 rounded-lg p-3"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-slate-300">{task}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-300 leading-relaxed">
                    This is a standalone dashboard component. It does not modify any existing
                    backend data or exports.
                  </p>
                </div>

                <button className="w-full bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-xl font-medium transition shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2">
                  <Briefcase className="w-4 h-4" /> Generate Farewell Summary
                </button>
              </div>
            ) : (
              <div className="text-center py-16">
                <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500">Select a senior to view handover details.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-6 h-6 text-amber-400" />
            <div>
              <h3 className="font-semibold text-white">Smooth Transition Guaranteed</h3>
              <p className="text-xs text-slate-400">
                Ensure every responsibility is passed down properly.
              </p>
            </div>
          </div>
          <ArrowRight className="w-6 h-6 text-slate-600" />
        </div>
      </div>
    </div>
  );
}
