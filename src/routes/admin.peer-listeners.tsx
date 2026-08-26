// =============================================================================
// File: src/routes/admin.peer-listeners.tsx
// Issue: #4296 - Develop a 'Dynamic "Mental Health" Peer Support Matcher'
// Description: Campus admin route for overseeing certified peer listeners and safety logs.
// =============================================================================

import React from "react";
import { Helmet } from "react-helmet-async";
import { ShieldCheck, HeartHandshake } from "lucide-react";
import { SiteShell } from "@/components/site/SiteShell";
import { PeerListenerDashboard } from "@/components/wellness/PeerListenerDashboard";

export default function AdminPeerListenersRoute() {
  return (
    <SiteShell>
      <Helmet>
        <title>Peer Listener Network Administration | CampusConnect</title>
        <meta
          name="description"
          content="Administration portal for verified student peer listeners, active shifts, and safety protocols."
        />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <PeerListenerDashboard />
      </div>
    </SiteShell>
  );
}
