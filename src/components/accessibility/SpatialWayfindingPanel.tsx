import React, { useMemo, useState } from "react";
import { AudioLines, Play, Square, Volume2 } from "lucide-react";
import { useSpatialWayfinding } from "@/hooks/useSpatialWayfinding";
import {
  DEFAULT_WAYPOINTS,
  MockSpatialPositionProvider,
} from "@/lib/accessibility/mockSpatialPositionProvider";
import { SpatialPositionProvider, SpatialTarget } from "@/types/spatialWayfinding";

interface SpatialWayfindingPanelProps {
  title?: string;
  waypoints?: SpatialTarget[];
  provider?: SpatialPositionProvider;
}

export function SpatialWayfindingPanel({
  title = "Spatial Acoustic Wayfinding",
  waypoints = DEFAULT_WAYPOINTS,
  provider,
}: SpatialWayfindingPanelProps) {
  const resolvedProvider = useMemo(() => provider ?? new MockSpatialPositionProvider(), [provider]);
  const canControlMockProvider =
    "setTargetPosition" in resolvedProvider && "setHeadOrientation" in resolvedProvider;
  const mockProvider = canControlMockProvider
    ? (resolvedProvider as MockSpatialPositionProvider)
    : null;

  const [selectedWaypointId, setSelectedWaypointId] = useState(waypoints[0]?.id ?? "");
  const [headYaw, setHeadYaw] = useState(0);
  const [volume, setVolume] = useState(0.5);

  const {
    status,
    snapshot,
    error,
    audioAvailable,
    startNavigation,
    stopNavigation,
    setVolume: setBeaconVolume,
  } = useSpatialWayfinding({ provider: resolvedProvider });

  const isNavigating = status === "navigating" || status === "starting";

  const handleSelectWaypoint = (id: string) => {
    setSelectedWaypointId(id);
    const waypoint = waypoints.find((w) => w.id === id);
    if (waypoint && mockProvider) {
      mockProvider.setTargetPosition(waypoint.position);
    }
  };

  const handleHeadYawChange = (value: number) => {
    setHeadYaw(value);
    if (mockProvider) {
      mockProvider.setHeadOrientation({ yaw: value, pitch: 0, roll: 0 });
    }
  };

  const handleVolumeChange = (value: number) => {
    setVolume(value);
    setBeaconVolume(value);
  };

  const selectedWaypoint = waypoints.find((w) => w.id === selectedWaypointId);

  const statusMessage = error
    ? error
    : status === "navigating" && snapshot
      ? `Target is approximately ${snapshot.distanceM.toFixed(1)} meters ${snapshot.description}.`
      : status === "navigating"
        ? "Navigation is starting."
        : status === "stopped"
          ? "Spatial wayfinding is stopped."
          : "Select a destination and press Start Navigation.";

  const bearingLabel =
    snapshot === null
      ? ""
      : `${Math.abs(Math.round(snapshot.relativeBearingDeg))}° ${snapshot.relativeBearingDeg < 0 ? "left" : "right"}`;

  const selectedTarget = selectedWaypoint
    ? `${selectedWaypoint.label} — ${waypoints.length} destinations available.`
    : "No destination selected.";

  return (
    <section
      aria-label={title}
      className="w-full max-w-4xl mx-auto p-4 md:p-6 bg-slate-950 text-slate-100 font-sans"
    >
      <header className="border-b border-slate-800 pb-4">
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <AudioLines className="h-6 w-6 text-cyan-400" aria-hidden="true" />
          {title}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Web Audio spatial wayfinding for blind and low-vision users. A subtle chime is anchored to
          the destination direction and distance. Positions come from a mock UWB provider; a native
          UWB provider can be plugged in later.
        </p>
      </header>

      {/* Screen-reader live region (announced on changes only). */}
      <p id="spatial-wayfinding-status" role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Navigate
          </h2>

          <div>
            <label
              htmlFor="spatial-wayfinding-target"
              className="block text-sm text-slate-300 mb-1"
            >
              Destination
            </label>
            <select
              id="spatial-wayfinding-target"
              value={selectedWaypointId}
              onChange={(e) => handleSelectWaypoint(e.target.value)}
              disabled={isNavigating}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {waypoints.map((waypoint) => (
                <option key={waypoint.id} value={waypoint.id}>
                  {waypoint.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void startNavigation()}
              disabled={isNavigating || waypoints.length === 0}
              className="inline-flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 disabled:opacity-50"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              Start Navigation
            </button>
            <button
              type="button"
              onClick={stopNavigation}
              disabled={!isNavigating}
              className="inline-flex items-center gap-2 rounded-md border border-red-500 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 disabled:opacity-40"
            >
              <Square className="h-4 w-4" aria-hidden="true" />
              Stop Navigation
            </button>
          </div>

          {!audioAvailable && (
            <p className="text-sm text-amber-400">
              Spatial audio is not available in this browser or was blocked. Position and direction
              text below still updates.
            </p>
          )}

          {audioAvailable && (
            <div>
              <label
                htmlFor="spatial-wayfinding-volume"
                className="block text-sm text-slate-300 mb-1"
              >
                Beacon volume
              </label>
              <input
                id="spatial-wayfinding-volume"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
              <Volume2 className="mt-2 h-4 w-4 text-slate-500" aria-hidden="true" />
            </div>
          )}

          {mockProvider && (
            <div>
              <label htmlFor="spatial-wayfinding-yaw" className="block text-sm text-slate-300 mb-1">
                Head orientation (degrees) — demo only
              </label>
              <input
                id="spatial-wayfinding-yaw"
                type="range"
                min={-180}
                max={180}
                step={1}
                value={headYaw}
                onChange={(e) => handleHeadYawChange(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
              <p className="mt-1 text-xs text-slate-500">
                Simulates turning your head. Replace with device sensors or native head tracking in
                production.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Current status
          </h2>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Distance to target</dt>
              <dd className="mt-0.5 font-semibold text-slate-200">
                {snapshot ? `${snapshot.distanceM.toFixed(1)} m` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Direction</dt>
              <dd className="mt-0.5 font-semibold text-slate-200">
                {snapshot ? snapshot.description : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Relative bearing</dt>
              <dd className="mt-0.5 font-semibold text-slate-200">{bearingLabel || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Navigation state</dt>
              <dd className="mt-0.5 font-semibold text-cyan-300">{status}</dd>
            </div>
          </dl>

          <p className="text-xs text-slate-400 border-t border-slate-800 pt-3">{selectedTarget}</p>
        </div>
      </div>

      <footer className="border-t border-slate-800 pt-3 mt-6 text-xs text-slate-500">
        This is Web Audio spatial wayfinding. UWB ranging and platform-specific head tracking (Apple
        U1 / Dynamic Head Tracking) are out of scope for browsers and are represented by a mock
        provider behind the <code>SpatialPositionProvider</code> abstraction.
      </footer>
    </section>
  );
}

export default SpatialWayfindingPanel;
