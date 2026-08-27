import { Suspense, lazy } from "react";
import { RouteSkeleton } from "@/components/RouteSkeleton";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Clock from "lucide-react/dist/esm/icons/clock";

const CampusHeatmap = lazy(() =>
  import("@/components/CampusHeatmap").then((m) => ({ default: m.CampusHeatmap })),
);

export default function MapPage() {
  return (
    <div className="flex h-full flex-col bg-cream">
      {/* Header */}
      <div className="border-b-2 border-black bg-white p-4 shadow-[2px_2px_0_0_rgba(0,0,0,0.1)]">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-lime shadow-[2px_2px_0_rgba(0,0,0,1)]">
              <MapPin className="h-5 w-5 text-black" />
            </div>
            <div className="flex-1">
              <h1 className="font-display text-2xl font-bold text-black">Live Campus Heatmap</h1>
              <p className="font-mono text-xs font-semibold text-gray-600">
                See where the action is happening right now →
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Panel */}
      <div className="border-b border-gray-200 bg-blue-50 p-3">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap gap-4 font-mono text-xs">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>
                <strong>Real-Time:</strong> Updates every 30 seconds
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              <span>
                <strong>Intensity:</strong> Based on checked-in attendees
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>
                <strong>Privacy:</strong> Only public events shown
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="mx-auto h-full max-w-7xl rounded-lg border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,0.15)]">
          <Suspense fallback={<RouteSkeleton />}>
            <CampusHeatmap className="h-full w-full" refreshInterval={30000} />
          </Suspense>
        </div>
      </div>

      {/* Footer Info */}
      <div className="border-t border-gray-200 bg-gray-50 p-3">
        <div className="mx-auto max-w-7xl text-center">
          <p className="font-mono text-[11px] text-gray-600">
            💡 <strong>Pro Tip:</strong> Click on any heatmap marker to see event details.
            Overlapping events are spaced out for visibility.
          </p>
        </div>
      </div>
    </div>
  );
}
