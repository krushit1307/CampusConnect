// =============================================================================
// Route Page: JuryReviewRoute
// Issue: #5129 - Automated "Profanity/Harassment" Decentralized Content Moderation DAO
// Description: Page route for /jury/review/:caseId displaying the blind jury review card.
// =============================================================================

import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { JuryReviewCard } from "@/components/moderation/JuryReviewCard";
import { Scale, ArrowLeft } from "lucide-react";

export default function JuryReviewRoute() {
  const { caseId } = useParams<{ caseId: string }>();
  const [userId, setUserId] = useState<string>("juror-demo-user-1");
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, [supabase]);

  if (!caseId) {
    return (
      <div className="p-8 text-center text-slate-400 font-mono">Invalid or missing case ID.</div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
          <a href="/dashboard" className="flex items-center gap-1 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </a>
        </div>

        <JuryReviewCard caseId={caseId} jurorId={userId} />
      </div>
    </div>
  );
}
