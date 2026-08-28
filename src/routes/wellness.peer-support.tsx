// =============================================================================
// File: src/routes/wellness.peer-support.tsx
// Issue: #4296 - Develop a 'Dynamic "Mental Health" Peer Support Matcher'
// Description: Student wellness route for anonymous peer listening, E2EE chats,
//              and crisis safety escalation hotlines.
// =============================================================================

import React from "react";
import { Helmet } from "react-helmet-async";
import { HeartHandshake, ShieldCheck } from "lucide-react";
import { SiteShell } from "@/components/site/SiteShell";
import { AnonymousPeerSupportMatcher } from "@/components/wellness/AnonymousPeerSupportMatcher";

export default function WellnessPeerSupportRoute() {
  return (
    <SiteShell>
      <Helmet>
        <title>Anonymous Peer Support & Listening | CampusConnect Wellness</title>
        <meta
          name="description"
          content="Connect anonymously with trained upperclassmen peer listeners via end-to-end encrypted chat with zero database storage."
        />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <AnonymousPeerSupportMatcher />
      </div>
    </SiteShell>
  );
}
