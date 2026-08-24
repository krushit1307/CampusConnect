import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { useFloorplan } from "@/hooks/useFloorplan";
import { FloorplanCanvas } from "@/components/events/floorplan/FloorplanCanvas";
import { FloorplanEditor } from "@/components/events/floorplan/FloorplanEditor";
import { EventCapacityThermalMap } from "@/components/events/EventCapacityThermalMap";
import { describeAssignment } from "@/lib/floorplan/serialize";
import type { FloorplanAsset } from "@/lib/floorplan/types";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Pencil from "lucide-react/dist/esm/icons/pencil";

type Mode = "attendee" | "organizer";

export default function EventFloorplanPage() {
  const { eventId = "" } = useParams();
  const supabase = createClient();
  const floorplan = useFloorplan(eventId || null);
  const [mode, setMode] = useState<Mode>("attendee");
  const [canEdit, setCanEdit] = useState(false);
  const [selected, setSelected] = useState<FloorplanAsset | null>(null);

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
        if (!cancelled) setCanEdit(Boolean(isOrganizer));
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
                : "Find your way around: click any table to see which sponsor is stationed there."}
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
              />
              <EventCapacityThermalMap eventId={eventId} />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
              <FloorplanCanvas
                venue={floorplan.venue}
                assets={floorplan.assets}
                readOnly
                selectedId={selected?.id ?? null}
                onSelect={(asset) => setSelected(asset)}
              />

              <aside className="space-y-3">
                {/* Selected asset callout */}
                {selected ? (
                  <div
                    className="neu-border bg-white p-4 font-mono text-sm shadow-[2px_2px_0_0_#000]"
                    data-testid="attendee-callout"
                  >
                    <p className="font-bold">{describeAssignment(selected, floorplan.venue)}</p>
                    {selected.assignment?.companyName && (
                      <p className="mt-1 text-xs uppercase text-gray-500">
                        Sponsor ID: {selected.assignment.sponsorId ?? "—"}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="neu-border bg-white p-4 font-mono text-xs text-gray-600 shadow-[2px_2px_0_0_#000]">
                    Click a table on the map to find a sponsor.
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
