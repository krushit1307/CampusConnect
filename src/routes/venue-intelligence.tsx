import { SiteShell } from "@/components/site/SiteShell";
import { VenueIntelligenceDashboard } from "@/components/venue-intelligence/VenueIntelligenceDashboard";

export default function VenueIntelligenceRoute() {
  return (
    <SiteShell>
      <div className="min-h-screen bg-cream px-4 py-8 md:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <VenueIntelligenceDashboard />
        </div>
      </div>
    </SiteShell>
  );
}
