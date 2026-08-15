import { useState, lazy, Suspense } from "react";
import { SiteShell } from "@/components/site/SiteShell";
import { MapSkeleton } from "@/components/ui/MapSkeleton";
import Map from "lucide-react/dist/esm/icons/map";
import List from "lucide-react/dist/esm/icons/list";
import X from "lucide-react/dist/esm/icons/x";
import ThumbsDown from "lucide-react/dist/esm/icons/thumbs-down";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import MoreVertical from "lucide-react/dist/esm/icons/more-vertical";

const CampusMap = lazy(() =>
  import("@/components/CampusMap/CampusMap").then((m) => ({ default: m.CampusMap })),
);

export default function EventsMapPage() {
  const [mapView, setMapView] = useState<"cluster" | "list">("cluster");

  return (
    <SiteShell>
      <div className="flex min-h-screen flex-col">
        {/* Header */}
        <section className="border-b-2 border-black bg-peach px-4 py-14 md:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div>
              <p className="eyebrow font-bold">Explore Campus Events</p>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl md:text-6xl">Event Map</h1>
              <p className="mt-2 font-mono text-sm text-gray-700">
                Discover events happening across campus
              </p>
            </div>

            {/* View Toggle */}
            <div className="neu-border flex bg-white p-1">
              <button
                onClick={() => setMapView("cluster")}
                className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold uppercase transition-colors ${
                  mapView === "cluster" ? "bg-black text-cream" : "hover:bg-cream"
                }`}
              >
                <Map size={16} />
                Map
              </button>
              <button
                onClick={() => setMapView("list")}
                className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold uppercase transition-colors ${
                  mapView === "list" ? "bg-black text-cream" : "hover:bg-cream"
                }`}
              >
                <List size={16} />
                List
              </button>
            </div>
          </div>
        </section>

        {/* Map Container */}
        <section className="flex-1">
          {mapView === "cluster" ? (
            <div className="h-[calc(100vh-200px)] min-h-[600px]">
              <Suspense fallback={<MapSkeleton className="h-full w-full min-h-[600px]" />}>
                <CampusMap className="h-full w-full" />
              </Suspense>
            </div>
          ) : (
            <div className="mx-auto max-w-7xl p-6">
              <div className="neu-border bg-white p-8 text-center">
                <h2 className="font-display text-2xl font-bold">List View Coming Soon</h2>
                <p className="mt-2 font-mono text-sm text-gray-600">
                  Switch to Map View to see clustered events
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </SiteShell>
  );
}
