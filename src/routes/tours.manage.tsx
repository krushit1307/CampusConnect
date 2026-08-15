import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { useAuthHydration } from "@/hooks/useAuthHydration";
import { createClient } from "@/lib/supabase/client";
import "leaflet/dist/leaflet.css";

type Waypoint = {
  id?: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  title: string;
  description: string;
};

type Club = {
  id: string;
  name: string;
};

function MapClickHandler({
  onSelect,
}: {
  onSelect: (latitude: number, longitude: number) => void;
}) {
  useMapEvents({
    click(event) {
      onSelect(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

export default function TourManager() {
  const supabase = createClient();
  const navigate = useNavigate();
  const { user, isInitializing } = useAuthHydration();

  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubId, setClubId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;

    const loadClubs = async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("id, name")
        .eq("created_by", user.id)
        .order("name");

      if (error) {
        toast.error("Could not load your clubs.");
        return;
      }

      setClubs(data || []);

      if (data?.length === 1) {
        setClubId(data[0].id);
      }
    };

    loadClubs();
  }, [user]);

  const addWaypoint = (latitude: number, longitude: number) => {
    const nextWaypoint: Waypoint = {
      latitude,
      longitude,
      radius_meters: 20,
      title: `Waypoint ${waypoints.length + 1}`,
      description: "",
    };

    setWaypoints((current) => [...current, nextWaypoint]);
    setSelectedIndex(waypoints.length);
  };

  const updateWaypoint = (
    index: number,
    updates: Partial<Waypoint>,
  ) => {
    setWaypoints((current) =>
      current.map((waypoint, waypointIndex) =>
        waypointIndex === index
          ? { ...waypoint, ...updates }
          : waypoint,
      ),
    );
  };

  const removeWaypoint = (index: number) => {
    setWaypoints((current) =>
      current
        .filter((_, waypointIndex) => waypointIndex !== index)
        .map((waypoint, waypointIndex) => ({
          ...waypoint,
          title:
            waypoint.title.startsWith("Waypoint ")
              ? `Waypoint ${waypointIndex + 1}`
              : waypoint.title,
        })),
    );

    setSelectedIndex(null);
  };

  const saveTour = async () => {
    if (!user) {
      toast.error("Please sign in first.");
      return;
    }

    if (!title.trim()) {
      toast.error("Enter a tour title.");
      return;
    }

    if (waypoints.length === 0) {
      toast.error("Add at least one waypoint on the map.");
      return;
    }

    setSaving(true);

    try {
      const { data: tour, error: tourError } = await supabase
        .from("tours" as never)
        .insert({
          club_id: clubId || null,
          created_by: user.id,
          title: title.trim(),
          description: description.trim() || null,
        } as never)
        .select("id")
        .single();

      if (tourError) throw tourError;

      const { error: waypointError } = await supabase
        .from("tour_waypoints" as never)
        .insert(
          waypoints.map((waypoint, index) => ({
            tour_id: tour.id,
            sequence_order: index,
            latitude: waypoint.latitude,
            longitude: waypoint.longitude,
            radius_meters: waypoint.radius_meters,
            title: waypoint.title.trim(),
            description: waypoint.description.trim() || null,
          })) as never,
        );

      if (waypointError) throw waypointError;

      toast.success("Campus tour created.");
      navigate(`/tours/${tour.id}`);
    } catch (error) {
      console.error(error);
      toast.error("Could not save the campus tour.");
    } finally {
      setSaving(false);
    }
  };

  if (isInitializing) {
    return null;
  }

  if (!user) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-3xl p-8 text-center">
          <h1 className="font-display text-3xl font-bold uppercase">
            Sign in required
          </h1>
          <p className="mt-3 font-mono text-sm">
            Sign in to create a campus tour.
          </p>
        </div>
      </SiteShell>
    );
  }

  const mapCenter: [number, number] =
    waypoints.length > 0
      ? [waypoints[0].latitude, waypoints[0].longitude]
      : [20.5937, 78.9629];

  return (
    <SiteShell>
      <div className="min-h-screen bg-cream px-4 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="eyebrow font-bold">Organizer Tools</p>
            <h1 className="mt-2 font-display text-4xl font-black uppercase">
              Interactive Campus Tour
            </h1>
            <p className="mt-2 max-w-2xl font-mono text-sm text-black/60">
              Create an ordered route by clicking each campus location on the map.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <div className="neu-border bg-white p-5">
              <label className="mb-2 block font-mono text-xs font-bold uppercase">
                Tour title
              </label>

              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Freshers Campus Tour"
                className="mb-4 w-full border-2 border-black p-3 font-mono text-sm"
              />

              <label className="mb-2 block font-mono text-xs font-bold uppercase">
                Description
              </label>

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="A guided tour of important campus locations."
                rows={4}
                className="mb-4 w-full border-2 border-black p-3 font-mono text-sm"
              />

              <label className="mb-2 block font-mono text-xs font-bold uppercase">
                Hosting club
              </label>

              <select
                value={clubId}
                onChange={(event) => setClubId(event.target.value)}
                className="mb-5 w-full border-2 border-black bg-white p-3 font-mono text-sm"
              >
                <option value="">Campus-wide tour</option>
                {clubs.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name}
                  </option>
                ))}
              </select>

              <div className="mb-4">
                <p className="font-mono text-xs font-bold uppercase">
                  Waypoints: {waypoints.length}
                </p>
                <p className="mt-1 text-xs text-black/50">
                  Click the map to add each stop in order.
                </p>
              </div>

              <div className="space-y-3">
                {waypoints.map((waypoint, index) => (
                  <div
                    key={`${waypoint.latitude}-${waypoint.longitude}-${index}`}
                    className={`border-2 p-3 ${
                      selectedIndex === index
                        ? "border-black bg-yellow-100"
                        : "border-black/20 bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      className="mb-3 text-left font-mono text-xs font-bold uppercase"
                    >
                      {index + 1}. {waypoint.title}
                    </button>

                    {selectedIndex === index && (
                      <div className="space-y-3">
                        <input
                          value={waypoint.title}
                          onChange={(event) =>
                            updateWaypoint(index, {
                              title: event.target.value,
                            })
                          }
                          placeholder="Library"
                          className="w-full border-2 border-black p-2 font-mono text-xs"
                        />

                        <textarea
                          value={waypoint.description}
                          onChange={(event) =>
                            updateWaypoint(index, {
                              description: event.target.value,
                            })
                          }
                          placeholder="Tell students something interesting about this place."
                          rows={3}
                          className="w-full border-2 border-black p-2 font-mono text-xs"
                        />

                        <label className="block font-mono text-xs font-bold uppercase">
                          Unlock radius: {waypoint.radius_meters}m
                        </label>

                        <input
                          type="range"
                          min="20"
                          max="200"
                          step="10"
                          value={waypoint.radius_meters}
                          onChange={(event) =>
                            updateWaypoint(index, {
                              radius_meters: Number(event.target.value),
                            })
                          }
                          className="w-full"
                        />

                        <p className="font-mono text-[10px] text-black/50">
                          {waypoint.latitude.toFixed(6)},{" "}
                          {waypoint.longitude.toFixed(6)}
                        </p>

                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeWaypoint(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button
                type="button"
                onClick={saveTour}
                disabled={saving || waypoints.length === 0}
                className="mt-5 w-full"
              >
                {saving ? "Saving..." : "Save Campus Tour"}
              </Button>
            </div>

            <div className="min-h-[600px] overflow-hidden border-4 border-black bg-white shadow-[6px_6px_0_0_#000]">
              <MapContainer
                center={mapCenter}
                zoom={18}
                className="h-[700px] w-full"
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapClickHandler onSelect={addWaypoint} />

                {waypoints.map((waypoint, index) => (
                  <Marker
                    key={`${waypoint.latitude}-${waypoint.longitude}-${index}`}
                    position={[waypoint.latitude, waypoint.longitude]}
                    eventHandlers={{
                      click: () => setSelectedIndex(index),
                    }}
                  />
                ))}
              </MapContainer>
            </div>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}