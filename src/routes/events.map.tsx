import { useState, lazy, Suspense } from "react";
import { SiteShell } from "@/components/site/SiteShell";
import { MapSkeleton } from "@/components/ui/MapSkeleton";
import { Map, Layers, List } from "lucide-react";
import { CampusEventMap } from "@/components/CampusEventMap";

const EventClusterMap = lazy(() =>
  import("@/components/EventClusterMap").then((m) => ({ default: m.EventClusterMap })),
);

export default function EventsMapPage() {
  const [mapView, setMapView] = useState<"interactive" | "cluster" | "list">("interactive");

  return (
    <SiteShell>
      <div className="flex min-h-screen flex-col">
        {/* Header */}
        <section className="border-b-2 border-black bg-peach px-4 py-10 md:px-6">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
            <div>
              <p className="eyebrow font-bold">Explore Campus Events</p>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl md:text-5xl">
                Interactive Campus Map
              </h1>
              <p className="mt-2 font-mono text-sm text-gray-700">
                View upcoming events across campus with interactive pins, details, and location
                links
              </p>
            </div>

            {/* View Toggle */}
            <div className="neu-border flex bg-white p-1">
              <button
                onClick={() => setMapView("interactive")}
                className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold uppercase transition-colors ${
                  mapView === "interactive" ? "bg-black text-cream" : "hover:bg-cream text-black"
                }`}
              >
                <Map size={16} />
                Campus Pins
              </button>
              <button
                onClick={() => setMapView("cluster")}
                className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold uppercase transition-colors ${
                  mapView === "cluster" ? "bg-black text-cream" : "hover:bg-cream text-black"
                }`}
              >
                <Layers size={16} />
                Clusters
              </button>
              <button
                onClick={() => setMapView("list")}
                className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold uppercase transition-colors ${
                  mapView === "list" ? "bg-black text-cream" : "hover:bg-cream text-black"
                }`}
              >
                <List size={16} />
                List
              </button>
            </div>
          </div>
        </section>

        {/* Map Container */}
        <section className="flex-1 p-4 md:p-6">
          <div className="mx-auto max-w-7xl">
            {mapView === "interactive" ? (
              <div className="h-[calc(100vh-250px)] min-h-[600px]">
                <CampusEventMap className="h-full w-full" />
              </div>
            ) : mapView === "cluster" ? (
              <div className="h-[calc(100vh-250px)] min-h-[600px]">
                <Suspense fallback={<MapSkeleton className="h-full w-full min-h-[600px]" />}>
                  <EventClusterMap
                    initialCenter={[28.7041, 77.1025]}
                    initialZoom={14}
                    className="h-full w-full"
                  />
                </Suspense>
              </div>
            ) : (
              <div className="mx-auto max-w-7xl p-6">
                <div className="neu-border bg-white p-8 text-center">
                  <h2 className="font-display text-2xl font-bold">Campus Events List</h2>
                  <p className="mt-2 font-mono text-sm text-gray-600">
                    Switch to Campus Pins or Cluster view to see interactive event locations on the
                    map.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
