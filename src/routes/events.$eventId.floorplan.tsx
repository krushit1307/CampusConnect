// =============================================================================
// Route: events/$eventId/floorplan
// Issues: #4145 - Interactive "Event Layout" Floorplan Builder
//         #4157 - Interactive "Career Fair" Digital Map
//         #4420 - Real-Time "Accessibility Need" Venue Map
// Description: Public attendee map + organizer editor. The attendee view
// (#4157) adds a career-fair search bar ("Search by Major, Role, or Company"):
// matching booths pulse while everything else dims, and selecting a booth
// surfaces its hiring tags plus the sponsor's Digital Swag Bag and Lead
// Scanner links. When the signed-in profile has requires_wheelchair_access
// (#4044/#4420), accessibility POIs glow bright blue, stairs dim out, and a
// personalized "Accessible Route" polyline is drawn from the street to the
// booth they are trying to reach.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { useFloorplan } from "@/hooks/useFloorplan";
import { FloorplanCanvas } from "@/components/events/floorplan/FloorplanCanvas";
import { FloorplanEditor } from "@/components/events/floorplan/FloorplanEditor";
import { EventCapacityThermalMap } from "@/components/events/EventCapacityThermalMap";
import { describeAssignment } from "@/lib/floorplan/serialize";
import { buildSearchIndex, searchBooths } from "@/lib/floorplan/search";
import { computeAccessibleRoute } from "@/lib/floorplan/accessibility";
import type { FloorplanAsset } from "@/lib/floorplan/types";
import Accessibility from "lucide-react/dist/esm/icons/accessibility";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Gift from "lucide-react/dist/esm/icons/gift";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import ScanLine from "lucide-react/dist/esm/icons/scan-line";
import Search from "lucide-react/dist/esm/icons/search";

type Mode = "attendee" | "organizer";

export default function EventFloorplanPage() {
  const { eventId = "" } = useParams();
  const supabase = createClient();
  const floorplan = useFloorplan(eventId || null);
  const [mode, setMode] = useState<Mode>("attendee");
  const [canEdit, setCanEdit] = useState(false);
  const [selected, setSelected] = useState<FloorplanAsset | null>(null);
  // #4157 career-fair search over company / role / major hiring tags
  const [searchQuery, setSearchQuery] = useState("");
  // #4420 wheelchair routing: profile flag (auto) + manual toggle override
  const [wheelchairRequired, setWheelchairRequired] = useState(false);
  const [a11yManual, setA11yManual] = useState<boolean | null>(null);

  // Editing is available to signed-in users (organizers); attendees get the map.
  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getUser()
      .then(async ({ data }) => {
        if (!data.user) {
          if (!cancelled) setCanEdit(false);
          return;
        }
        const { data: isOrganizer } = await supabase.rpc("is_event_organizer", {
          p_event_id: eventId,
          p_user_id: data.user.id,
        });
        // #4420: profiles.requires_wheelchair_access predates the generated
        // types, so narrow the row explicitly (same pattern as service.ts).
        const { data: profile } = await supabase
          .from("profiles")
          .select("requires_wheelchair_access")
          .eq("id", data.user.id)
          .maybeSingle();
        if (!cancelled) {
          setCanEdit(Boolean(isOrganizer));
          setWheelchairRequired(
            Boolean(
              (profile as { requires_wheelchair_access?: boolean } | null)
                ?.requires_wheelchair_access,
            ),
          );
        }
      })

      .catch(() => {
        if (!cancelled) setCanEdit(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Reset the attendee selection whenever assets change underneath us
  useEffect(() => {
    if (!selected) return;
    const stillThere = floorplan.assets.find((a) => a.id === selected.id);
    setSelected(stillThere ?? null);
  }, [floorplan.assets]);

  const sponsorDirectory = useMemo(
    () => floorplan.assets.filter((a) => a.assignment?.companyName && a.kind !== "exit"),
    [floorplan.assets],
  );

  // #4157: index booths once per layout change, then resolve the live query
  const searchIndex = useMemo(() => buildSearchIndex(floorplan.assets), [floorplan.assets]);
  const highlightIds = useMemo(
    () => searchBooths(floorplan.assets, searchQuery, searchIndex),
    [floorplan.assets, searchQuery, searchIndex],
  );
  const isSearching = highlightIds != null;
  const matchCount = highlightIds?.size ?? 0;

  // #4420: accessibility mode auto-on for wheelchair profiles, overridable.
  const a11yMode = a11yManual ?? wheelchairRequired;
  const routeTarget = useMemo<FloorplanAsset | null>(() => {
    if (!a11yMode) return null;
    if (selected) return selected;
    const firstMatchId = highlightIds?.values().next().value;
    return firstMatchId ? (floorplan.assets.find((a) => a.id === firstMatchId) ?? null) : null;
  }, [a11yMode, selected, highlightIds, floorplan.assets]);

  const accessibleRoute = useMemo(() => {
    if (!a11yMode || !routeTarget) return null;
    return computeAccessibleRoute({
      venue: floorplan.venue,
      assets: floorplan.assets,
      targetAssetId: routeTarget.id,
      target: {
        x_ft: routeTarget.x + routeTarget.width / 2,
        y_ft: routeTarget.y + routeTarget.height / 2,
      },
    });
  }, [a11yMode, routeTarget, floorplan.venue, floorplan.assets]);

  return (
    <SiteShell>
      <div className="min-h-screen bg-cream px-4 py-8 md:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-2 font-mono text-sm font-bold uppercase hover:underline"
            >
              <ArrowLeft size={16} /> Back to Event
            </button>

            {canEdit && (
              <div className="flex items-center gap-2" role="tablist" aria-label="Floorplan mode">
                <button
                  role="tab"
                  aria-selected={mode === "attendee"}
                  onClick={() => setMode("attendee")}
                  className={`neu-border h-9 px-3 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000] ${mode === "attendee" ? "bg-sky" : "bg-white"}`}
                >
                  Attendee View
                </button>
                <button
                  role="tab"
                  aria-selected={mode === "organizer"}
                  onClick={() => setMode("organizer")}
                  data-testid="floorplan-edit-toggle"
                  className={`neu-border flex h-9 items-center gap-1.5 px-3 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000] ${mode === "organizer" ? "bg-sky" : "bg-white"}`}
                >
                  <Pencil size={13} /> Edit Layout
                </button>
              </div>
            )}
          </div>

          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
              {floorplan.eventTitle ? `${floorplan.eventTitle} — Floor Plan` : "Event Floor Plan"}
            </h1>
            <p className="mt-1 font-mono text-xs text-gray-600">
              {mode === "organizer"
                ? "Drag palette items onto the grid, assign sponsors to tables, then save. The layout is stored as JSON and shown to attendees here."
                : "Search booths by major, role or company, then click a table to see who's there and grab their swag."}
            </p>
          </div>

          {floorplan.isLoading ? (
            <div className="neu-border flex h-64 w-full items-center justify-center bg-white p-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent" />
            </div>
          ) : mode === "organizer" && canEdit ? (
            <div className="space-y-6">
              <FloorplanEditor
                eventId={eventId}
                venue={floorplan.venue}
                assets={floorplan.assets}
                collidingIds={floorplan.collidingIds}
                isSaving={floorplan.isSaving}
                onAdd={floorplan.addAsset}
                onMove={floorplan.moveAsset}
                onUpdate={floorplan.updateAsset}
                onRemove={floorplan.removeAsset}
                onVenueSize={floorplan.setVenueSize}
                onSave={floorplan.save}
                onAddPoi={floorplan.addPoi}
                onMovePoi={floorplan.movePoi}
                onUpdatePoi={floorplan.updatePoi}
                onRemovePoi={floorplan.removePoi}
              />
              <EventCapacityThermalMap eventId={eventId} />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
              <div className="space-y-3">
                {/* #4157 career-fair search bar */}
                <div>
                  <label htmlFor="floorplan-search" className="sr-only">
                    Search by Major, Role, or Company
                  </label>
                  <div
                    className="neu-border flex h-11 items-center gap-2 bg-white px-3 shadow-[2px_2px_0_0_#000]"
                    data-testid="floorplan-search-bar"
                  >
                    <Search size={16} className="shrink-0 text-gray-500" />
                    <input
                      id="floorplan-search"
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by Major, Role, or Company"
                      data-testid="floorplan-search"
                      className="h-full w-full bg-transparent font-mono text-sm outline-none placeholder:text-gray-400"
                    />
                  </div>
                  {isSearching && (
                    <p
                      className="mt-1.5 font-mono text-xs text-gray-600 dark:text-gray-300"
                      data-testid="floorplan-search-results"
                      role="status"
                    >
                      {matchCount === 0
                        ? `No booths match “${searchQuery.trim()}” — try “Internship”, a major, or a company name.`
                        : `${matchCount} booth${matchCount === 1 ? "" : "s"} match “${searchQuery.trim()}”`}
                    </p>
                  )}
                </div>

                {/* #4420 accessibility view toggle (auto-on for wheelchair profiles) */}
                <button
                  type="button"
                  onClick={() => setA11yManual(!a11yMode)}
                  aria-pressed={a11yMode}
                  data-testid="a11y-mode-toggle"
                  className={`neu-border neu-press flex h-9 items-center gap-1.5 px-3 font-mono text-[11px] font-bold uppercase tracking-wide shadow-[2px_2px_0_0_#000] ${
                    a11yMode ? "bg-blue-600 text-white" : "bg-white"
                  }`}
                >
                  <Accessibility size={14} />
                  Accessible routes
                </button>

                <FloorplanCanvas
                  venue={floorplan.venue}
                  assets={floorplan.assets}
                  readOnly
                  selectedId={selected?.id ?? null}
                  onSelect={(asset) => setSelected(asset)}
                  highlightIds={highlightIds}
                  accessibilityMode={a11yMode}
                  accessibleRoute={accessibleRoute}
                />
              </div>

              <aside className="space-y-3">
                {/* Selected asset callout */}
                {selected ? (
                  <div
                    className="neu-border bg-white p-4 font-mono text-sm shadow-[2px_2px_0_0_#000]"
                    data-testid="attendee-callout"
                  >
                    <p className="font-bold">{describeAssignment(selected, floorplan.venue)}</p>
                    {selected.assignment?.companyName && (
                      <>
                        <p className="mt-1 text-xs uppercase text-gray-500">
                          Sponsor ID: {selected.assignment.sponsorId ?? "—"}
                        </p>

                        {/* #4157 hiring tags for this booth */}
                        {(selected.assignment.hiringTags?.length ?? 0) > 0 && (
                          <ul
                            className="mt-2 flex flex-wrap gap-1.5"
                            data-testid="callout-hiring-tags"
                          >
                            {selected.assignment.hiringTags!.map((tag) => (
                              <li
                                key={tag}
                                data-testid="hiring-tag-chip"
                                className="neu-border bg-lime px-2 py-0.5 font-mono text-[10px] font-bold uppercase shadow-[2px_2px_0_0_#000]"
                              >
                                {tag}
                              </li>
                            ))}
                          </ul>
                        )}

                        {/* #4157 sponsor actions: Digital Swag Bag + Lead Scanner */}
                        <div className="mt-3 flex flex-wrap gap-2 border-t-2 border-dashed pt-3">
                          <Link
                            to={`/events/${eventId}/swag-bag?sponsor=${selected.assignment.sponsorId ?? ""}`}
                            data-testid="callout-swag-bag-link"
                            className="neu-border neu-press flex h-8 items-center gap-1.5 bg-white px-2.5 font-mono text-[10px] font-bold uppercase tracking-wide shadow-[2px_2px_0_0_#000]"
                          >
                            <Gift size={13} /> Digital Swag Bag
                          </Link>
                          <Link
                            to={`/sponsor/events/${eventId}?sponsor=${selected.assignment.sponsorId ?? ""}`}
                            data-testid="callout-lead-scanner-link"
                            className="neu-border neu-press flex h-8 items-center gap-1.5 bg-white px-2.5 font-mono text-[10px] font-bold uppercase tracking-wide shadow-[2px_2px_0_0_#000]"
                          >
                            <ScanLine size={13} /> Lead Scanner
                          </Link>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="neu-border bg-white p-4 font-mono text-xs text-gray-600 shadow-[2px_2px_0_0_#000]">
                    Click a table on the map to find a sponsor.
                  </div>
                )}

                {/* #4420 accessible route summary */}
                {a11yMode && (
                  <div
                    className="neu-border border-blue-500 bg-blue-50 p-4 font-mono text-xs shadow-[2px_2px_0_0_#000]"
                    data-testid="a11y-route-summary"
                  >
                    <p className="font-bold uppercase tracking-wide text-blue-800">
                      Accessible routing
                    </p>
                    {accessibleRoute ? (
                      <p className="mt-1.5 leading-relaxed text-gray-700">
                        Step-free path via your{" "}
                        <span className="font-bold">
                          {(accessibleRoute.entryKind ?? "accessible").replace("_", " ")}
                        </span>{" "}
                        — about{" "}
                        <span className="font-bold">
                          {Math.round(accessibleRoute.totalDistanceFt)} ft
                        </span>{" "}
                        from the street
                        {routeTarget ? ` to ${routeTarget.label}` : ""}. Stairs are never used.
                      </p>
                    ) : (
                      <p
                        className="mt-1.5 leading-relaxed text-gray-700"
                        data-testid="a11y-empty-note"
                      >
                        No wheelchair-accessible entrances are mapped for this venue yet — ask the
                        organizers to add ramps or elevators in the layout editor.
                      </p>
                    )}
                  </div>
                )}

                {/* Sponsor directory */}
                <div
                  className="neu-border bg-white p-4 shadow-[2px_2px_0_0_#000]"
                  data-testid="sponsor-directory"
                >
                  <h2 className="font-mono text-xs font-bold uppercase tracking-wider">
                    Sponsor Directory
                  </h2>
                  {sponsorDirectory.length === 0 ? (
                    <p className="mt-2 font-mono text-xs text-gray-500">
                      No sponsors assigned yet. Check back soon!
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {sponsorDirectory.map((asset) => (
                        <li key={asset.id} className="font-mono text-xs leading-relaxed">
                          <span className="font-bold">{asset.assignment!.companyName}</span>
                          {" — "}
                          {describeAssignment(asset, floorplan.venue)}
                          {(asset.assignment!.hiringTags?.length ?? 0) > 0 && (
                            <span className="block text-[10px] uppercase text-gray-500">
                              Hiring: {asset.assignment!.hiringTags!.join(" · ")}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
