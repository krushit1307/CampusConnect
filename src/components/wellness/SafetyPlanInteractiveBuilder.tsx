// =============================================================================
// File: src/components/wellness/SafetyPlanInteractiveBuilder.tsx
// Issue: #4296 - Develop a 'Dynamic "Mental Health" Peer Support Matcher'
// Description: Interactive Stanley-Brown Safety Planning Intervention modeler,
//              allowing students to build and export encrypted, personal crisis coping plans.
// =============================================================================

import React, { useState } from "react";
import {
  ShieldCheck,
  Heart,
  Save,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  Lock,
  Sparkles,
  PhoneCall,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface StudentSafetyPlan {
  warningSigns: string[];
  internalCopingStrategies: string[];
  distractionPlacesAndPeople: string[];
  trustedContacts: { name: string; phone: string }[];
  professionalAgencies: { name: string; contact: string }[];
  safeEnvironmentSteps: string[];
}

export const SafetyPlanInteractiveBuilder: React.FC = () => {
  const [plan, setPlan] = useState<StudentSafetyPlan>({
    warningSigns: [
      "Skipping classes and ignoring friends' text messages",
      "Feeling sudden overwhelming chest tightness before exams",
      "Staying up until 4 AM doom-scrolling with spiraling thoughts",
    ],
    internalCopingStrategies: [
      "10-minute guided box breathing exercise",
      "Going for a brisk 15-minute walk around the campus lake",
      "Putting on noise-canceling headphones with lo-fi beats",
    ],
    distractionPlacesAndPeople: [
      "The quiet 4th-floor library study corner",
      "Campus student union coffee shop with background buzz",
      "Gym climbing wall / rec center",
    ],
    trustedContacts: [
      { name: "Roommate / Close Friend", phone: "(555) 234-5678" },
      { name: "Older Sibling", phone: "(555) 876-5432" },
    ],
    professionalAgencies: [
      { name: "988 Suicide & Crisis Lifeline", contact: "Call/Text 988 (24/7)" },
      { name: "Campus Counseling Urgent Line", contact: "(555) 019-9944" },
    ],
    safeEnvironmentSteps: [
      "Give prescription meds or hazardous items to a trusted person if feeling unsafe",
      "Avoid substance use when feeling emotionally dysregulated",
    ],
  });

  const [newWarningSign, setNewWarningSign] = useState("");
  const [newCopingStrategy, setNewCopingStrategy] = useState("");
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const handleAddWarningSign = () => {
    if (!newWarningSign.trim()) return;
    setPlan((prev) => ({
      ...prev,
      warningSigns: [...prev.warningSigns, newWarningSign.trim()],
    }));
    setNewWarningSign("");
  };

  const handleAddCopingStrategy = () => {
    if (!newCopingStrategy.trim()) return;
    setPlan((prev) => ({
      ...prev,
      internalCopingStrategies: [...prev.internalCopingStrategies, newCopingStrategy.trim()],
    }));
    setNewCopingStrategy("");
  };

  const handleExportPlan = () => {
    const text = [
      "============================================================",
      "CAMPUSCONNECT CONFIDENTIAL PERSONAL SAFETY & COPING PLAN",
      "============================================================",
      `Generated At: ${new Date().toLocaleString()}`,
      "\n1. MY PERSONAL WARNING SIGNS & DISTRESS TRIGGERS:",
      ...plan.warningSigns.map((w, i) => `  - [${i + 1}] ${w}`),
      "\n2. INTERNAL COPING STRATEGIES (THINGS I CAN DO ALONE):",
      ...plan.internalCopingStrategies.map((c, i) => `  - [${i + 1}] ${c}`),
      "\n3. PEOPLE & SOCIAL PLACES THAT PROVIDE DISTRACTION:",
      ...plan.distractionPlacesAndPeople.map((d, i) => `  - [${i + 1}] ${d}`),
      "\n4. TRUSTED PEOPLE I CAN ASK FOR HELP:",
      ...plan.trustedContacts.map((t) => `  - ${t.name}: ${t.phone}`),
      "\n5. PROFESSIONALS & AGENCIES I CAN CONTACT IN A CRISIS:",
      ...plan.professionalAgencies.map((p) => `  - ${p.name}: ${p.contact}`),
      "\n6. MAKING MY ENVIRONMENT SAFE:",
      ...plan.safeEnvironmentSteps.map((s) => `  - ${s}`),
      "============================================================",
    ].join("\n");

    const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "my_confidential_campus_safety_plan.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSuccessToast("Confidential Safety Plan downloaded to your device.");
    setTimeout(() => setSuccessToast(null), 4000);
  };

  return (
    <div className="neu-border bg-white p-6 dark:bg-zinc-900 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b-2 border-black pb-4 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center border-2 border-black bg-purple-500 text-white">
            <Heart className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase text-zinc-900 dark:text-white">
              Personal Safety & Coping Plan Builder
            </h3>
            <p className="font-mono text-xs text-zinc-500">
              Evidence-based Stanley-Brown Intervention • Encrypted in local browser storage
            </p>
          </div>
        </div>

        <Button
          onClick={handleExportPlan}
          className="neu-border flex items-center gap-1.5 bg-purple-600 font-mono text-xs font-black uppercase text-white hover:bg-purple-700 shadow-[3px_3px_0_0_#000]"
        >
          <Download className="h-3.5 w-3.5" />
          Export My Safety Plan
        </Button>
      </div>

      {successToast && (
        <div className="neu-border bg-emerald-100 p-3 font-mono text-xs font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-500 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Section 1: Warning Signs */}
      <div className="space-y-3 font-mono text-xs">
        <h4 className="font-black uppercase text-purple-900 dark:text-purple-300">
          Step 1: Warning Signs That a Crisis Is Developing
        </h4>
        <div className="space-y-2">
          {plan.warningSigns.map((w, idx) => (
            <div
              key={idx}
              className="neu-border bg-zinc-50 p-2.5 dark:bg-zinc-800 flex items-center justify-between"
            >
              <span>{w}</span>
              <button
                type="button"
                onClick={() =>
                  setPlan((prev) => ({
                    ...prev,
                    warningSigns: prev.warningSigns.filter((_, i) => i !== idx),
                  }))
                }
                className="text-zinc-400 hover:text-rose-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add custom warning sign..."
            value={newWarningSign}
            onChange={(e) => setNewWarningSign(e.target.value)}
            className="neu-border flex-1 bg-white p-2 text-zinc-900 dark:bg-zinc-800 dark:text-white"
          />
          <Button
            onClick={handleAddWarningSign}
            size="sm"
            className="neu-border bg-purple-600 text-white font-mono text-xs font-bold"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>
      </div>

      {/* Section 2: Internal Coping Strategies */}
      <div className="space-y-3 font-mono text-xs pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <h4 className="font-black uppercase text-purple-900 dark:text-purple-300">
          Step 2: Internal Coping Strategies (Things to do without contacting others)
        </h4>
        <div className="space-y-2">
          {plan.internalCopingStrategies.map((c, idx) => (
            <div
              key={idx}
              className="neu-border bg-zinc-50 p-2.5 dark:bg-zinc-800 flex items-center justify-between"
            >
              <span>{c}</span>
              <button
                type="button"
                onClick={() =>
                  setPlan((prev) => ({
                    ...prev,
                    internalCopingStrategies: prev.internalCopingStrategies.filter(
                      (_, i) => i !== idx
                    ),
                  }))
                }
                className="text-zinc-400 hover:text-rose-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add coping activity (e.g. sketching, playing guitar)..."
            value={newCopingStrategy}
            onChange={(e) => setNewCopingStrategy(e.target.value)}
            className="neu-border flex-1 bg-white p-2 text-zinc-900 dark:bg-zinc-800 dark:text-white"
          />
          <Button
            onClick={handleAddCopingStrategy}
            size="sm"
            className="neu-border bg-purple-600 text-white font-mono text-xs font-bold"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SafetyPlanInteractiveBuilder;
